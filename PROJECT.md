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

### Flag.tsx
Composant drapeau wrappant `flag-icons`. Props : `code` (ISO-2), `width` (défaut 18), `rounded` (défaut true). Render via `className="fi fi-{code}"` + sizing inline. Fallback `null` si code absent. `flag-icons` importé dans `layout.tsx`. Utiliser ce composant — pas de `<span>` inline direct.

### MiniCard — DNA CardHolo
Photo full-bleed, gradient noir bas. Taille défaut **84×124px** (ratio 1.476 — CARD_RATIO = 124/84, ne pas changer pour la grille collection).

Layout :
- TL : overall (24px fw=800) + rôle 3 lettres (6.5px, couleur chrome) en dessous
- TR : `<Flag code={...} width={14} />`
- Bas : nom (12px fw=800) + teamShort (6.5px) + panel stats dark optionnel (si `categoryScores` fourni)

Détails visuels :
- Glow halo : `radial-gradient(ellipse, ${chrome.glow}, transparent 70%)`, inset **-6px**, blur **8px**
- Border : `rgba(255,255,255,0.18)`, shadow : `0 8px 22px rgba(0,0,0,0.55)`
- Gradient bas : `transparent 25%, rgba(0,0,0,0.5) 65%, rgba(0,0,0,0.85) 100%`
- Fond : `chrome.bg = linear-gradient(160deg, tier.from, tier.to)` via `rarityChrome()`
- Prop `imageOffset?: string` → CSS `object-position` sur la photo (défaut `"top center"`)

Props supplémentaires :
- `locked?: boolean` → overlay sombre `rgba(6,6,10,0.72)` + rayures diagonales `repeating-linear-gradient(135deg, rgba(255,255,255,0.045) 0px 2px, transparent 2px 11px)` — utilisé pour les cartes non obtenues dans "Toutes"
- `isNew?: boolean` → badge rouge "NEW" TL (zIndex 3, au-dessus du locked overlay)

### CardDetailModal (`components/CardDetailModal.tsx`)
- Photo full-bleed (270×390), gradient `rgba(0,0,0,0.93) → transparent 80%` depuis le bas
- TL : overall (60px fw=800) + tier (9px, couleur chrome)
- TR : `<span className="fi fi-{iso2}">` (22×16px) + rôle plein mot (ENT→"Entry", AWP→"AWPer", etc.)
- Bottom overlay : nom (26px fw=800) + team mono (9.5px) + grille stats 3×2 (18px/7.5px, ligne top séparatrice uniquement, pas de barres entre cellules)
- Boutons Détails / Trade en dessous (270px wide)
- Stats : 6 `category_scores` (FIR/OPN/CLU/ENT/TRD/IMP) affichés en 3×2. **Non passés aux MiniCards de la grille** (seulement au modal).

### Collection
- Données réelles depuis `players_cards.json` via `loadCards()`, cache mémoire dans `cards.ts`
- 4 dropdowns custom : Rarity colorée, Role full name, Team classée par rank, **PAYS** (loot pool)
- Images : API route `/api/player-image/[player_id]` — sert local d'abord, redirect CDN Pandascore en fallback. `loadCards()` pointe toujours vers l'API locale.
- `photo_focus` : champ optionnel dans `players_cards.json` (ex: `"photo_focus": "50% 26%"`). Mappé vers `image_offset` dans `CardDisplay` via `loadCards()`. Absent → fallback `"top center"`.
- Rôles : normalisés et dédupliqués (AWPer/Awper/Awp → AWP, etc.), coaches/analysts filtrés

**Layout accordéon (2 sections collapsibles) :**
- `SectionDivider` → header cliquable avec chevron `▼` (rotate -90° quand collapsed), titre, badge count teal
- **"Mes cartes"** : affiche toutes les cartes possédées d'un coup (grid libre, pas de pagination) — typiquement peu nombreuses. Filtres RARITY/ROLE/TEAM/PAYS appliqués. Empty state "Connecte-toi" si 0 cartes.
- **"Toutes"** : `CardGrid` paginé (9/page), cartes non possédées affichées avec `locked=true` (overlay rayures diagonales). Filtres appliqués.
- **Une seule pagination** en bas de page, commune aux deux sections, basée sur `filteredAll.length`. `page` state dans `CollectionGrid`, passé en prop à `CardGrid` (stateless côté pagination). Reset à 0 sur changement de filtre.

