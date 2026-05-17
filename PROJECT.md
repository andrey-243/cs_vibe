# CS Vibe — Projet FUT-style CS2

## Concept

Jeu de cartes à collectionner style FIFA Ultimate Team, basé sur les vrais stats HLTV des joueurs CS2 professionnels.  
Les joueurs ouvrent des packs pour obtenir des cartes, chaque carte représente un pro avec ses vraies statistiques.

---

## Data Pipeline

### Stratégie source — cible commercial

Trois sources gratuites complémentaires, toutes utilisables avec ads :

```
csapi.de (OldFella/hltv_api — GPL-3.0)   → stats, rankings, résultats, scores
  Données HLTV-derived, no key, updated daily
  https://api.csapi.de

PandaScore free tier                       → identité visuelle, logos teams, events structurés
  Commercial OK, 1000 req/h, no credit card
  https://api.pandascore.co

Liquipedia MediaWiki API                   → achievements (MVP, Top20, Majors), rôle joueur, team history (synergy)
  CC-BY-SA — commercial OK, attribution obligatoire
  https://liquipedia.net/counterstrike/api.php
```

> Attribution obligatoire footer : `Data: csapi.de · PandaScore · Liquipedia.net`

---

### TEAM

| Donnée | Source | Endpoint |
|---|---|---|
| Nom, id | csapi.de | `/teams/` |
| Roster (player ids) | csapi.de | `/teams/{id}` |
| Streak (série de victoires) | csapi.de | `/teams/{id}` |
| Rank + points (pour tiers gems) | csapi.de | `/rankings/` |
| Win/loss par map (last 3 mois) | csapi.de | `/teams/{id}/stats` |
| Historique matchs | csapi.de | `/teams/{id}/matchhistory` |
| Logo image, acronym, location | PandaScore | `/csgo/teams` |

---

### JOUEUR

| Donnée | Source | Endpoint / Note |
|---|---|---|
| Nom (nickname) | csapi.de | `/players/` |
| Équipe actuelle | csapi.de | `/players/{id}` |
| Rating, ADR, KAST, swing, K, D, N | csapi.de | `/players/{id}` |
| Stats agrégées par map | csapi.de | `/players/{id}/stats/maps` *(dispo, non utilisé)* |
| Stats agrégées par event | csapi.de | `/players/{id}/stats/events` *(dispo, non utilisé)* |
| `photo_focus` | Manuel | Champ optionnel dans `players_cards.json` — CSS `object-position` (ex: `"50% 26%"`) pour recadrer les photos mal cadrées. Absent → fallback `"top center"`. |
| Photo (image_url) | PandaScore | `/csgo/players` |
| Nationalité + code ISO | PandaScore + mapping | `/csgo/players` → `_nat_iso()` |
| Prénom, nom réel, âge | PandaScore | `/csgo/players` |
| Rôle (AWPer, IGL, Entry…) | Liquipedia | wikitext `\|roles=` Infobox |
| MVP count | Liquipedia | wikitext — section MVP Awards |
| Top20 HLTV par année + rang | Liquipedia | wikitext — section Trivia/Awards |
| Major championships won | Liquipedia | wikitext — intro |
| Major MVP count | Liquipedia | wikitext — intro |
| Team history (stints + dates) | Liquipedia | wikitext `{{TH\|...}}` Infobox — synergy |

> Clé de jointure : le `name` (nickname) est commun aux sources.  
> Liquipedia fetché pour tous les joueurs (premier run) — rating pas un proxy valide pour la carrière (IGLs, vétérans).

---

### EVENT

| Donnée | Source | Endpoint |
|---|---|---|
| Nom event (dans les matchs) | csapi.de | `/matches/latest`, `/teams/{id}/matchhistory` |
| Tier S/A/B/C/D | PandaScore | `/csgo/tournaments` |
| Dates début/fin exactes | PandaScore | `/csgo/tournaments` → `begin_at`, `end_at` |
| Teams participantes | PandaScore | `/csgo/tournaments` → `teams[]` |
| Winner équipe | csapi.de + PandaScore | les deux |
| Prize pool | PandaScore | `/csgo/tournaments` → `prizepool` |
| Scores par map | csapi.de | `/matches/{id}/stats?by_map=true` |
| Stats joueurs par match | csapi.de | `/matches/{id}/stats` |

> Filtre automatique events pertinents : `tier=s` sur PandaScore = IEM/BLAST/PGL/Major uniquement.  
> Dates exactes → activation/désactivation automatique des packs event sans intervention manuelle.

---

### Formule overall — implémentée

```
1. Base rating (prio 1)
   reliability = min(1.0, N / 30)          ← dampen rating si < 30 matchs
   effective = (1.0 + (rating - 1.0) × reliability) × comp_mult(avg_opp_rank)
   base = clamp((effective - 0.87) × (67 / 0.58) + 30,  0, 99)

   comp_mult basé sur le rang moyen des adversaires récents (match history) :
     avg_opp ≤ 25  → ×1.00  (élite schedule — top teams entre elles)
     avg_opp ≤ 50  → ×0.99
     avg_opp ≤ 75  → ×0.97  (médian ~75)
     avg_opp ≤ 100 → ×0.95
     avg_opp > 100 → ×0.93  (schedule faible)
     inconnu       → ×0.97  (conservative default)

   Calibration : rating 1.07 (médian) → overall ~50 (Silver)
                 rating 1.47 (ZywOo)  → overall ~99

2. Achievement bonus (prio 2) — données Liquipedia
   top20 HLTV   : Σ (21 - rank) / 20  par année  → capped +6
   Total bonus  : max +6 pts

   V1 : top20 uniquement — seule donnée fiable à 95%+ depuis le wikitext prose.
   V2 : ajouter mvp_count, major_count, major_mvp_count quand le parser est amélioré.
        (77% des joueurs ont leurs achievements dans un template non-parseable en quick)

3. Team bonus (prio 3)
   #1 → +5 / #2-3 → +4 / #4-10 → +3 / #11-25 → +2 / #26-70 → +1 / #71+ → +0

overall = clamp(base + achievement_bonus + team_bonus,  0, 99)
```

> Note : N (sample size) utilisé uniquement pour le reliability dampening, pas affiché.  
> avg_opp_rank = moyenne des rangs adversaires sur les derniers matchs (csapi `/teams/{id}/matchhistory`).  
> Cache `match_history_cache.json` — re-fetchée à chaque weekly refresh (`--refresh`), utilisée depuis le cache sur le one-shot uniquement.

### Synergy

**Source** : Liquipedia `{{TH|date — date|TeamName|status}}` dans `|team_history=` Infobox.

```
Parse → stints actifs seulement (skip Inactive / Loan / Stand-in / Coach)
      → dates partielles "2015-??-??" → "2015-07-01" (approximation)
      → stints sans aucune date → ignorés
Calcul → overlap en jours entre deux joueurs sur les mêmes équipes
       → merge des intervalles avant calcul (évite double-comptage)
```

**Tiers de synergy :**

| Tier | Jours ensemble | Score |
|---|---|---|
| Band of Brothers | 3+ ans (≥1095j) | 100 |
| Core Duo | 1–3 ans | 70 |
| Teammate | 6m–1an | 40 |
| Alumni | 1–6 mois | 15 |

**Stats V1 (500 joueurs, top 100 équipes) :**
- 2465 paires de synergy détectées / 124 750 combinaisons possibles (~2%)
- 74 Band of Brothers · 639 Core Duo · 631 Teammate · 1121 Alumni
- Top pair : kscerato + yuurih = 8.3 ans à FURIA

**Scripts :**
```
python3 monthly.py synergy   # full re-fetch + recalcul (mensuel)
monthly.py                   # runner générique — ajouter d'autres tasks dans MONTHLY_TASKS
```

**Intégration pipeline :**
- `main.py --refresh` : Phase 5 — fetch history nouveaux joueurs uniquement, recalcule leurs paires
- `monthly.py synergy` : force re-fetch complet de toutes les histories (team transfers)
- `liquipedia.py` : module unique — achievements + team history + synergy

**Format synergy.json :**
```json
{
  "pairs": [{ "player_a", "player_b", "id_a", "id_b", "tier", "score", "total_days", "shared_teams" }],
  "by_player": { "player_id": [{ "with_id", "with_name", "tier", "score", ... }] }
}
```
`by_player` = index O(1) pour lookup depuis une carte.

---

### Liquipedia — méthodo de parsing

Toutes les données achievements sont en prose dans le wikitext brut (`action=query`, 1 req/2s).  
`action=parse` (1 req/30s) n'est **pas nécessaire** — testé et confirmé.

Patterns extraits (V1) :
```
|roles=awp,igl          → rôles joueur (Infobox)          fiabilité ~95%
Was ranked the Nth best player of YYYY by HLTV             fiabilité ~95%
  → top20 dict {year: rank}  (pondéré dans la formule par (21-rank)/20)
```

**Normalisation des rôles :**
```
Fusionnés   : awp / awper → AWPer   |   rifle / rifler → Rifler
              entry / entryfragger → Entry   |   lurk / lurker → Lurker
Exclus      : coach, analyst, assistant coach, caster, observer, manager
Conservés   : IGL, Support
```
Rôles non reconnus dans la whitelist sont ignorés (pas de fallback `capitalize`).

Patterns prêts mais mis en pause (V2) :
```
Was named the [HLTV] MVP of [event]  → mvp_count     ~40% des joueurs
won X Major championship             → major_count    ~25% des joueurs
winning [[X Major Y]]                → major_count    fallback Trivia
win X Major finals                   → major_count    Records section
Oldest Major winner                  → major_count=1  fallback
X Major MVP                          → major_mvp_count
```
> 77% des joueurs ont leurs achievements dans {{Player achievements table}} (template non-parseable
> en action=query). action=parse (1 req/30s) = 4h+ pour 500 joueurs — non viable en V1.

Gestion casse : csapi.de retourne les noms en minuscule ("zywoo"), Liquipedia est case-sensitive.  
→ Step 1 : capitalize first letter + `redirects=1`  
→ Step 2 : `list=search` fallback si page manquante ou disambiguation

### Scope
- Top 100 équipes HLTV → ~500 joueurs uniques
- Fichiers générés :
```
data_pipeline/output/
├── teams_raw.json               # 100 équipes avec rosters + logos
├── ps_players_cache.json        # cache PandaScore joueurs (indexé par name.lower())
├── ps_teams_cache.json          # cache PandaScore teams
├── players_progress.json        # sauvegarde incrémentale (resume si coupé)
├── players_cards.json           # cartes finales normalisées
├── synergy.json                 # paires synergy (pairs[] + by_player index)
├── synergy_history_cache.json   # cache team histories Liquipedia (pid → stints)
├── viewer.html                  # browser local des cartes (filtres + détail modal)
├── images/                      # source unique — Liq en priorité, PS en fallback
│   └── {player_id}.png
├── photos_report.html           # viewer de review des photos
├── liq_image_cache.json         # cache Liquipedia (name → filename)
└── team_logos/
    └── {team_name}.png          # logo team (PandaScore CDN)
```

> Pour utiliser le viewer : `cd data_pipeline/output && python3 -m http.server 8080` → `http://localhost:8080/viewer.html`

### Images joueurs — pipeline

Un seul dossier `images/`. Priorité : Liquipedia d'abord (meilleure qualité), PandaScore en fallback.

**Couverture actuelle (500 joueurs) :**
- 441 ont une photo locale (88%)
  - 206 → source PandaScore (`image_url` CDN + fichier local)
  - 235 → source Liquipedia uniquement
- 59 → aucune photo (`no_photo: true`)

**IDs distincts :** `player_id` interne ≠ ID PandaScore (ex: ZywOo = `11893` en interne, `18452` chez PandaScore). L'URL CDN PandaScore contient leur propre ID.

