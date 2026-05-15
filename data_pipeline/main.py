import json
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import csapi
import liquipedia
import pandascore
from csapi import info, ok, warn, err, section
from processor import process_players, rarity_distribution

# ── Config ────────────────────────────────────────────────────────────────────

OUTPUT_DIR       = Path(__file__).parent / "output"
TEAMS_FILE       = OUTPUT_DIR / "teams_raw.json"
PS_CACHE_FILE    = OUTPUT_DIR / "ps_players_cache.json"
PS_TEAMS_FILE    = OUTPUT_DIR / "ps_teams_cache.json"
PLAYERS_FILE     = OUTPUT_DIR / "players_raw.json"
PROGRESS_FILE    = OUTPUT_DIR / "players_progress.json"
CARDS_FILE       = OUTPUT_DIR / "players_cards.json"
LIQ_CACHE_FILE   = OUTPUT_DIR / "liq_cache.json"
LIQ_IMG_CACHE    = OUTPUT_DIR / "liq_image_cache.json"
MATCHHIST_FILE   = OUTPUT_DIR / "match_history_cache.json"

TEAM_LIMIT = 100
WORKERS    = 5

_progress_lock = threading.Lock()


# ── Persistence ───────────────────────────────────────────────────────────────

def load_progress() -> dict:
    if PROGRESS_FILE.exists():
        data = json.loads(PROGRESS_FILE.read_text())
        return {str(p["player_id"]): p for p in data}
    return {}


def save_progress_safe(progress: dict) -> None:
    with _progress_lock:
        PROGRESS_FILE.write_text(
            json.dumps(list(progress.values()), indent=2, ensure_ascii=False)
        )


# ── Version bump detection ────────────────────────────────────────────────────

def detect_version_bumps(enriched: list[dict], old_progress: dict) -> list[dict]:
    bumps = []
    for p in enriched:
        pid = str(p["player_id"])
        if pid not in old_progress:
            continue
        old = old_progress[pid]

        old_team = old.get("team_name", "")
        new_team = p.get("team_name", "")
        if old_team and new_team and old_team != new_team:
            bumps.append({
                "player_id": pid,
                "name":      p["name"],
                "reason":    "team_switch",
                "detail":    f"{old_team} → {new_team}",
            })

        old_mvp = int(old.get("mvp_count") or 0)
        new_mvp = int(p.get("mvp_count") or 0)
        if new_mvp > old_mvp:
            bumps.append({
                "player_id": pid,
                "name":      p["name"],
                "reason":    "mvp_gained",
                "detail":    f"mvp {old_mvp} → {new_mvp}",
            })

    return bumps


# ── Worker ────────────────────────────────────────────────────────────────────

def enrich_player(p: dict, ps_lookup: dict, old_record: dict | None = None) -> dict:
    # Stats from csapi.de — always re-fetched
    try:
        data  = csapi.get_player(p["player_id"])
        stats = data.get("stats", {})
        p.update({
            "rating": stats.get("rating", 0.0),
            "adr":    stats.get("adr",    0.0),
            "kast":   stats.get("kast",   0.0),
            "swing":  stats.get("swing",  0.0),
            "k":      stats.get("k",      0.0),
            "d":      stats.get("d",      1.0),
            "N":      stats.get("N",      0),
        })
        team = data.get("team", {})
        if team.get("name"):
            p["team_name"] = team["name"]
    except Exception as e:
        warn(f"  csapi failed for {p['name']}: {e}")

    # Detect team switch (used to decide whether to re-fetch photo)
    team_switched = (
        old_record
        and old_record.get("team_name")
        and p.get("team_name")
        and old_record["team_name"] != p["team_name"]
    )

    # Identity from PandaScore
    # Preserve cache UNLESS: first run (no old_record) OR team switched (new org = new photo)
    if old_record and old_record.get("nationality") and not team_switched:
        for field in ("first_name", "last_name", "nationality", "image_url",
                      "age", "photo_local", "no_photo"):
            if field in old_record:
                p[field] = old_record[field]
    else:
        slug = p["name"].lower()
        ps   = ps_lookup.get(slug)
        if ps:
            p.update({
                "first_name":  ps.get("first_name"),
                "last_name":   ps.get("last_name"),
                "nationality": ps.get("nationality"),
                "image_url":   ps.get("image_url"),
                "age":         ps.get("age"),
            })
            # Photo: try Liquipedia first (better quality), fallback to PandaScore
            liq_img_cache: dict = {}
            if LIQ_IMG_CACHE.exists():
                liq_img_cache = json.loads(LIQ_IMG_CACHE.read_text())
            liq_entry = liq_img_cache.get(slug)
            liq_fname = liq_entry.get("filename") if liq_entry else None
            if liq_fname:
                path = liquipedia.download_liq_image(p["player_id"], liq_fname)
            else:
                path = pandascore.download_image(p["player_id"], ps.get("image_url"))
            p["photo_local"] = path
            p["no_photo"]    = path is None and not ps.get("image_url")
        else:
            p["no_photo"] = True

    # Liquipedia achievements — always re-fetched in Phase 4, never cached here
    if old_record:
        for field in ("roles", "mvp_count", "major_mvp_count", "major_count",
                      "top20_count", "top20", "top1_count", "best_rank"):
            if field in old_record:
                p[field] = old_record[field]

    return p