**Architecture CardGrid :**
```
CollectionGrid (page state ici, totalPages basé sur filteredAll)
  ├── Section "Mes cartes" — mineCards.map(), pas de slice
  ├── Section "Toutes"    — CardGrid(page=page, cards=filteredAll)
  └── Pagination unique   — −10 / Préc. / Suiv. / +10
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
Dropdowns RARITY/ROLE/TEAM non cliquables sur mobile. Fixes `touchstart` + `touchAction: "manipulation"` appliqués mais insuffisants.
- Piste probable : z-index BottomNav couvrant les éléments, ou règle `touch-action` dans `globals.css`, ou overflow clipping parent
- À investiguer : `BottomNav.tsx` z-index, `globals.css`, `layout.tsx` overflow
- Note : le toggle Toutes/Mes cartes a été supprimé → remplacé par les `SectionDivider` accordéons

---

## Navigation — Phone First

Site web **phone-first** : la nav est pensée pour mobile, c'est ok si sur desktop ça se sent.

**4 tabs (bottom nav) :**

| Tab | Contenu |
|---|---|
| **Pack** | Packs en queue + timers, daily, bonus pub, bouton ouvrir. Banner Major si un Major est actif. |
| **Collection** | Mes cartes (défaut) + toggle "Toutes les cartes". Filtres : équipe, rareté, nation. |
| **Trade** | Marché passif want/have. Mes offres, ma wishlist, matches en attente, slots restants. |
| **Profil** | Level + XP, rank CS/Faceit/ESEA affiché, showcase 5 cartes favorites, gemmes par tier, gem shop, settings. |

---

## Mécaniques de jeu

### Pack

```
Pack standard (pool all players)
├── 1 gratuit / 12h
└── 1 bonus via pub / 6h   — max 2 packs en queue simultanément

5 cartes par pack
```

**Ouverture style Clash Royale — timer selon le type de pack :**

```
Pack daily / bonus ads
└── 1h  →  1 pub  →  instant

Pack gem crafté
├── TOP 100 :  1h  →  1 pub  →  instant
├── TOP 75  :  2h  →  1 pub  →  30min  →  1 pub  →  instant
├── TOP 50  :  4h  →  1 pub  →  30min  →  1 pub  →  instant
├── TOP 25  :  6h  →  1 pub  →  1h     →  1 pub  →  10min  →  1 pub  →  instant
├── TOP 15  :  8h  →  1 pub  →  1h     →  1 pub  →  10min  →  1 pub  →  instant
└── TOP 5   : 12h  →  1 pub  →  2h     →  1 pub  →  30min  →  1 pub  →  instant
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

| Tier | Équipes | Gem |
|---|---|---|
| TOP 5 | #1 → #5 | 💎 TOP 5 |
| TOP 15 | #6 → #15 | 💎 TOP 15 |
| TOP 25 | #16 → #25 | 💎 TOP 25 |
| TOP 50 | #26 → #50 | 💎 TOP 50 |
| TOP 75 | #51 → #75 | 💎 TOP 75 |
| TOP 100 | #76 → #100 | 💎 TOP 100 |

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
- 250 gems d'un tier → pack thématique garanti dans ce tier
- Choix : par équipe (joueur garanti de l'équipe) OU par nationalité (filtre sur `nationality`)

**Conversion ascendante (sink pour Bronze/Silver)**
```
100 TOP100 → 10 TOP75
 10 TOP75  →  1 TOP50
  5 TOP50  →  1 TOP25
  5 TOP25  →  1 TOP15
  5 TOP15  →  1 TOP5
```
- Donne de la valeur aux doublons Bronze/Silver
- Taux punissants : TOP100 → TOP5 nécessite ~125 000 gems (pratiquement impossible)
- Usage réel : 1-2 tiers au-dessus (ex: 2500 TOP100 gems → 250 TOP75 → 1 pack garanti TOP75)

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
Pack daily gratuit    × 1.0
Pack bonus (ads)      × 1.2
Mécanique Major       × 1.5
```

**XP hors pack :**
```
Connexion quotidienne          →   5 XP
7 jours consécutifs            →   free pack (bonus)
Trade complété                 →  15 XP  (indépendant de qui on trade)
Craft pack gems — selon tier   →  TOP100: 20 / TOP75: 30 / TOP50: 45
                                   TOP25: 65 / TOP15: 85 / TOP5: 120
```

### Courbe XP exponentielle

```
Silver I        →    100 XP
...
Global Elite    →  5 000 XP
...
ESEA S          → 20 000 XP
```
Chaque niveau suivant coûte significativement plus que le précédent.

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

3 challenges par jour, reset à minuit. Reroll d'un challenge via pub.

Exemples de challenges :
```
Ouvrir 1 pack aujourd'hui          → 10 XP
Obtenir 1 carte Gold ou+            → 20 XP
Compléter 1 trade                   → 15 XP
Décraft 3 cartes                    → 10 XP
Connexion 3 jours de suite          → 25 XP + gems bonus
Obtenir un joueur d'une nation X    → 15 XP
```
*(pool de challenges à étoffer — variété importante pour l'engagement)*

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
- [x] Pack queue + timers — file d'attente (max 2), countdown live, skip pub, CTA bonus
- [ ] Pack opening animation — révélation des 5 cartes une par une
- [ ] Système de level + XP
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