**Caches :**
- `liq_image_cache.json` — 344 entrées Liquipedia (clé = nom joueur)
- `ps_players_cache.json` — 13 680 entrées PandaScore

```
python photos.py           # télécharge tout (skip si fichier déjà présent)
python photos.py --force   # re-download complet (écrase tout)
python monthly.py photos   # idem --force (appelé automatiquement par monthly.py)
```

**Comportement :**
1. Liq → `images/{player_id}.png` si un fichier Liquipedia existe dans le cache
2. PS  → `images/{player_id}.png` si pas de Liq (fetch API live)
3. `no_photo=True` si aucune source ne trouve le joueur

**Frontend (`resolveImage()` dans cards.ts) :**  
Vérifie simplement si `images/{player_id}.png` existe → `/api/player-image/{player_id}`. Fallback sur `image_url` CDN si absent.

**Scripts de maintenance images :**
- `photos.py` — one-shot ou refresh complet, génère `photos_report.html`
- `monthly.py` — tâche `photos` + `synergy` (tout re-télécharger chaque mois)

### Images teams (logos)
- Source : PandaScore CDN (`image_url` sur `/csgo/teams`)
- Téléchargées dans `output/team_logos/` pendant Phase 2.5
- Fallback lookup : `"FaZe Clan"` → `"faze"`, `"Team Spirit"` → `"spirit"` etc.

### Droits images — statut
- **Photos joueurs & logos teams** : fournis par PandaScore mais droits non transférés (copyright photographe / marque déposée des orgs)
- **Plan V1** : zone grise acceptable à petite échelle, contacter les orgs si traction
- **Plan V2** : remplacer par art IA généré en batch (Flux/Midjourney) — cohérence visuelle, zéro droits, style adapté à la rareté de la carte

### Clé commune : `player_id`
Tout est lié par `player_id` — teams, players, cards, images.

### Temps de scrape
~3-4h (delay=0.3s entre appels localhost)  
Reprise automatique si interrompue grâce à `players_progress.json`

---

## Frontend — État actuel (mai 2026)

### Composants implémentés
- 4 tabs : Pack, Collection, Trade, Profil
- Composants partagés : `TopBar`, `MiniCard`, `XPBar`, `Gem`, `BottomNav`
- Design tokens dans `app/lib/tokens.ts`
- Fonts : Manrope (display/body) + Space Mono (mono) via Google Fonts
- Build propre, zéro erreur TypeScript

### Daily Challenges + Streak (tab Pack)
- `app/lib/challenges.ts` — pool 11 variantes, 5 quests/jour (1 par kind group), seed déterministe par date, localStorage + reset minuit auto, hooks `onPackOpened` / `onCardsObtained` / `onTradeCompleted` / `onCardsDecrafted`
- Nation du jour : ISO2 tiré aléatoirement chaque jour, même nation pour tous les joueurs, affiché avec `<Flag>` inline
- Widget DÉFIS : count réel X/5, barre de progression, countdown jusqu'à minuit avec secondes (live)
- Widget STREAK : UI 7 cases (streak en jours, badge ×XP, hint palier suivant) — logique localStorage complète
- **XP via clic "Récupérer ✦"** : l'XP n'est pas accordé automatiquement — le joueur clique pour récupérer, déclenche une animation shimmer + 8 particules gauche→droite (620ms), puis la quête passe en vue compacte (hauteur ÷2)
- **Tri automatique** : quêtes complétées (done) descendent en bas, quêtes à faire remontent en haut
- **Reroll** : bouton "▶ REROLL · N" sur chaque quête non complétée. Max 3/jour. Pioche dans le pool complet (11 challenges) indépendamment de la catégorie — `complete_trade` est donc rerollable vers n'importe quelle autre quête. Seuls les challenges déjà actifs (par id) sont exclus. Le count restant est affiché directement dans le bouton (`▶ REROLL · 2`), pas dans une ligne séparée.
- **Cap 100 XP/jour** (base avant streak mult) : `getDailyChallenges()` dégrade déterministement la quête la plus chère si le total dépasse 100 (ordre : rarity → open_packs → decraft)
- **Bonus "all complete"** : quand les 5 objectifs sont atteints, le header "DÉFIS DU JOUR" pulse en or et devient cliquable → récompense = total XP du jour × 1.5 arrondi au multiple de 5. Passe ensuite par `addXP()` (streak mult appliqué dessus).
- **Vue compacte post-claim** : checkmark 14px + label 10px + XP 9px, fond vert faint — hauteur ~50% vs vue normale
- **Migration** : si `claimed` absent du localStorage (ancien format), toutes les quêtes `done:true` sont auto-marquées `claimed:true` au chargement
- 540 combinaisons uniques de quests (~1.5 ans sans répétition exacte)

### Pack opening — animation complète
Séquence en 3 phases déclenchée par "Ouvrir →" sur un pack prêt.

**Phase 1 — ouverture du pack (2.4s)**
- Pack shake (anticipation 400ms) → déchirement (top fly -260px rotate -22° / bottom fly +220px rotate 14°)
- Burst de lumière + rayons conic-gradient + 6 particules qui s'échappent
- 5 cartes en éventail jaillissent depuis le centre

**Phase 2 — roue × 5 cartes (6.5s/carte)**
- Roulette horizontale style CS:GO case opening — strip de ~85 tiles défile (pool aléatoire à chaque spin)
- Tiles 64×94px uniforme pendant le spin — identité cachée (photo + nom + rôle à `opacity:0`, rayures visibles) → pas de spoiler
- Tile cible : même taille que les autres, glow légèrement plus fort, identité révélée uniquement au landing
- Décélération cubic-bezier(0.05, 0.85, 0.08, 1) avec jitter final ±12px
- Ticks : sample `csgo-tick-a.wav` joué à chaque tile qui passe le centre, timing calculé par inversion numérique de la courbe d'easing. Drama (volume + pitch) monte sur les 12 derniers ticks avant le landing.
- Landing par rareté (`playLanding`) : même WAV `card-appear.wav` traité différemment par tier (Bronze = flat/sombre → Icon = pitched up + shimmer + cascade)
- Au landing : `.csv-tile--landed` → fade-in photo/nom/rôle (250ms) + fade-out rayures + flash scale 1.08

**Phase 3 — flip reveal (par carte, auto-avancement)**
- La carte apparaît en grand (200×295px) avec animation rotateY(-90deg → 0deg) + léger overshoot à 6° + translateY(40px → 0)
- Sweep de sheen traverse la carte après le flip
- Affiche : photo full-bleed, overall (34px), rôle, drapeau, nom, **full team name** (`card.team ?? card.teamShort`)
- **Pas de bouton** — auto-avancement après 1800ms (550ms flip + ~1250ms de visualisation)
- Après toutes les cartes : écran récap centré + actions de masse