# ── Main ──────────────────────────────────────────────────────────────────────

def main(refresh: bool = False):
    OUTPUT_DIR.mkdir(exist_ok=True)
    (OUTPUT_DIR / "images").mkdir(exist_ok=True)

    if refresh:
        section("WEEKLY REFRESH MODE")
        TEAMS_FILE.unlink(missing_ok=True)
        info("teams_raw.json cleared — will re-fetch rankings.")

    # ── Phase 1 : rankings → top 100 teams ───────────────────────────────────
    section(f"PHASE 1 — Rankings + rosters  (top {TEAM_LIMIT})")

    if TEAMS_FILE.exists():
        info("Teams loaded from cache.")
        teams = json.loads(TEAMS_FILE.read_text())
    else:
        rankings = csapi.get_rankings(limit=TEAM_LIMIT)
        teams    = []
        for r in rankings:
            try:
                team = csapi.get_team(r["id"])
                teams.append({
                    "team_id":  r["id"],
                    "name":     r["name"],
                    "rank":     r["rank"],
                    "points":   r["points"],
                    "streak":   team.get("streak", 0),
                    "players":  team.get("roster", []),
                })
                ok(f"#{r['rank']:>3}  {r['name']:<25}  {len(team.get('roster', []))} players")
            except Exception as e:
                err(f"  get_team failed for {r['name']}: {e}")
            time.sleep(0.35)

        TEAMS_FILE.write_text(json.dumps(teams, indent=2, ensure_ascii=False))
        ok(f"Teams saved → {TEAMS_FILE}")

    # ── Build unique player list ──────────────────────────────────────────────
    seen: dict[str, dict] = {}
    for team in teams:
        for p in team["players"]:
            pid = str(p["id"])
            if pid not in seen:
                seen[pid] = {
                    "player_id":   pid,
                    "name":        p["name"],
                    "team_name":   team["name"],
                    "team_rank":   team["rank"],
                    "team_points": team["points"],
                }
    all_players = list(seen.values())
    info(f"{len(all_players)} unique players across {len(teams)} teams")

    # ── Phase 1.5 : Match history → avg opponent rank ─────────────────────────
    section("PHASE 1.5 — Match history (avg opponent rank)")

    if MATCHHIST_FILE.exists() and not refresh:
        mh_cache: dict[str, float | None] = json.loads(MATCHHIST_FILE.read_text())
        info(f"Match history loaded from cache ({len(mh_cache)} teams).")
    else:
        mh_cache = {}
        for team in teams:
            avg = csapi.get_avg_opp_rank(team["team_id"])
            mh_cache[team["name"]] = avg
            ok(f"  #{team['rank']:>3}  {team['name']:<25}  avg_opp={avg}")
            time.sleep(0.35)
        MATCHHIST_FILE.write_text(json.dumps(mh_cache, indent=2, ensure_ascii=False))
        ok(f"Match history saved → {MATCHHIST_FILE}")

    for team in teams:
        team["avg_opp_rank"] = mh_cache.get(team["name"])

    # ── Phase 2 : PandaScore identity cache ───────────────────────────────────
    section("PHASE 2 — PandaScore identity")

    if PS_CACHE_FILE.exists() and not refresh:
        ps_lookup = json.loads(PS_CACHE_FILE.read_text())
        info(f"PandaScore loaded from cache ({len(ps_lookup)} players).")
    else:
        ps_lookup = pandascore.fetch_all_players()
        PS_CACHE_FILE.write_text(json.dumps(ps_lookup, indent=2, ensure_ascii=False))
        ok(f"PandaScore: {len(ps_lookup)} players indexed + cached.")

    # ── Phase 2.5 : team logos ────────────────────────────────────────────────
    section("PHASE 2.5 — Team logos (PandaScore)")
    (OUTPUT_DIR / "team_logos").mkdir(exist_ok=True)

    if PS_TEAMS_FILE.exists() and not refresh:
        ps_teams = json.loads(PS_TEAMS_FILE.read_text())
        info(f"PandaScore teams loaded from cache ({len(ps_teams)} teams).")
    else:
        ps_teams = pandascore.fetch_all_teams()
        PS_TEAMS_FILE.write_text(json.dumps(ps_teams, indent=2, ensure_ascii=False))
        ok(f"PandaScore teams: {len(ps_teams)} indexed + cached.")

    _PS_TEAM_ALIASES = {
        "ninjas in pyjamas": "nip",
        "betclic":           "betclic apogee esports",
    }

    def _ps_team_lookup(name: str) -> dict | None:
        key = name.lower()
        if key in _PS_TEAM_ALIASES:
            key = _PS_TEAM_ALIASES[key]
        if key in ps_teams:
            return ps_teams[key]
        # Try stripping / adding common suffixes
        for variant in (
            key.removeprefix("the "),
            key.removeprefix("team "),
            key.removesuffix(" team"),
            key.removesuffix(" clan"),
            key.removesuffix(" esports"),
            key.removesuffix(" esport"),
            key + " esports",
            key + " esport",
            key + " team",
        ):
            if variant != key and variant in ps_teams:
                return ps_teams[variant]
        return None

    for team in teams:
        ps = _ps_team_lookup(team["name"])
        if ps:
            team["acronym"]    = ps.get("acronym")
            team["logo_local"] = pandascore.download_team_logo(team["name"], ps.get("image_url"))
        else:
            team["acronym"]    = None
            team["logo_local"] = None
    logos_ok = sum(1 for t in teams if t.get("logo_local"))
    ok(f"Logos downloaded: {logos_ok} / {len(teams)}")

    # ── Phase 3 : player enrichment ───────────────────────────────────────────
    old_progress = load_progress()

    if refresh:
        # Re-fetch stats for everyone; identity + achievements preserved in enrich_player
        remaining = all_players
        info(f"Refresh — re-fetching stats for all {len(remaining)} players.")
    else:
        # First run or resume: only process new/missing players
        remaining = [p for p in all_players if str(p["player_id"]) not in old_progress]
        if old_progress:
            info(f"Resuming — {len(old_progress)} done, {len(remaining)} left.")

    section(f"PHASE 3 — Player enrichment  ({len(remaining)} / {len(all_players)})  [{WORKERS} workers]")

    progress = dict(old_progress)
    t_start  = time.time()
    done     = 0

    with ThreadPoolExecutor(max_workers=WORKERS) as executor:
        futures = {
            executor.submit(
                enrich_player,
                dict(p),
                ps_lookup,
                old_progress.get(str(p["player_id"])),  # pass cached record for refresh
            ): p
            for p in remaining
        }
        for future in as_completed(futures):
            try:
                result = future.result()
                progress[str(result["player_id"])] = result
                save_progress_safe(progress)
                done += 1
                nat = result.get("nationality") or "??"
                img = "📷" if result.get("photo_local") else "✗"
                info(f"[{done:>3}/{len(remaining)}]  {result['name']:<20}  {nat}  {img}  rating={result.get('rating', 0):.3f}")
            except Exception as e:
                err(f"Worker error: {e}")

    # ── Mark players no longer in top 100 as inactive ─────────────────────────
    if refresh:
        active_ids = {str(p["player_id"]) for p in all_players}
        retired    = 0
        for pid, rec in progress.items():
            was_active = rec.get("is_active", True)
            now_active = pid in active_ids
            rec["is_active"] = now_active
            if was_active and not now_active:
                retired += 1
                warn(f"  {rec['name']:<20} left top {TEAM_LIMIT} → is_active=false")
        if retired:
            info(f"{retired} players marked inactive.")
        save_progress_safe(progress)

    # ── Phase 4 : Liquipedia achievements ────────────────────────────────────
    if refresh:
        # Re-fetch Liquipedia for:
        # 1. Players new to the top 100 this week (never been fetched)
        # 2. Players from teams that competed in recently ended events
        #    (new MVPs/trophies may have been distributed)
        new_ids      = {str(p["player_id"]) for p in all_players
                        if str(p["player_id"]) not in old_progress}
        recent_teams = pandascore.fetch_recent_event_teams(days=21)
        info(f"New players: {len(new_ids)} — Recent event teams: {len(recent_teams)}")
        liq_candidates = [
            p for p in progress.values()
            if str(p["player_id"]) in new_ids
            or p.get("team_name", "").lower() in recent_teams
        ]
    else:
        # First run: fetch everyone — rating is not a valid proxy for career
        # achievements (IGLs, veterans have low rating but many trophies)
        liq_candidates = list(progress.values())

    # Load Liquipedia cache (name → achievements dict, {} = already fetched, no data)
    liq_cache: dict[str, dict] = {}
    if LIQ_CACHE_FILE.exists():
        liq_cache = json.loads(LIQ_CACHE_FILE.read_text())

    # Weekly refresh: invalidate cache only for the two groups that can have new data:
    #   1. new_ids      — players new to the top 100 (never fetched before)
    #   2. recent_teams — players from teams in recent events (new MVPs/trophies possible)
    # All other players keep their cached result — their career achievements don't change.
    if refresh:
        invalidate_names = {
            p["name"] for p in progress.values()
            if str(p["player_id"]) in new_ids
            or p.get("team_name", "").lower() in recent_teams
        }
        for name in invalidate_names:
            liq_cache.pop(name, None)

    section(f"PHASE 4 — Liquipedia achievements  ({len(liq_candidates)} to fetch)")
    for p in liq_candidates:
        name = p["name"]
        pid  = str(p["player_id"])

        if name in liq_cache:
            achiev = liq_cache[name]
            if achiev:
                progress[pid].update(achiev)
            info(f"  {name:<20}  (cached)  mvp={achiev.get('mvp_count','?')}  top20={achiev.get('top20_count','?')}")
            continue

        achiev = liquipedia.fetch_achievements(name)
        liq_cache[name] = achiev  # store even if empty — marks as fetched
        LIQ_CACHE_FILE.write_text(json.dumps(liq_cache, indent=2, ensure_ascii=False))

        if achiev:
            progress[pid].update(achiev)
            save_progress_safe(progress)
            ok(f"  {name:<20}  mvp={achiev.get('mvp_count','?')}  top20={achiev.get('top20_count','?')}")
        else:
            info(f"  {name:<20}  (no page)")

        # Download Liquipedia photo for players still missing one
        liq_image = achiev.get("liq_image") if achiev else None
        if liq_image and progress[pid].get("no_photo"):
            liq_img_cache: dict = {}
            if LIQ_IMG_CACHE.exists():
                liq_img_cache = json.loads(LIQ_IMG_CACHE.read_text())
            if name not in liq_img_cache:
                import time as _time; _time.sleep(0.3)
                local = liquipedia.download_liq_image(pid, liq_image)
                liq_img_cache[name] = {"filename": liq_image, "local_path": local}
                LIQ_IMG_CACHE.write_text(json.dumps(liq_img_cache, indent=2, ensure_ascii=False))
                if local:
                    progress[pid]["photo_local"] = local
                    progress[pid]["no_photo"]    = False
                    save_progress_safe(progress)
                    ok(f"  {name:<20}  📷 liq photo saved")

    # ── Phase 5 : Synergy — new players only (weekly) / skip on first run ────────
    if refresh and new_ids:
        section(f"PHASE 5 — Synergy update  ({len(new_ids)} new players)")
        all_entries = [
            (str(p["player_id"]), p["name"])
            for p in progress.values()
            if p.get("name") and p.get("player_id")
        ]
        new_entries = [e for e in all_entries if e[0] in new_ids]
        added = liquipedia.synergy_update_new_players(new_entries, all_entries)
        ok(f"Synergy: {added} new pairs added for {len(new_entries)} new players")

    # ── Version bumps ─────────────────────────────────────────────────────────
    enriched = list(progress.values())
    bumps    = detect_version_bumps(enriched, old_progress)
    if bumps:
        section(f"VERSION BUMPS — {len(bumps)} detected")
        for b in bumps:
            icon = "🔄" if b["reason"] == "team_switch" else "🏆"
            warn(f"  {icon}  {b['name']:<20}  {b['reason'].upper()}  {b['detail']}  → Legacy + new card")

    # ── Save + process ────────────────────────────────────────────────────────
    PLAYERS_FILE.write_text(json.dumps(enriched, indent=2, ensure_ascii=False))
    ok(f"Players saved → {PLAYERS_FILE}  ({len(enriched)} total)")

    cards = process_players(enriched, teams)
    CARDS_FILE.write_text(json.dumps(cards, indent=2, ensure_ascii=False))

    dist  = rarity_distribution(cards)
    total = time.time() - t_start
    section(f"DONE — {len(teams)} teams / {len(cards)} cards  {total/60:.1f}min")
    for rarity, count in dist.items():
        print(f"  {rarity:<12} {count}")
    print(f"\nCards saved → {CARDS_FILE}")


if __name__ == "__main__":
    main(refresh="--refresh" in sys.argv)