**Phase 4 — récap centré**
- Grille 3+2 de `RecapCard` (photo cards ~120px de large) centrée verticalement sur l'écran
- Le stage et le compteur sont démontés pendant le récap (pas d'espace mort qui décale le contenu)
- Chaque carte est **cliquable** → ouvre `CardDetailModal` (z-index 500, au-dessus du modal pack à 400)
- `CardDetailModal` reçoit `categoryScores` depuis la carte → stats FIR/OPN/CLU/ENT/TRD/IMP affichées

**Actions de masse (sous la grille) :**

3 boutons empilés, avec flow preview→confirm pour les uncraft :

| Bouton | Comportement |
|---|---|
| **TOUT GARDER** | Ferme le modal — toutes les cartes restent en stock |
| **UNCRAFT DUPES · N doublon(s)** | Visible si au moins une carte n'est pas `isNew`. Uncraft les non-new, garde les new en stock. |
| **UNCRAFT RARITY ▾** | Se déploie en ligne de boutons par tier. `BRZ+` `SLV+` `GLD+` `DIA+` `ICN+` — seuls les tiers présents dans le pack sont affichés. `X+` = uncraft X et tous les tiers inférieurs. |

**Flow preview (uncraft) :**
1. Clic sur un bouton uncraft → aperçu : compte de cartes + gemmes par tier (colorées par tier)
2. `ANNULER` → retour au select | `CONFIRMER` → `removeOwnedId` + `addGems` + `onCardsDecrafted` + fermeture

**Calcul gems dans le récap :**
- Montant par rareté : Bronze 5 · Silver 12 · Gold 30 · Diamond 75 · Icon 400 · Legacy 30
- Tier gem : calculé depuis `card.teamRank` (même logique que `CardDetailModal`)
- Les cartes LEGACY sont incluses dans "Uncraft Dupes" mais exclues du filtre "Uncraft Rarity" (non présentes dans `TIER_ORDER`)
- Preview triée TOP5 → TOP100, noms affichés via `GEM_PACK_NAMES` (ex: "S-Tier", "Tier 3") — jamais les clés internes TOPX
- Couleurs : TOP5 `#f5d76e` / TOP15 `#c77dff` / TOP25 `#4cc9f0` / TOP50 `#56d6a4` / TOP75 `#80e0b0` / TOP100 `#8fa3ad`

**Fichiers clés :**
- `app/lib/reveal.ts` — moteur d'animation. Exports : `openPack`, `spinWheel`, `playLanding`, `reset`, `RARITY`. Web Audio API, safe SSR.
- `app/components/PackOpenModal.tsx` — orchestrateur React. Props : `open`, `packLabel`, `cards: RevealCard[]`, `onClose`, `onCardsRevealed`. Gère l'état `selectedCard` pour le modal détail.
- `app/api/pack-open/route.ts` — tire 5 cartes depuis `players_cards.json` avec distribution pondérée par rareté (Bronze 21% / Silver 38% / Gold 31% / Diamond 10% / Icon <1%). Retourne `category_scores` dans la réponse.
- Classes CSS `csv-*` dans `globals.css` (animations pack, wheel, flip)

**Interface `RevealCard` :**
```ts
{ tier, ovr, name, player_id, role, team?, teamShort, teamRank?, nationality, image_offset, categoryScores?,
  isNew?: boolean,      // true = première copie jamais obtenue
  stockCount?: number   // nb de copies possédées AVANT l'ouverture de ce pack
}
```
`team` = nom complet de l'équipe (ex: "Team Vitality") — affiché dans le flip reveal. `teamShort` = fallback si absent.
`categoryScores` = `{ firepower, opening, clutching, entrying, trading, impact }` — passé depuis l'API et transmis à `CardDetailModal` via `revealCardToPortrait()`.  
`teamRank` = rank HLTV de l'équipe — utilisé pour calculer le tier de gems lors d'un Uncraft.

**Banners reveal (flip + récap) :**
`CardBanner` dans `PackOpenModal.tsx` — bandeau diagonal (rotate -12°) affiché sur les cartes au flip reveal et dans le récap :
- **"NEW !"** (fond rouge `#c22828`) → `isNew === true` (première copie)
- **"IN STOCK · X"** (fond ambre `#9a5800`) → doublon, X = `(stockCount ?? 0) + 1` = nouveau total après ce drop
- Sizing proportionnel à `cardW` : `top = cardW * 0.14`, `width = cardW * 1.6`, `h = max(14, cardW * 0.10)`
- Placé à l'intérieur de la carte (`overflow: hidden`) pour être coupé par les bords arrondis

---

### Son des ticks — état de l'art (mai 2026)

**Référence cible :** `CSGO Case Opening Sound Effect.wav` (téléchargé dans Downloads)

**Analyse WAV faite :**
- 16s, 149 impacts détectés
- Les 2 premiers impacts (340ms chacun) = sons d'ouverture, pas des ticks
- Les vrais ticks : durée 1–60ms selon la vitesse de la roue
- Spectral analysis polluée par une nappe 300Hz continue dans tout le fichier → mesures peu fiables pour reproduire le tick isolé
- Le tick a bien **2 sons distincts** (confirmé à l'oreille) : un click haut + un impact secondaire décalé ~9ms

**Ce qui a été essayé (avec feedback) :**

| Approche | Feedback |
|---|---|
| Triangle oscillator + sweep freq 1850→900Hz, 45ms | "clack" trop prononcé |
| Bandpass noise inharmonique (Q=3, 2800Hz) | "boisé, pas assez métallique" |
| Résonateurs inharmoniques (Q=9–14, ratios 1/1.73/2.96, 3200Hz) + compresseur | "pétard" |
| Sinus inharmoniques (sans compresseur, Q modéré) | mieux, mais "faible + boisé" |
| Sinus purs (1.0/1.73) + pitch drop à l'onset + transient HP noise | "plastique/osseux, trop d'écho" |
| Corps 300–480Hz (basé sur analyse WAV) + click 4kHz | "cartonneux" |
| 3 layers : transient broadband 400Hz–8kHz + sine 1500–2000Hz + 4kHz click, tout < 10ms | "pot d'échappement" |
| Même mais HP monté à 1500Hz (coupe le bas) + 4kHz boosté à 85% | "toujours pas assez aigu/métallique" |

**Config active — `reveal.ts` · `scheduleTick` :**

Un seul sample A, pitch rise par tick (chirp métallique), volume monte + pitch monte vers le landing.

```
csgo-tick-a.wav  — tick phase rapide (30ms, centroid 1449Hz, normalisé à 70%)
  Extraction : t=441ms–471ms dans CSGO Case Opening Sound Effect.wav
  (31ms de silence avant, 34ms après — tick le mieux isolé dans la phase rapide)

csgo-tick-b.wav  — inutilisé en config active (conservé pour backup)
  Extraction : t=1355ms–1393ms (centroid 847Hz)

scheduleTick :
  rateStart = 1.5 + t0 * 0.5   → rate 1.5 (fast/drama=0) → 2.0 (slow/drama=1)
  rateEnd   = rateStart * 1.15  → +15% pitch chirp sur 22ms par tick
  t0 = (freq - 1700) / 700

spinWheel :
  drama = Max(0, 12 - remaining) / 12  ← commence 12 ticks avant le landing
  vol   = 0.14 + drama * 0.18          ← quasi-silencieux au début → 0.32 au landing
  gap minimum entre ticks : 22ms
  timing : inverse numérique de cubic-bezier(0.05, 0.85, 0.08, 1) via bisection (28 itérations)
```

---

**Backup — config "double-clic ratchet" (satisfaisant, moins aigu) :**

Chaque tick joue A + B simultanément (B avec 12ms de délai), style roue mécanique.
Pour revenir à cette config, modifier `scheduleTick` et `spinWheel` :

```
Samples :
  A → t=1355ms–1393ms, centroid 847Hz  (choc principal, grave)
  B → t=1241ms–1272ms, centroid 1235Hz (résonance, plus aigu)

scheduleTick (bloc sample) :
  if (_tickBufA) playBuf(_tickBufA, t, 3.0 + t0 * 1.0, vol)
  if (_tickBufB) playBuf(_tickBufB, t + 0.012, 1.6 + t0 * 0.6, vol * 0.55)

spinWheel :
  drama = Max(0, 8 - remaining) / 8
  freq  = 1700 + drama * 400
  vol   = 0.14 + drama * 0.18  (même courbe)
  gap minimum : 22ms
```

Ce qui n'a pas marché : alternance stricte A/B (pattern audible au ralenti) · sélection random (sonne faux) · rate ×4.5+ sur tick lent (étouffé/cartonneux).

---

### Son d'ouverture du pack (mai 2026)

**Source :** `from_claude_design/cs-go-case-pack_appear.wav` (3.0s, stéréo 44100Hz)  
**Copié dans :** `frontend/public/sounds/pack-appear.wav`

```
Timing WAV :
  0–300ms   : silence (skippé via offset)
  300–750ms : montée progressive
  750–900ms : pic principal (rms ~1500)
  900ms+    : décroissance

Alignement sur l'animation openPack (2.4s total) :
  src.start(audio.currentTime, 0.30)  ← skip les 300ms de silence
  → pic WAV (750ms) arrive à ~450ms dans l'animation
  → coïncide avec la déchirure visuelle (css-pack--opening à 400ms)

Preload : déclenché au mount de PackOpenModal (useEffect vide)
  → preloadTickBuffer() charge les 4 WAVs en parallèle :
     csgo-tick-a.wav + csgo-tick-b.wav + pack-appear.wav + card-appear.wav
  → Bug fix : si getAudio() retourne null au mount (pas de geste utilisateur),
    _tickLoadPromise est reset → retry automatique au prochain appel (clic ouverture)
  → fallback synthesis si non chargé (ticks) / silence (pack appear)
```

Fallback openPack (si _packAppearBuf null) : 3 scheduleTick + schedulePackTear + scheduleThud (synthèse).

---

### Son de reveal carte (mai 2026)

**Source :** `from_claude_design/cs-go-case-card_appear.wav` (3.0s, stéréo 44100Hz)  
**Copié dans :** `frontend/public/sounds/card-appear.wav`

```
Timing WAV :
  0–400ms    : silence
  400–700ms  : petit click (rms ~188)
  700ms–1.4s : silence
  1550–1700ms: pic principal (rms ~1696)
  1700ms+    : longue décroissance

Tous les tiers sautent directement au boom (offset ≥ 1.35s) — le petit click initial est skippé.

Variants par rareté (playLanding) — implémentés via offset dans src.start(t, offset) :
  BRONZE  → offset 1.50s, rate ×0.92, brightness −10  (boom sombre)
  SILVER  → offset 1.50s, rate ×1.00, brightness −5   (boom neutre)
  GOLD    → offset 1.50s, rate ×1.00, highpass 80Hz
  DIAMOND → offset 1.45s, rate ×1.06, highpass 120Hz, brightness +5 + shimmer
  ICON    → offset 1.35s, rate ×1.12, highpass 140Hz, brightness +8 + cascade 4 échantillons + 2 shimmers

Timing collision fix :
  playLanding déclenché à duration/1000 + 0.02s (juste après le dernier tick)
```

Fallback playLanding (si _cardBuffer null) : synthèse par rareté.

### Collection — cartes possédées (localStorage)
- `app/lib/owned.ts` — store client basé sur les **counts** (pas un Set) :
  - `KEY = "csv_owned_counts"` → `Record<string, number>` (player_id → nb de copies)
  - Migration automatique depuis l'ancien format Set (`csv_owned_ids`) au premier chargement
  - `getOwnedCounts()` → `Record<string, number>`
  - `getOwnedIds()` → `Set<string>` (pour compat backward)
  - `addOwnedIds(ids[])` → incrémente le count de chaque id, dispatche `window.Event("csv-owned-updated")`
  - `removeOwnedId(id)` → décrémente le count de 1, supprime la clé si 0
  - `bulkRemoveOwned(entries[])` → retire des counts spécifiques pour N ids en **un seul** write + dispatch (utilisé par les flows bulk uncraft)
  - `clearOwned()` → supprime les deux clés localStorage
- Après chaque pack ouvert : `addOwnedIds` persiste les counts + dispatche l'event
- `CollectionGrid` écoute l'event → met à jour `ownedCounts` + `ownedIds` en temps réel sans reload
- **Snapshot pre-pack** : `getOwnedCounts()` capturé AVANT `addOwnedIds` dans `openPack()` → permet de calculer `isNew` et `stockCount` au moment du reveal

### Flag.tsx
Composant drapeau wrappant `flag-icons`. Props : `code` (ISO-2), `width` (défaut 18), `rounded` (défaut true). Render via `className="fi fi-{code}"` + sizing inline. Fallback `null` si code absent. `flag-icons` importé dans `layout.tsx`. Utiliser ce composant — pas de `<span>` inline direct.

### MiniCard — DNA CardHolo
Photo full-bleed, gradient noir bas. Taille défaut **84×124px** (ratio 1.476 — CARD_RATIO = 124/84, ne pas changer pour la grille collection).

Layout :
- TL : overall (24px fw=800) + rôle 3 lettres (6.5px, couleur chrome) en dessous
- TR : `<Flag code={...} width={14} />` — positionné `top: 4` (plus haut qu'avant)
- Bas : nom (12px fw=800) + **team full name** (8px fw=700, F.mono) + panel stats dark optionnel (si `categoryScores` fourni)
  - `p?.team ?? p?.teamShort ?? "SPI"` — prend le full name en priorité
  - Zone bas `right` réservée si triangle actif : `right: triSize > 0 ? triSize + 2 : 8`

Détails visuels :
- Glow halo : `radial-gradient(ellipse, ${chrome.glow}, transparent 70%)`, inset **-6px**, blur **8px**
- Border : `rgba(255,255,255,0.18)`, shadow : `0 8px 22px rgba(0,0,0,0.55)`
- Gradient bas : `transparent 25%, rgba(0,0,0,0.5) 65%, rgba(0,0,0,0.85) 100%`
- Fond : `chrome.bg = linear-gradient(160deg, tier.from, tier.to)` via `rarityChrome()`
- Prop `imageOffset?: string` → CSS `object-position` sur la photo (défaut `"top center"`)

`rarityChrome()` retourne `{ bg, glow, label, from, to }` — `from` et `to` sont les couleurs brutes de la rareté (utilisées notamment pour le triangle de count).

Props supplémentaires :
- `locked?: boolean` → overlay sombre `rgba(6,6,10,0.72)` + rayures diagonales `repeating-linear-gradient(135deg, rgba(255,255,255,0.045) 0px 2px, transparent 2px 11px)` — utilisé pour les cartes non obtenues dans "Toutes"
- `isNew?: boolean` → badge rouge "NEW" TL (zIndex 3, au-dessus du locked overlay)
- `count?: number` → quart de cercle coin bas-droit quand > 1 copie possédée
  - `badgeR = 18` (rayon) — div cercle 36×36px centré sur le coin : `bottom: -badgeR, right: -badgeR`
  - `overflow: hidden` du card body clip le cercle en quart de cercle naturellement (suit le `borderRadius: 8`)
  - Dégradé `linear-gradient(135deg, chrome.from, chrome.to)` — suit la logique visuelle de la carte
  - Chiffre centré sur le centroïde du quart de cercle : `top/left: badgeR * 0.58` + `transform: translate(-50%, -50%)`
  - Font proportionnelle : `fontSize: badgeR * 0.45` (8px pour r=18) — garantit que le chiffre reste dans l'arc quelle que soit la taille
  - Placé **à l'intérieur** du card body (avant le `</div>`) — le clip `overflow:hidden` fait le travail

### CardDetailModal (`components/CardDetailModal.tsx`)
- Photo full-bleed (270×390), gradient `rgba(0,0,0,0.93) → transparent 80%` depuis le bas
- TL : overall (60px fw=800) + tier (9px, couleur chrome)
- TR : `<span className="fi fi-{iso2}">` (22×16px) + rôle plein mot (ENT→"Entry", AWP→"AWPer", etc.)
- Bottom overlay : nom (26px fw=800) + team mono (9.5px) + grille stats 3×2 (18px/7.5px, ligne top séparatrice uniquement, pas de barres entre cellules)
- Stats : 6 `category_scores` (FIR/OPN/CLU/ENT/TRD/IMP) affichés en 3×2. **Non passés aux MiniCards de la grille** (seulement au modal).

**4 boutons en 2×2 sous la carte (270px wide) :**
- Rangée 1 (liens externes) : **HLTV** | **Liquipedia** — s'ouvrent dans un nouvel onglet
  - HLTV : `https://www.hltv.org/player/{player_id}/{name}` — auto depuis le `player_id` JSON (ID HLTV natif)
  - Liquipedia : `https://liquipedia.net/counterstrike/Special:Search?search={name}` — search URL (noms lowercase dans le JSON, Liquipedia est case-sensitive → search toujours fiable)
- Rangée 2 (actions) : **Trade** (grisé, non implémenté) | **Uncraft**

**Uncraft — flow :**
1. Clic "Uncraft" → bouton se transforme en `{X} 💎 {Tier} · Confirmer` (ex: `75 💎 Tier 1.5`, couleur gem du tier) + `✕ Annuler` à gauche
2. Clic confirmation → `removeOwnedId(player_id)` + `addGems(tier, amount)` + `onCardsDecrafted(1)` + fermeture modale
3. Désactivé (grisé) si `ownedCount === 0` (carte non possédée — vue locked dans "Toutes")

**Montants Uncraft :** Bronze 5 · Silver 12 · Gold 30 · Diamond 75 · Legacy 30 · Icon 400  
**Tier gem :** calculé depuis `card.teamRank` — TOP5 (#1–5), TOP15 (#6–15), TOP25 (#16–25), TOP50 (#26–50), TOP75 (#51–75), TOP100 (#76+)  
**Label tier affiché :** `GEM_PACK_NAMES[gTier]` → ex: `S-Tier`, `Tier 1.5`, `Tier 4` (sans "pack")

**Props :** `card: CardPortraitData` (inclut `player_id`, `teamRank`) · `tier: RarityTier` · `ownedCount?: number` · `onClose`  
`ownedCount` passé depuis CollectionGrid (`ownedCounts[player_id]`) et PackOpenModal (`stockCount + 1`).

### Collection
- Données réelles depuis `players_cards.json` via `loadCards()`, cache mémoire dans `cards.ts`
- 4 dropdowns custom : Rarity colorée, Role full name, **TIER** (gem tier, S-Tier → Tier 4), **PAYS** (loot pool)
- Filtre TIER : options statiques `TIER_OPTIONS` depuis `GEM_PACK_NAMES` + `GEM_COLORS`. Filtrage via `cardGemTier(teamRank)` → TOP5/TOP15/.../TOP100. Remplace l'ancien filtre TEAM.
- Images : API route `/api/player-image/[player_id]` — sert local d'abord, redirect CDN Pandascore en fallback. `loadCards()` pointe toujours vers l'API locale.
- `photo_focus` : champ optionnel dans `players_cards.json` (ex: `"photo_focus": "50% 26%"`). Mappé vers `image_offset` dans `CardDisplay` via `loadCards()`. Absent → fallback `"top center"`.
- Rôles : normalisés et dédupliqués (AWPer/Awper/Awp → AWP, etc.), coaches/analysts filtrés

**Layout accordéon (2 sections collapsibles) :**
- `SectionDivider` → header cliquable avec chevron `▼` (rotate -90° quand collapsed), titre, badge count teal
- **"Mes cartes"** : affiche toutes les cartes possédées d'un coup (grid libre, pas de pagination) — typiquement peu nombreuses. Filtres RARITY/ROLE/TIER/PAYS appliqués. Empty state "Connecte-toi" si 0 cartes.
- **"Toutes"** : `CardGrid` paginé (9/page), cartes non possédées affichées avec `locked=true` (overlay rayures diagonales). Filtres appliqués.
- **Une seule pagination** en bas de page, commune aux deux sections, basée sur `filteredAll.length`. `page` state dans `CollectionGrid`, passé en prop à `CardGrid` (stateless côté pagination). Reset à 0 sur changement de filtre.

**Bulk uncraft — 2 méthodes (section "Mes cartes") :**

Barre d'actions sous le header "Mes cartes" (visible seulement quand la section est dépliée et qu'on possède au moins 1 carte).

| Mode | Déclencheur | Portée |
|---|---|---|
| **DOUBLONS ×N** | Bouton rouge, visible si N > 0 duplicatas | Toutes les cartes possédées en >1 exemplaire, INDÉPENDAMMENT des filtres actifs. Garde 1 copie, décraft les extras. |
| **SÉLECTIONNER** | Bouton teal | Mode sélection : tap sur les cartes pour cocher/décocher (ring teal + checkmark). Bar flottante `DÉCRAFT · N` apparaît au-dessus de la BottomNav quand ≥1 sélectionné. Décraft 1 copie par carte sélectionnée. |

Après confirmation, les deux modes appellent `bulkRemoveOwned` + `addGems` par tier + `onCardsDecrafted(total)`.

**`BulkUncraftModal`** — modal de confirmation partagé par les deux flows :
- Titre + nombre de cartes
- Tableau gems par gem tier (couleur tier · label · ×count · total 💎)
- Boutons Annuler / Confirmer

**Architecture CardGrid :**
```
CollectionGrid (page state ici, totalPages basé sur filteredAll)
  ├── Section "Mes cartes"
  │     ├── Action row — [DOUBLONS ×N] [SÉLECTIONNER] ou [N sélectionnées] [✕ ANNULER]
  │     └── mineCards.map() avec overlay sélection si selectMode
  ├── Section "Toutes"    — CardGrid(page=page, cards=filteredAll)
  ├── Pagination unique   — −10 / Préc. / Suiv. / +10
  └── Floating bar fixe  — DÉCRAFT · N (z-index 310, bottom 72px, selectMode + selectedIds.size > 0)
```

**Sizing des cartes :**  
`ResizeObserver` sur la largeur du container uniquement → `cardW = (containerWidth - 14*2 - 8*2) / 3`, `cardH = cardW * CARD_RATIO`. Pas de hauteur fixe, le container est `overflowY: auto`.

### Filtre PAYS — loot pool hebdomadaire
- `data_pipeline/output/loot_pool.json` — liste des `player_ids` du pool actuel + `week` + `expires_at`
- `loadLootPool()` dans `cards.ts` — lit le fichier, retourne les codes ISO-2 des joueurs du pool
- Dropdown PAYS toujours visible (appliqué aux deux sections)
- **Règle d'affichage** : pays avec 5+ joueurs dans le dataset full → entrée individuelle avec drapeau ; <5 joueurs → regroupé par région
- **Ordre** : pays individuels triés par count desc, puis régions triées par count desc
- **Régions définies** (`REGIONS` dans `CollectionGrid.tsx`) :
  - `EU_EST` → BA, EE, HR, HU, LT, ME, MK, RS, SK, XK
  - `EU_NORD` → FI, IS, NO
  - `EU_OUEST` → BE, CH, NL
  - `AMER_SUD` → CL, GT, PE, UY
  - `MOYEN_ORIENT` → IQ, JO, LB
  - `OCEANIE` → NZ · `AFRIQUE` → ZA · `ASIE_CENT` → UZ
- Pour mettre à jour le loot pool chaque semaine : modifier uniquement `loot_pool.json` (week + expires_at + player_ids), le dropdown se met à jour automatiquement

### Références design (`from_claude_design/`)
- `big_card_focus.html` — référence modale focus (portrait 270×390, photo full-bleed, gradient noir fort en bas, grille stats 3×2)
- `A _ Grid foil 3 col.html` — grille 3 colonnes (84×124) : overall 24px, rôle 3 lettres TL, nom 12px, team 6.5px, drapeau TR
- `D _ Portrait _m_me DNA_.html` = référence visuelle principale CardHolo
- `cs vib_new_cards_visual/` (ui.jsx + screens.jsx) — nouveau dossier de référence UI
- Rarity chromes déjà corrects dans `tokens.ts` (DIAMOND, GOLD, SILVER, BRONZE, ICON, LEGACY)

> Design premium dark (pas neon, pas gacha) — rester dans l'espace "Sorare/VALORANT companion". Ne pas ajouter de couleurs saturées ou d'animations de glow.

---

## Architecture CSS — Learnings

### App shell pattern (`globals.css`)
```css
html { height: 100%; overflow: hidden; display: flex; justify-content: center; }
body { height: 100%; overflow: hidden; max-width: 430px; }
main { height: 100%; overflow: hidden; }
```
→ Empêche tout scroll au niveau document. Chaque page gère son propre scroll.

### Pattern par page
- `height: "100%"` (pas `minHeight`) sur le wrapper page
- **Scrollable** (Packs, Collection) : `overflowY: "auto"` sur le wrapper
- **Fixe** (Trade, Profil) : pas d'overflow → le contenu doit tenir dans l'écran

### Z-index hierarchy
- Contenu : < 200
- Dropdowns : 200
- BottomNav : 300 (doit être > dropdowns)
- Floating selection bar (bulk uncraft) : 310 (au-dessus de la nav)
- CardDetailModal : 500
- BulkUncraftModal : 600
→ Si on ajoute des overlays, respecter cette hiérarchie.

### Dropdowns `position: fixed`
Les dropdowns `position: absolute` étendent le scroll du document même dans un container `overflow: hidden`. Solution : `position: fixed` + `getBoundingClientRect()` au clic pour calculer `top/left/width`. Voir `FilterDropdown` dans `CollectionGrid.tsx`.

### `maxHeight` inline ignoré par Turbopack
Dans ce setup Next.js 16 + Turbopack, `maxHeight` en inline style React n'est pas appliqué de façon fiable. Solution : classe CSS dans `globals.css` avec `!important`.
```css
.filter-dd { max-height: 220px !important; overflow-y: auto !important; }
```

### Grille de cartes adaptative
- `gridTemplateRows: repeat(3, 1fr)` + `height: 100%` + `aspect-ratio` → conflit CSS, cartes carrées/décalées au zoom
- **Solution fiable : `ResizeObserver` sur la largeur du container uniquement.** Ne jamais mesurer la hauteur.
- Formule : `cardW = floor((containerWidth - PAD*2 - GAP*2) / 3)`, `cardH = floor(cardW * CARD_RATIO)`
- Le container est `overflowY: auto` (scrollable), la grille n'a pas de `gridTemplateRows` forcé
- `height: 100%` dans un flex container avec `alignItems: center` ne donne PAS la hauteur du container — utiliser `alignItems: stretch` ou des px explicites

---

## GRID Open Access

Accepté sur portal.grid.gg, clé API dans `.env` (`GRID_API_KEY`).
- Header : `x-api-key` (pas `x-auth-key`)
- Base URL : `https://api-op.grid.gg/`
- CS2 = titleId `28`

### Données disponibles
~1876 séries CS2 (oct-déc 2023) + 7202 (2024) + 6654 (2025) → historique depuis oct 2023.

### ⚠️ Limitations critiques
- **TIER 1 = ZÉRO DATA.** Vitality, NaVi, G2, Spirit, FaZe, MOUZ — aucun match accessible. BLAST/IEM/ESL Pro League/Majors (sauf open qualifs) bloqués. Seul le tier 2/3 est dispo (CCT, ESEA, Thunderpick...).
- **Données joueurs bloquées :** fullName, age, imageUrl, nationality → on garde Pandascore pour ça
- **Conséquence :** pas d'intégration GRID pour le calcul des category_scores (déséquilibre tier 1 vs tier 2). GRID réservé pour features distinctes (ex: derniers matchs tier 2/3).

### Endpoints utiles
- `POST /central-data/graphql` — allSeries (par période/titleId), players (id/nickname/team), teams, tournaments
- `POST /live-data-feed/series-state/graphql` — seriesState(id), latestSeriesStateByPlayerId(id)

### Stats joueur par match (SeriesPlayerState)
kills, deaths, firstKill, killAssistsGiven, killAssistsReceived, multikills (doubles/triples/aces), weaponKills (par arme), teamkills, selfkills, structuresDestroyed, structuresCaptured, objectives

---

## Bugs connus

### Mobile touch non fonctionnel
Dropdowns RARITY/ROLE/TIER non cliquables sur mobile. Fixes `touchstart` + `touchAction: "manipulation"` appliqués mais insuffisants.
- Piste probable : z-index BottomNav couvrant les éléments, ou règle `touch-action` dans `globals.css`, ou overflow clipping parent
- À investiguer : `BottomNav.tsx` z-index, `globals.css`, `layout.tsx` overflow
- Note : le toggle Toutes/Mes cartes a été supprimé → remplacé par les `SectionDivider` accordéons

---

## Navigation — Phone First

Site web **phone-first** : la nav est pensée pour mobile, c'est ok si sur desktop ça se sent.

**4 tabs (bottom nav) :**

| Tab | Contenu |
|---|---|
| **Pack** | Deux queues (daily + bonus). Flow : Claim → timer → Accélérer pub(s) → Ouvrir. Streak widget. Défis du jour. Banner Major si actif. |
| **Collection** | Mes cartes (défaut) + toggle "Toutes les cartes". Filtres : équipe, rareté, nation. |
| **Trade** | Marché passif want/have. Mes offres, ma wishlist, matches en attente, slots restants. |
| **Profil** | Level + XP, rank CS/Faceit/ESEA affiché, showcase 5 cartes favorites, gemmes par tier, gem shop, settings. |

---

## Mécaniques de jeu

### Pack

**Deux queues indépendantes — daily et bonus**

```
Daily queue  (N slots, croît avec le streak)
├── Spawn interval : 24h / N  (N=1→/12h, N=2→/12h staggeré, N=3→/8h, N=4→/6h)
├── Flow : spawn → Claim → timer 1h → Accélérer pub(s) → Ouvrir
├── XP : base × streak_mult
└── Drop : base + streak boost

Bonus queue  (1 slot fixe, toujours disponible — ex-ads)
├── Add pack : ▶ Obtenir (1 pub), cooldown 6h, timer démarre immédiatement
├── Flow : ▶ Obtenir → timer 1h → Accélérer pub(s) → Ouvrir
├── XP : base × streak_mult × 1.2   ← toujours supérieur au daily
└── Drop : daily_drop × (Gold ×1.15 · Dia ×1.08 · Icon ×1.05)  ← toujours supérieur

5 cartes par pack
```

**Flow détaillé — daily/milestone :**
```
1. Pack spawn dans la queue (état "À CLAIM")
2. User clique "Claim →" → timer 1h démarre
3. User clique "▶ Accélérer X/Y" → réduit au palier suivant
4. Sur le dernier palier (instant) : bouton devient "▶ Ouvrir" → pub + ouverture en 1 clic
5. Quand prêt sans pub : bouton "Ouvrir →" (sans ▶)
```

**Convention boutons — signe ▶ = pub requise :**
- `▶ Obtenir` — débloquer le pack bonus (1 pub)
- `▶ Accélérer X/Y` — pub intermédiaire (réduit au palier suivant)
- `▶ Ouvrir` — dernière pub, pack s'ouvre immédiatement après
- `Ouvrir →` — pack prêt, aucune pub requise
- `Claim →` — réclamer un pack disponible (gratuit, sans pub)

**Skip timer — incrémental, universel (s'applique à TOUS les slots des deux queues)**

Chaque pub réduit au palier suivant. Dernier palier = instant (ouvre directement). Max 3 pubs.

```
Timer initial │ Pub 1     │ Pub 2     │ Pub 3
──────────────┼───────────┼───────────┼────────
1h            │ → 10 min  │ → instant │ —
2h            │ → 30 min  │ → 10 min  │ → instant
4h            │ → 1h      │ → 10 min  │ → instant
6h            │ → 1h      │ → 10 min  │ → instant
8h            │ → 1h      │ → 10 min  │ → instant
12h           │ → 2h      │ → 30 min  │ → instant
```

**Pack gem crafté** (timer selon le tier — inchangé, utilise la même table de skip) :
```
TOP 100 :  1h   TOP 75 :  2h   TOP 50 :  4h
TOP 25  :  6h   TOP 15 :  8h   TOP 5  : 12h
```

Plus le pack est rare → plus l'attente est longue → plus de pubs nécessaires pour skipper.  
Revenue ads naturellement proportionnel à la valeur du pack.

### Formule de drop rate
La probabilité de drop d'une carte rare est pondérée par :
```
drop_weight = overall_score × (1 + mvp_bonus) × team_score × trophy_bonus

  overall_score  = score normalisé 0-99 du joueur
  mvp_bonus      = mvp_count × 0.15  (chaque MVP ajoute 15%)
  team_score     = 1 + (100 - team_placement) / 100  (équipe #1 = 2.0, #100 = 1.0)
  trophy_bonus   = 1 + major_wins × 0.25 + top20_count × 0.05
```
→ Les meilleures cartes sont naturellement plus rares sans avoir besoin de tables de rareté fixes.

**Buff événement tier S (non-Major) — hebdomadaire**
Après un event tier S, les joueurs des équipes semi-finalistes et finalistes reçoivent un multiplicateur temporaire sur leur `drop_weight` dans le daily pack, actif jusqu'au prochain weekly refresh :

| Placement | Multiplicateur |
|---|---|
| Winner | ×2 |
| Finalist | ×2 |
| Semifinalists | ×2 |

Impact dans le pool global (~500 joueurs) : les ~20 joueurs concernés passent de ~5% à ~9.5% des drops combinés — perceptible sans déséquilibrer le pool.
Source placement : csapi.de `/events/{id}/team/{team_id}/stats` → champ `placement`.

### Système de gemmes (décraft)
Les gemmes sont **tiérisées par ranking d'équipe** — chaque tier est une monnaie séparée, non-convertible entre tiers.

### Nomenclature des tiers de gemmes

| Clé interne | Party name | Tier label | Équipes |
|---|---|---|---|
| TOP5 | **CHOSEN FEW** | S-Tier | #1 → #5 |
| TOP15 | **PRETENDERS** | Tier 1 | #6 → #15 |
| TOP25 | **GATEKEEPERS** | Tier 1.5 | #16 → #25 |
| TOP50 | **GRINDERS** | Tier 2 | #26 → #50 |
| TOP75 | **PICK'EM KILLERS** | Tier 3 | #51 → #75 |
| TOP100 | **NO LAN NO FAME** | Tier 4 | #76 → #100 |

Constantes dans `tokens.ts` :
- `GEM_PARTY_NAMES` → nom "party" du tier (ex: `TOP5 = "CHOSEN FEW"`)
- `GEM_PACK_NAMES` → label court sans "pack" (ex: `TOP5 = "S-Tier"`, `TOP25 = "Tier 1.5"`)

**`app/lib/gems.ts` — store client (localStorage)**
- Clé `csv_gems` → `Record<string, number>` (tier → count)
- `getGems()` → counts courants
- `addGems(tier, amount)` → incrémente + dispatche `window.Event("csv-gems-updated")`
- `removeGems(tier, amount)` → décrémente (clamp 0, supprime la clé si vide) + dispatche event
- TopBar level pill et tab Profil écoutent `csv-gems-updated` → mise à jour temps réel sans reload
- `removeOwnedId(id)` ajouté à `owned.ts` — décrémente le count, supprime la clé si 0

**TopBar — layout**

```
[LVL pill (hover→gems)]  [████████░░░░ → Silver IV · +1 Pack]
                          ↑ barre 16px, next level overlayé à droite
```

- **Level pill** (gauche, `flexShrink: 0`) : `LVL N` + nom rank, fond gold translucide. Hover → dropdown gems (`GEM_PACK_NAMES[tier]` + count).
- **XP bar** (droite, `flex: 1`) : hauteur **16px**, barre avec fill gradient gold/crimson. Next level text **overlayé à l'intérieur** à droite — `→ Silver IV` (8px, blanc 82%, textShadow) + récompense (7.5px, teal). Hover → tooltip centré `max-content` avec `X / Y XP` en baseline-align.
  - Récompenses par palier (`nextLevelReward(nextLevel)`) :
    - Lvl 7 → `Pack TOP100` · Lvl 18 → `Pack TOP25` · Lvl 28 → `Pack TOP10` · Lvl 41 → `Pack ICON`
    - Faceit + ESEA → `+Pack · Gems` · Silver/Gold/MG/LE → `+1 Pack`
- Pas de fond ni bordure sur le wrapper du TopBar — transparent comme le reste de la page.

**UI gems — tab Profil (`app/profil/page.tsx`)**
- Seuil craft : `CRAFT_THRESHOLD = 250` gems par tier
- Chaque row : `GEM_PACK_NAMES[tier]` (`S-Tier`) en gras 11px + `GEM_PARTY_NAMES[tier]` (`CHOSEN FEW`) en mono 8px faint en dessous
- Barre de progression : `amount / 250 × 100%` — pleine = pack craftable
- Quand `amount >= 250` : la barre est remplacée par un badge **PACK DISPO** centré, couleur du tier, animation `gem-pulse` (glow respirant 1.8s, style "NEW!" des cartes)
- Système Convertir (bouton toggle, panel inline) :
  ```
  100 NO LAN NO FAME → 10 PICK'EM KILLERS    boutons ×1 · ×10 · ×100 · ALL
   10 PICK'EM KILLERS →  1 GRINDERS           boutons ×1 · ×10 · ×100 · ALL
    5 GRINDERS        →  1 GATEKEEPERS        boutons ×1 · ×10 · ×100 · ALL
    5 GATEKEEPERS     →  1 PRETENDERS         boutons ×1 · ×10 · ×100 · ALL
    5 PRETENDERS      →  1 CHOSEN FEW         boutons ×1 · ×10 · ×100 · ALL
  ```
  - Chaque bouton activé si `gems[from] >= cost × times` ; ALL = `Math.floor(gems[from] / cost)`
  - Clic → `removeGems(from, cost × times)` + `addGems(to, gain × times)` → event → UI live

**Décraft (carte → gems) — tier de l'équipe du joueur, montant selon la rareté :**

| Rareté | Gemmes |
|---|---|
| Bronze | 5 |
| Silver | 12 |
| Gold | 30 |
| Diamond | 75 |
| Event MVP | 150 |
| Icon | 400 |

**Craft (gems → pack) :**
- 250 gems d'un tier → pack thématique garanti dans ce tier (ex: 250 GRINDERS → 1 Tier 2 pack)
- Lors du craft : afficher party name + full pack name (`CHOSEN FEW — S-Tier pack`)
- Choix : par équipe (joueur garanti de l'équipe) OU par nationalité (filtre sur `nationality`)

**Conversion ascendante (sink pour Bronze/Silver)**
```
100 NO LAN NO FAME (TOP100) → 10 PICK'EM KILLERS (TOP75)
 10 PICK'EM KILLERS (TOP75) →  1 GRINDERS (TOP50)
  5 GRINDERS (TOP50)        →  1 GATEKEEPERS (TOP25)
  5 GATEKEEPERS (TOP25)     →  1 PRETENDERS (TOP15)
  5 PRETENDERS (TOP15)      →  1 CHOSEN FEW (TOP5)
```
- Donne de la valeur aux doublons Bronze/Silver
- Taux punissants : NO LAN NO FAME → CHOSEN FEW nécessite ~125 000 gems (pratiquement impossible)
- Usage réel : 1-2 tiers au-dessus (ex: 2500 NO LAN NO FAME → 250 PICK'EM KILLERS → 1 Tier 3 pack)

> ⚠️ Équilibrage national à prévoir : certaines nations (Danemark, France) sont sur-représentées dans les hauts tiers → à ajuster en V2 (coût variable selon la densité de joueurs par nation/tier)

---

## Système de Level (XP)

### Progression — 41 niveaux calqués sur CS

**Phase 1 — CS2 Ranks (18 niveaux)**
```
Silver I → Silver II → Silver III → Silver IV → Silver Elite → Silver Elite Master
Gold Nova I → II → III → Master
Master Guardian I → II → Elite → Distinguished Master Guardian
Legendary Eagle → Legendary Eagle Master
Supreme Master First Class → Global Elite
```

**Phase 2 — Faceit (10 niveaux)**
```
Faceit Level 1 → 2 → 3 → ... → 10
```

**Phase 3 — ESEA (13 niveaux)**
```
D- → D → D+ → C- → C → C+ → B- → B → B+ → A- → A → A+ → S
```

### XP par source

**XP par carte obtenue dans un pack :**
```
Bronze     →   1 XP
Silver     →   2 XP
Gold       →   5 XP
Diamond    →  12 XP
Event MVP  →  25 XP
Icon       →  60 XP
```

**Multiplicateur selon le pack ouvert :**
```
Pack daily            × streak_mult (×1.05 → ×1.50 selon la progression streak)
Pack ads              × streak_mult × 1.2   (toujours supérieur au daily)
Mécanique Major       × 1.5
```

**XP hors pack :**
```
Connexion quotidienne          →   5 XP
Trade complété                 →  15 XP  (indépendant de qui on trade)
Craft pack gems — selon tier   →  TOP100: 20 / TOP75: 30 / TOP50: 45
                                   TOP25: 65 / TOP15: 85 / TOP5: 120
```

**XP daily challenges (5/jour, reset minuit) :**
```
Ouvrir 1/2/3 packs            →  10 / 18 / 25 XP  (1 variante tirée au sort)
Obtenir Silver+ / Gold+ / Diamond+  →  10 / 20 / 35 XP
Compléter 1 trade             →  15 XP
Décraft 1 / 3 / 5 cartes     →   5 / 10 / 18 XP
Joueur nation du jour         →  15 XP  (nation ISO2 tirée aléatoirement chaque jour)
─────────────────────────────────────────────────────
Max 5/5 complétés             →  ~80 XP/jour
Casual (~3/5)                 →  ~40 XP/jour
Optimal (~4.5/5)              →  ~70 XP/jour
```

### Courbe XP — seuils implémentés (41 niveaux)

Calibration : Silver III atteignable fin semaine 1 casual (~623 XP). Tous les seuils ×4 vs V1 (recalibrés avec les daily challenges).

**XP moyen par pack (distribution réelle) :**
```
E[XP/carte] = 0.21×1 + 0.38×2 + 0.31×5 + 0.095×12 + 0.005×60 ≈ 3.96 XP
Daily pack  (×1.0) → ~20 XP/pack
Bonus pack  (×1.2) → ~24 XP/pack
```

**XP moyen par challenge (avg sur variantes) :**
```
open_packs    : (10+18+25)/3          = 17.7 XP
obtain_rarity : (10+20+35)/3          = 21.7 XP
complete_trade:                          15   XP
decraft       : (5+10+18)/3           = 11   XP
obtain_nation :                          15   XP
─────────────────────────────────────────────────
Max 5/5 complétés                     = 80.4 XP/jour
```

**Simulation par profil — avec challenges (5/jour) :**

| Source | Casual | Optimal |
|---|---|---|
| Login | 5 XP | 5 XP |
| Packs (2 vs 6/jour) | ~44 XP | ~136 XP |
| Challenges (~3/5 vs ~4.5/5) | ~40 XP | ~70 XP |
| **Total/jour** | **~89 XP** | **~211 XP** |

*Détail challenges casual : open_packs 2/3 complétable (9 XP), rarity quasi always (18 XP), trade 2×/sem (4 XP), decraft 1×/sem (1 XP), nation ~50% match (8 XP)*
*Détail challenges optimal : toutes quasi systématiques sauf trade (80%) et decraft (70%)*

**Progression semaine 1 (7j) :**
```
Casual  →  ~623 XP  →  Silver Elite (lvl 5)
Optimal →  ~1 477 XP  →  Gold Nova II (lvl 8)
```

**Progression mois 1 (30j) :**
```
Casual  →  ~2 670 XP  →  Master Guardian I (lvl 11)
Optimal →  ~6 330 XP  →  Faceit 2 (lvl 20)
```

**Temps pour atteindre les caps :**
```
                    Casual     Optimal
Global Elite (5k XP)   ~8 sem     ~3.5 sem
Faceit 10 (14.5k XP)   ~23 sem    ~10 sem
ESEA S (20k XP)        ~32 sem    ~14 sem
```

> Note : les challenges doublent environ la progression casual vs packs seuls (305 → 623 XP/sem).
> Si la courbe XP doit être maintenue à l'ancienne vitesse, multiplier tous les xpStart par ~1.5.

**Phase 1 — CS2 (niveaux 1–18) :**
```
1  Silver I               →      0 XP
2  Silver II              →    240 XP
3  Silver III             →    620 XP   ← fin semaine 1 casual
4  Silver IV              →  1 120 XP
5  Silver Elite           →  1 800 XP
6  Silver Elite Master    →  2 640 XP
7  Gold Nova I            →  3 680 XP
8  Gold Nova II           →  4 920 XP
9  Gold Nova III          →  6 400 XP
10 Gold Nova Master       →  8 120 XP
11 Master Guardian I      → 10 080 XP
12 Master Guardian II     → 12 240 XP
13 Master Guardian Elite  → 14 560 XP
14 Distinguished MG       → 16 720 XP
15 Legendary Eagle        → 18 200 XP
16 Legendary Eagle Master → 19 120 XP
17 Supreme MFC            → 19 640 XP
18 Global Elite           → 20 000 XP   (~32 sem casual / ~14 sem optimal)
```

**Phase 2 — Faceit (niveaux 19–28) :**
```
19 Faceit 1  → 22 000 XP
20 Faceit 2  → 24 400 XP
21 Faceit 3  → 27 200 XP
22 Faceit 4  → 30 400 XP
23 Faceit 5  → 34 000 XP
24 Faceit 6  → 38 000 XP
25 Faceit 7  → 42 400 XP
26 Faceit 8  → 47 200 XP
27 Faceit 9  → 52 400 XP
28 Faceit 10 → 58 000 XP   (~93 sem casual / ~39 sem optimal)
```

**Phase 3 — ESEA (niveaux 29–41) :**
```
29 ESEA D-  → 60 400 XP
30 ESEA D   → 63 000 XP
31 ESEA D+  → 65 800 XP
32 ESEA C-  → 68 000 XP
33 ESEA C   → 70 000 XP
34 ESEA C+  → 71 800 XP
35 ESEA B-  → 73 400 XP
36 ESEA B   → 74 800 XP
37 ESEA B+  → 76 000 XP
38 ESEA A-  → 77 000 XP
39 ESEA A   → 78 000 XP
40 ESEA A+  → 79 000 XP
41 ESEA S   → 80 000 XP   (~128 sem casual / ~54 sem optimal)
```

### Récompenses par palier
*(à équilibrer — grandes lignes)*

| Palier | Récompense |
|---|---|
| Chaque rank Silver | +1 free pack |
| Gold Nova I | Pack thématique TOP100 |
| Global Elite | Pack thématique TOP25 |
| Chaque Faceit level | +1 free pack + gems bonus |
| Faceit 10 | Pack thématique TOP10 |
| Chaque ESEA rank | +1 free pack + gems bonus |
| ESEA S | Pack Icon garanti |

### Prestige
- À ESEA S : option de reset au niveau 1 contre un badge **Prestige X**
- Les récompenses de palier sont regagnées (double dip)
- Le badge Prestige est visible sur le profil public et dans les trades

### XP Leaderboard saisonnier
- Classement global XP réinitialisé chaque trimestre
- Récompenses pour le top du leaderboard à la fin de chaque saison

---

## Mécanique Major

**Le Major n'est PAS un pack** — c'est une mécanique de bet sur les performances réelles.

### Flow
```
Pendant le Major
  → banner dans le tab Pack signale le Major actif
  → user choisit 1 joueur par tier (5 tiers, slots unlockés via pubs)
  → carte créée : joueur connu, stats cachées
  → tu paries sur sa perf pendant le tournament

Fin du Major
  → scrape stats via /events/{id}/team/{team_id}/stats
  → révélation simultanée sur toutes les cartes Major collectées
  → stats basées sur la vraie performance de l'event
```

### Tiers basés sur le ranking HLTV au moment du Major
Les 16 teams du Major classées par ranking HLTV :
```
Tier 1  →  teams ranked #1-3   du Major
Tier 2  →  teams ranked #4-7
Tier 3  →  teams ranked #8-11
Tier 4  →  teams ranked #12-14
Tier 5  →  teams ranked #15-16
```

### Unlock par pubs
```
Slot Tier 1  →  3 pubs
Slot Tier 2  →  2 pubs
Slot Tier 3  →  1 pub
Slot Tier 4  →  1 pub
Slot Tier 5  →  1 pub
─────────────────────────
Complet      →  9 pubs
```
Le user peut n'unlock que les slots qui l'intéressent.

- Cartes non-droppables après la fin → Legacy immédiat
- Stats potentiellement très fortes (peak performance) = ultra désirables
- 9 pubs par Major complet = meilleur revenu ads du jeu

---

## Cycle de vie d'une carte

### Versioning
Chaque carte a une version `vX.Y` :

| Événement | Action | Ancienne carte |
|---|---|---|
| EVP gagné | Update stats silencieux | Pas de version bump |
| Player gagne MVP | v1 → v1.1 créée | v1 → Legacy |
| Nouveau classement TOP20 HLTV détecté | v1 → v1.x créée + tag "HLTV Top X YYYY" | v1 → Legacy |
| Player change d'équipe | v1 → v2 créée | v1 → Legacy |

```
Weekly refresh détecte :
  evp_count augmente                         → update stats, pas de version
  new["team"] != old["team"]                 → Legacy + v2 créée
  new["mvp_count"] > old["mvp_count"]        → Legacy + v1.1 créée
  new["top20_count"] > old["top20_count"]    → Legacy + v1.x créée, tag "HLTV Top X YYYY"
  sinon                                      → update silencieux des stats
```

> Un joueur classé plusieurs années de suite génère autant de Legacys distinctes (une par classement), chacune figée avec son année et son rang.

- La carte Legacy est **figée** à l'instant T — plus jamais mise à jour par HLTV
- Plus droppable dans les packs → devient rare naturellement
- v1, v1.1, v2 d'un même joueur peuvent coexister dans différentes collections

### Tag "Event Champions"
Quand l'équipe d'un joueur gagne un event tier 1 (IEM / BLAST / PGL hors Major), la carte **active** reçoit un tag `"IEM Katowice 2025 Champions"` — elle ne passe pas Legacy.

- Tag affiché sur la MiniCard et dans le modal (badge visuel + texte)
- La carte reste droppable et mis à jour normalement
- Si l'équipe gagne un autre event → le tag est remplacé par le plus récent
- Source : PandaScore `/csgo/tournaments` (winner + tier S/A) — à ajouter au weekly refresh
- Champ dans `players_cards.json` : `"event_champion": "IEM Katowice 2025"` (null si aucun)

### Classement top 100 dynamique
Le scrape hebdo couvre un pool élargi (~250 teams) mais seules les top 100 sont droppables.
~5% de rotation par semaine (teams qui entrent/sortent).

```
Joueur sort du top 100
  → is_active: false
  → stats figées (plus de weekly update)
  → plus droppable dans les packs

Joueur re-rentre dans le top 100
  → is_active: true
  → stats remises à jour (reprend le weekly update)
  → redroppable — MÊME carte, pas de nouvelle version

Sauf si pendant son absence :
  → team switch         →  v2 créée
  → MVP gagné           →  v1.1 créée
  → event tier 1 gagné  →  v1.1 créée
```

La carte est une **identité persistante** du joueur — elle vit, dort, se réveille.

### Saisons (calées sur les Majors CS2 — 2/an)
Pas de reset des cartes — juste un marqueur de saison sur les nouvelles cartes créées.

---

## Cartes

### Raretés vanilla (hors Legacy et Major edition)

| Rareté | Seuil overall | Distribution réelle | Condition extra |
|---|---|---|---|
| Bronze | 0 – 45 | 21% (105/500) | — |
| Silver | 46 – 55 | 38% (190/500) | — |
| Gold | 56 – 67 | 31% (154/500) | — |
| Diamond | 68 – 89 | 10% (48/500) | — |
| Icon | ≥ 90 | <1% (3/500) | ET `mvp_count > 0` OU `top20_count > 0` |

> Icon nécessite une reconnaissance individuelle réelle — bloque les joueurs de circuits faibles avec petit N et rating gonflé.  
> La formule overall intègre déjà les achievements dans le score → pas de fallback `rating ≥ 1.35` nécessaire.

### Formule overall (0-99)

Voir section **Formule overall — implémentée** dans Data Pipeline ci-dessus.

### Stats carte (0-99)
- **Overall** : formule composite (voir ci-dessus)
- **6 scores catégorie** (calculés depuis csapi.de) :

| Catégorie | Source stat | Range calibrée |
|---|---|---|
| `firepower` | ADR | 45 – 110 |
| `opening` | swing (K–D diff/map) | -4 – 8 |
| `clutching` | KAST % | 55 – 88 |
| `entrying` | K/map | 8 – 26 |
| `trading` | K÷D ratio | 0.55 – 2.1 |
| `impact` | rating | 0.75 – 1.65 |

### Visuels à prévoir
- Badge `is_new` sur les cartes fraîchement obtenues
- Distinction visuelle Legacy vs versions actives
- Indicateur de version (v1, v1.1, v2) sur la carte

---

## Monetisation

### Modèle retenu (V1)
- **Pas d'achats in-game** → zéro régulation gambling, zéro complexité légale
- **Ads display** sur le site (Google AdSense)
- **Rewarded ads** : regarder une pub pour réduire ou skipper le timer d'ouverture de pack

### Formats publicitaires
| Format | Réseau | RPM estimé |
|---|---|---|
| Rewarded (skip timer) | AdMob / Unity Ads | 5–15€ /1000 vues |
| Banner site | Google AdSense | 1–3€ /1000 vues |
| Interstitiel entre packs | AdMob | 3–8€ /1000 vues |

---

## Aspect légal

| Sujet | Statut |
|---|---|
| **Stats & données** (csapi.de, PandaScore, Liquipedia) | ✅ Commercial OK — voir détail sources |
| **Ads (display, rewarded)** | ✅ OK — aucune source n'interdit la monétisation ads |
| **Noms des joueurs** | ✅ Fan project = risque très faible |
| **Gambling** | ✅ Zéro achat réel → hors régulation |
| **Photos joueurs** (PandaScore CDN) | ⚠️ Droits non transférés par l'API — zone grise V1, remplacer par IA en V2 |
| **Logos teams** (PandaScore CDN) | ⚠️ Marques déposées des orgs — zone grise V1, contacter les orgs si traction |
| Scraping HLTV (ancienne approche) | ❌ ToS interdit usage commercial — abandonné |

**Attribution obligatoire** (footer) :
> `Data: csapi.de · PandaScore · Liquipedia.net`

**Plan images V2** : générer en batch via IA (Flux/Midjourney API) — portrait stylisé par rôle + rareté, cohérence visuelle garantie, zéro droits.

---

## Système de Trade

### Modèle : marché passif want/have
Pas de friend-to-friend — un marché où les joueurs taguent leurs cartes et leur wishlist, le système matche automatiquement.

```
Flow
  → tu tagges tes cartes "à trader" dans ta collection
  → tu tagges tes cartes en "wishlist"

Match détecté :
  A a card X (tagged trade) + veut card Y
  B a card Y (tagged trade) + veut card X
  → notif email aux deux parties + badge in-app sur le tab Trade
  → les deux confirment en 1 tap
  → slot consommé à la confirmation
  → match expire en 7 jours si pas confirmé
```

**Notifications :** email (via OAuth Google/Discord) + badge in-app. Pas de Web Push en V1.

### Slots weekly
```
Lundi → 3 slots offerts gratuitement
        + 3 slots unlockables (1 pub = 1 slot)
        = 6 slots max/semaine

Coût en slots par tier :
  Tier 4 & 5 (TOP 50/100)  → 1 slot
  Tier 2 & 3 (TOP 15/25)   → 2 slots
  Tier 1     (TOP 5)        → 2 slots
```

### Trades Legacy / Major
```
Séparé du quota weekly
1 trade gratuit/mois (via pub)
+2 via pubs supplémentaires = 3 max/mois
```

### DB schema
```
user
  ├── trade_slots: 1          ← reset à 1 chaque lundi (cron)
  └── trade_ads_available: 2  ← reset à 2 chaque lundi (cron)

card
  ├── trade_tier: int         ← mis à jour chaque weekly refresh selon team.placement
  ├── trade_cost: int         ← 1 / 2 / 3 selon tier (figé sur Legacy/Major)
  ├── is_tradeable: bool      ← false pendant un trade en cours
  ├── is_on_wishlist: bool
  └── is_trade_offer: bool

card_major
  ├── player_id, event_id
  └── stats: null | {...}     ← null pendant le Major, rempli après scrape final
```

### Trade tier dynamique
Mis à jour chaque weekly refresh selon le classement HLTV actuel de l'équipe.
Les cartes Legacy et Major gardent leur `trade_cost` figé au moment du freeze.

### Règles
- Trade 1-for-1 uniquement
- Les deux parties confirment (pas d'auto-swap)
- Anti multi-compte : Google/Discord login = frein naturel suffisant (pas de KYC)

---

## Daily Challenges

5 challenges par jour, reset à **minuit heure locale** (date calculée côté client en local, pas UTC). Exactement 1 par groupe de kind au départ — jamais 2 du même type initialement, mais un reroll peut amener un doublon de kind. Reroll d'un challenge via pub (max 3/jour).

Pool de challenges (tirage aléatoire parmi) :
```
Ouvrir 1 pack aujourd'hui          →  10 XP
Ouvrir 2 packs aujourd'hui         →  18 XP
Ouvrir 3 packs aujourd'hui         →  25 XP
Obtenir 1 carte Silver+            →  10 XP
Obtenir 1 carte Gold+              →  20 XP
Obtenir 1 carte Diamond+           →  35 XP
Compléter 1 trade                  →  15 XP
Décraft 1 carte                    →   5 XP
Décraft 3 cartes                   →  10 XP
Décraft 5 cartes                   →  18 XP
Obtenir un joueur de nation {X}    →  15 XP
```

**Cap 100 XP/jour (base)** : si la sélection seeded dépasse 100 XP, la quête la plus chère est dégradée déterministement (rarity → open_packs → decraft). Le streak mult s'applique ensuite via `addXP()`, donc l'XP réel peut dépasser 100 avec un streak élevé.

**Nation du jour** : une nationalité tirée aléatoirement chaque jour (parmi les nations présentes dans le dataset). Affichée avec le drapeau dans le challenge. Même nation pour tous les joueurs ce jour-là.

**Flow claim** :
1. Objectif atteint → bouton "Récupérer ✦" apparaît (teal)
2. Clic → animation shimmer + particules gauche→droite (620ms) → `addXP(xp)` → vue compacte
3. Quêtes complétées trient automatiquement vers le bas

**Bonus all-complete** :
- Quand les 5 objectifs sont atteints, le header pulse en or et devient cliquable
- Récompense = total XP du jour × 1.5 arrondi au multiple de 5 (ex : 93 XP → 140 XP brut)
- L'XP passe par `addXP()` → streak mult appliqué dessus
- Non cumulable : 1 bonus/jour max, stocké dans `bonusClaimed` du localStorage
- Le countdown reset s'affiche dans tous les états du header (y compris après bonus récupéré)

**Dates — heure locale** :
- `todayStr()` dans `challenges.ts` et `touchStreak()` dans `streak.ts` utilisent la date locale (pas UTC)
- Reset challenges et streak se font à **00h00 heure locale** (pas 02h00 comme avec UTC en CEST)

**État localStorage (`csv-challenges`)** :
```
date          : string                    ← reset auto si date ≠ aujourd'hui
progress      : Record<id, number>        ← progression par challenge
done          : Record<id, bool>          ← objectif atteint
claimed       : Record<id, bool>          ← XP récupéré (clic "Récupérer")
rerollsUsed   : number                    ← 0–3
rerolledKinds : Record<kind, Template>    ← override template complet si rerollé
bonusClaimed  : bool                      ← bonus all-complete récupéré
```

---

## Système de Streak (Connexion)

Récompense la fidélité sur la durée. Deux queues indépendantes (daily + bonus) dont le daily croît avec le streak.

### Progression complète

| Semaine | Jours | Daily slots | Spawn daily | Queue daily max | Ads slot | XP mult (daily) | Drop Gold | Drop Dia | Drop Icon | Milestone |
|---------|-------|-------------|-------------|-----------------|----------|-----------------|-----------|----------|-----------|-----------|
| base | J1 | 1 | /12h | 1 | ✅ 1 | ×1.00 | — | — | — | — |
| S1 | J2–J6 | 1 | /12h | 2 | ✅ 1 | ×1.05 | — | — | — | — |
| **S2 ★** | J7–J13 | **2** | /12h | **3** | ✅ 1 | **×1.13** | **×1.13** | **×1.08** | **×1.05** | J7 |
| **S3 ★** | J14–J20 | 2 | /12h | 3 | ✅ 1 | **×1.25** | **×1.25** | **×1.15** | **×1.10** | J14 |
| **S4 ★** | J21–J27 | **3** | **/8h** | 3 | ❌ 0 | **×1.38** | **×1.38** | **×1.23** | **×1.15** | J21 |
| S5 | J28–J34 | 3 | /8h | 3 | ❌ 0 | **×1.50 MAX** | **×1.50 MAX** | **×1.30 MAX** | **×1.20 MAX** | J28 |
| **M1 ★** | J35+ | **4 CAP** | **/6h** | **4 CAP** | ❌ 0 | ×1.50 | MAX | MAX | MAX | J35+ : 1/7j |

**Règles :**
- Queue daily max = daily slots (plus de slot bonus à S4+ = mécanique de rétention intentionnelle)
- S4 (3 daily / 8h, queue max 3) : queue pleine après 24h sans ouverture → packs perdus → force le retour
- Bonus queue toujours disponible (1 slot fixe, XP et drops toujours supérieurs au daily)
- Bonus XP = daily XP × 1.2 · Bonus drop = daily drop × (Gold ×1.15 · Dia ×1.08 · Icon ×1.05)

**Milestones :** chaque multiple de 7j → 1 pack à claim manuellement (s'accumule si non réclamé).

### Break de streak

Si une journée est manquée, le streak repart à 0. Les buffs tombent immédiatement.

> UI : widget full-width au-dessus des défis — streak en jours (grand), badge ×XP (masqué si ×1.00), N packs/jour, barre 7 cases fine, hint dynamique vers le palier suivant (ou "★ PALIER MAXIMUM ATTEINT").
> Hover sur chaque case → tooltip affichant le buff qu'on obtiendra ce jour-là, seulement si différent du tier actuel. Tooltip ancré à droite pour les cases 6–7, à gauche pour 1–2, centré pour 3–5.

---

## Badges de Collection

Système de badges débloqués automatiquement selon la collection.

Exemples :
```
"Full Vitality"     → posséder tous les joueurs actifs de Vitality
"Tricolore"         → posséder 5 joueurs français Diamond+
"Major Winner"      → posséder 1 carte avec major_wins ≥ 1
"Legacy Hunter"     → posséder 3 cartes Legacy
"Icon Collector"    → posséder 1 carte Icon
```
- Badges visibles sur le profil public
- Peuvent débloquer des récompenses (gems, free pack)

---

## SBC — Squad Building Challenges

Sacrifier des cartes de sa collection pour obtenir une carte de rareté supérieure.

### Full Team
```
5 cartes du même joueur équipe → 1 carte Diamond+ de cette équipe (aléatoire)
Disponible uniquement pour les tiers TOP50, TOP75, TOP100
NON disponible pour TOP5, TOP15, TOP25 (anti-farming des élites)
```

### Nation
```
5 cartes de la même nationalité → 1 carte rareté supérieure de cette nation (aléatoire)
Même restriction : non disponible si toutes les 5 cartes sont TOP25+
```

---

## Authentification & Comptes

### Provider : Clerk ou Supabase Auth
- **Discord + Google** minimum (audience gaming, quasi tout le monde a un Discord)
- Zéro gestion de mots de passe — hashage, sessions, reset = géré par le provider
- On manipule uniquement un `user_id`, aucune responsabilité sur les credentials

### Schéma Supabase (données par user)
```
users
├── id, email, created_at
├── daily_pack_claimed_at       ← cooldown daily pack
├── last_pack_opened_at         ← cooldown général
├── xp: int
├── level: int
├── last_login_at               ← pour streak connexion
└── login_streak: int           ← jours consécutifs

user_cards
├── user_id, player_id
├── obtained_at
├── is_new                      ← badge "new" sur la carte
├── is_trade_offer              ← taggée "à trader"
└── is_on_wishlist              ← taggée "je veux ça"

user_gems
└── user_id, tier, amount       ← une ligne par tier (TOP5 … TOP100)

user_packs
└── user_id, pack_type, available_at, opens_at   ← packs en queue + timers

user_showcase
└── user_id, card_id, position  ← 5 cartes favorites affichées sur le profil (position 1-5)
```

| Service | Free tier |
|---|---|
| Clerk | 10 000 users |
| Supabase Auth | 50 000 users |

---

## Stack Technique — V1 Web

### Architecture globale
```
TON PC (scraper local, cron hebdo)
    ↓ JSON + images
    ├── GitHub repo  (/data/*.json)     → versionnée, trigger deploy Vercel
    └── Cloudflare R2 (/images/*.png)  → stockage images (10GB free, egress gratuit)
                ↓
            Vercel
        Next.js 16.2.6 (frontend + API routes)
                ↓
            Supabase
        PostgreSQL (users, collections, gems, cooldowns, XP, trade)
```

### Services
| Composant | Service | Coût |
|---|---|---|
| Images joueurs | Cloudflare R2 | Gratuit (10GB, 0€ egress) |
| Data JSON | GitHub repo | Gratuit |
| Frontend + API | Vercel | Gratuit |
| DB jeu | Supabase | Gratuit |
| Scraper | PC local | — |

### Frontend
```
Next.js 16.2.6 (App Router) + Tailwind 4 + TypeScript
Code dans frontend/
Vercel (auto-deploy au push GitHub)
Phone-first — bottom nav 4 tabs, ok si desktop se sent que c'est mobile
```

### Dev server — règle critique
⚠️ **Toujours killer et relancer après CHAQUE modif de code.** Le HMR Turbopack ne recharge pas systématiquement les composants modifiés.
```bash
kill -9 $(ps aux | grep next-server | grep -v grep | awk '{print $2}') 2>/dev/null
sleep 2 && cd frontend && npm run dev > /tmp/nextjs-dev.log 2>&1 &
sleep 8 && tail -3 /tmp/nextjs-dev.log
```

**ChunkLoadError (cache Turbopack corrompu)** — arrive après plusieurs restarts rapides. Fix : vider le cache et relancer.
```bash
kill -9 $(ps aux | grep next-server | grep -v grep | awk '{print $2}') 2>/dev/null
rm -rf frontend/.next
sleep 2 && cd frontend && npm run dev > /tmp/nextjs-dev.log 2>&1 &
sleep 12 && tail -3 /tmp/nextjs-dev.log
```

### Tunnel mobile (tests sur téléphone)
`ngrok` déjà installé.
1. `npm run dev -- --port 3000` (dans `frontend/`)
2. Dans un autre terminal : `ngrok http 3000`
3. Ouvrir `https://xxxx.ngrok-free.app` depuis le téléphone

### Flow update hebdo
```
python main.py --refresh
→ push JSON sur GitHub  →  Vercel redéploie auto
→ upload images sur R2
```

### Alias git — push rapide (`~/.bashrc`)
```bash
gitpushcsgo() {
  git add -A && git commit -m "${1:-update}" && git push
}
```
Usage :
```bash
gitpushcsgo "Add pack opening animation"   # avec message
gitpushcsgo                                # commit "update" par défaut
```
Stage tout (`git add -A`), commit, push en une commande depuis n'importe quel terminal WSL.

### Routes
| Route | Contenu |
|---|---|
| `/` | Tab Pack — queue, timers, daily, Major banner si actif |
| `/collection` | Tab Collection — mes cartes + toggle all cards |
| `/trade` | Tab Trade — marché want/have, slots, matches |
| `/profil` | Tab Profil — level, XP, gems, gem shop |
| `/card/[player_id]` | Page détail joueur |
| `/u/[user_id]` | Profil public — rank, showcase 5 cartes, stats basiques. Accessible depuis le tab Trade. |

---

## Roadmap

### V1 (actuel)
- [x] Scraper HLTV via hltv-api Docker
- [x] Pipeline incrémental avec résumé
- [x] Processor : raretés + scores normalisés
- [ ] Scrape complet des 487 joueurs
- [ ] Définir les conditions de rareté (à revoir)
- [x] Frontend Next.js — phone-first, 4 tabs (Pack, Collection, Trade, Profil)
- [x] Collection — données réelles, filtres Rarity/Role/Team/PAYS (loot pool), pagination, modal détail
- [x] MiniCards — photo full-bleed, halo rareté, Flag CSS, imageOffset (photo_focus)
- [x] Pack queue + timers — deux queues (daily + bonus), Claim → timer 1h → Accélérer pub(s) → Ouvrir, convention ▶ = pub
- [x] Pack opening animation — pack shake + tear + burst → roue × 5 + flip reveal → récap + persist localStorage
- [x] Daily challenges — 5 quests/jour, pool 11 variantes, seed daily, localStorage, hooks pack/rarity/nation, reset minuit
- [x] XP system frontend — `lib/xp.ts` + `lib/challenges.ts`, courbe 41 niveaux recalibrée ×4 (Silver III = fin sem 1 casual)
- [x] Système de streak — widget full-width (jours, ×XP mult, barre 7 cases, hint palier suivant), logique localStorage complète
- [x] Bulk uncraft collection — Décraft doublons (keep 1) en 1 clic + mode sélection multi-cartes, confirmation modal avec preview gems par tier
- [ ] Level-up detection dans `addXP()` — comparer ancien/nouveau niveau, dispatcher `csv-level-up` CustomEvent
- [ ] Attribution récompenses level-up — pack ou gems selon `nextLevelReward(level)`, persiste en localStorage (queue pack à claim)
- [ ] Modal/notification level-up — célébration visuelle + affichage de la récompense reçue
- [ ] Trade want/have market
- [ ] Intégration ads

### V1.5 — Pipeline optimisé (implémenté)
- [x] `curl_cffi` pour les images (bypass Cloudflare img-cdn)
- [x] `ThreadPoolExecutor` 3 workers → scrape ~3x plus rapide (~1h au lieu de 4h)
- [x] Retry automatique (3 tentatives : 5s → 15s → 30s) sur chaque call
- [x] Phase 1.5 : scrape team profile + achievements → baseline pour détection
- [x] Détection version bumps : team switch → Legacy, MVP → v1.1
- [x] PIA VPN auto-trigger si 5+ erreurs consécutives
- [x] Thread-safe progress saving (lock)
- [x] `teams_state.json` : baseline lineup + achievementCount par team
- [x] `fetch_images.py` double-pass retry + flag `no_hltv_photo` pour joueurs sans photo

### Weekly refresh (à coder)
```
1. Scrape 100 teams × 2 endpoints  (200 calls rapides, pas FlareSolverr)
2. Lineup diff    → joueurs partis = Legacy + nouvelle carte
3. AchievementCount diff → fetch achievements joueurs concernés
   → mvp_count augmenté    → v1.1
   → top20_count augmenté  → v1.x + tag "HLTV Top X YYYY"
   → evp_count augmenté    → stat recalc
4. Update stats tous joueurs actifs  (487 calls FlareSolverr ~1h avec 3 workers)
Total estimé : ~1h15
```

### Bugs connus (data)

- ~~**Team "Link"**~~ **FIXED** — `currentTeam` de l'API HLTV retournait "Link" (org transitoire) pour 9 joueurs. Patché dans `players_raw.json` + guard ajouté dans `main.py` : si le team retourné par l'API n'est pas dans les top 100, fallback sur `teams[0]` du roster.
- ~~**Cache PS non appliqué**~~ **FIXED** — `enrich_player()` préservait les champs PS depuis `old_record` dès qu'une `nationality` existait, sans vérifier si `image_url` était manquante. 101 joueurs affectés (dont donk, frozen, spinx, NiKo). Fix via `patch_ps_fields.py`. À corriger dans `main.py`.

### V2 (plus tard)
- [ ] Mise à jour hebdo automatique (Windows Task Scheduler + `--refresh` flag)
- [ ] Filtre coaches/bench dans le pipeline
- [x] Historique des équipes par joueur → synergy.json (Liquipedia `{{TH}}`)
- [ ] Système de synergy/buffs en jeu (utiliser `by_player` index de synergy.json)
- [ ] Packs événements tier 1 (IEM, BLAST, PGL hors Major)
- [ ] App mobile (PWA ou React Native) + Web Push notifications
- [ ] Classement / leaderboard top collectors
- [ ] Équilibrage national gem shop (coût variable selon densité joueurs/tier)

---

## Packs Événements (V2)

### Identification des events par type
```python
eventType == "Major"             → mécanique Major (bet sur les stats, pas un pack)
eventType == "International LAN" → pack Event Tier 1 (IEM, BLAST, PGL hors Major)
eventType == "Online"            → ignoré, pas de pack
```

### Pack Event Tier 1 (IEM / BLAST / PGL hors Major)
```
1 pub pour ouvrir
5 cartes — drop classique dans le pool des teams participantes
Pool splitté par ranking HLTV (même tiers que gems)
Stats normales, visibles immédiatement
Disponible pendant la durée de l'event uniquement
```

### Endpoints disponibles dans eupeutro
| Endpoint | Données utiles |
|---|---|
| `/events/search/{query}` | id, name, prize_pool, event_type, logo_url |
| `/events/{id}/profile` | start_date, end_date, teams[], mvp, evps, prize_pool |
| `/events/{id}/team/{team_id}/stats` | lineup réel de l'event, placement, prize |
| `/events/{id}/results` | scores, match_type, dates |

### Ce que ça débloque
| Donnée | Usage |
|---|---|
| `start_date / end_date` | Fenêtre d'activation du pack event |
| `teams[]` | Pool de joueurs restreint à l'event |
| `prize_pool` | Prestige → bonus de rareté sur les cartes |
| `mvp / evps` | Cartes spéciales "Event Winner" — jamais re-droppables |
| `lineup event` | Joueurs qui ont *vraiment* joué (≠ roster papier actuel) |
| `results` | Historique des matchs affichable sur la carte |

### Cartes Event Winner
- MVP / EVPs de l'event → carte unique avec badge "PGL Major Copenhagen 2024 MVP"
- Non-droppable après la fin de l'event → devient Legacy automatiquement

### Buff Major Champions
- Tant que l'équipe est #1 après un Major → badge "Major Champions" sur leurs cartes
- Bonus visuel uniquement (pas de stats boostées)
- Se retire au prochain Major

### Drop weight boosté pendant le Major
```
Finaliste  →  drop_weight × 1.2
Winner     →  drop_weight × 1.5
```
