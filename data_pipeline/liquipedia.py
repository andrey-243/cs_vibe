"""
Liquipedia MediaWiki API — achievements + team history + synergy.
CC-BY-SA license: attribute with "Data: Liquipedia.net" in the app.
Rate limit: action=query max 1 req/2s.
"""

import json
import re
import time
from datetime import date
from itertools import combinations
from pathlib import Path

import requests

BASE       = "https://liquipedia.net/counterstrike/api.php"
COMMONS    = "https://liquipedia.net/commons/Special:FilePath/"
UA         = "CSVibe/1.0 (educational; lerussedu24@gmail.com)"
_RATE_S    = 2.1
OUTPUT_DIR = Path(__file__).parent / "output"
IMAGES_DIR = OUTPUT_DIR / "images"

SYNERGY_FILE  = OUTPUT_DIR / "synergy.json"
HISTORY_CACHE = OUTPUT_DIR / "synergy_history_cache.json"

WORD_NUM = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
}
ORDINAL = {
    "2nd": 2, "3rd": 3, "4th": 4, "5th": 5,
    "6th": 6, "7th": 7, "8th": 8, "9th": 9, "10th": 10,
    "11th": 11, "12th": 12, "13th": 13, "14th": 14, "15th": 15,
    "16th": 16, "17th": 17, "18th": 18, "19th": 19, "20th": 20,
}

SYNERGY_TIERS = [
    (1095, "Band of Brothers", 100),  # 3+ years
    (365,  "Core Duo",         70),   # 1–3 years
    (180,  "Teammate",         40),   # 6m–1y
    (30,   "Alumni",           15),   # 1m–6m
]

_SKIP_STINT_STATUS = {"inactive", "stand-in", "loan", "coach", "analyst", "inactive (injured)"}

_last_req = 0.0


# ── HTTP + wikitext fetch ─────────────────────────────────────────────────────

def _rate_wait() -> None:
    global _last_req
    elapsed = time.time() - _last_req
    if elapsed < _RATE_S:
        time.sleep(_RATE_S - elapsed)
    _last_req = time.time()


def _query_wikitext(title: str) -> str | None:
    _rate_wait()
    try:
        resp = requests.get(
            BASE,
            params={
                "action": "query", "titles": title,
                "prop": "revisions", "rvprop": "content",
                "redirects": "1", "format": "json",
            },
            headers={"User-Agent": UA, "Accept-Encoding": "gzip"},
            timeout=15,
        )
        resp.raise_for_status()
        pages     = resp.json().get("query", {}).get("pages", {})
        page_data = next(iter(pages.values()))
        if "missing" in page_data:
            return None
        revisions = page_data.get("revisions", [])
        return revisions[0].get("*") if revisions else None
    except Exception:
        return None


def _search_title(name: str) -> str | None:
    _rate_wait()
    try:
        resp = requests.get(
            BASE,
            params={
                "action": "query", "list": "search",
                "srsearch": name, "srnamespace": "0",
                "srlimit": "1", "format": "json",
            },
            headers={"User-Agent": UA, "Accept-Encoding": "gzip"},
            timeout=15,
        )
        resp.raise_for_status()
        results = resp.json().get("query", {}).get("search", [])
        return results[0]["title"] if results else None
    except Exception:
        return None


def _fetch_wikitext(page: str) -> str | None:
    title    = page[0].upper() + page[1:] if page else page
    wikitext = _query_wikitext(title)
    if wikitext and not wikitext.lstrip().startswith("{{disambiguation"):
        return wikitext
    real_title = _search_title(page)
    if real_title and real_title != title:
        return _query_wikitext(real_title)
    return None


# ── Achievements parsing ──────────────────────────────────────────────────────

_ROLE_LABELS = {
    "awp": "AWPer", "awper": "AWPer",
    "rifle": "Rifler", "rifler": "Rifler",
    "igl": "IGL", "support": "Support",
    "entry": "Entry", "entryfragger": "Entry",
    "lurk": "Lurker", "lurker": "Lurker",
}
_ROLES_EXCLUDE = {"coach", "analyst", "assistant coach", "caster", "observer", "manager"}


def _parse_achievements(wikitext: str) -> dict:
    result = {}

    m = re.search(r"\|roles=([^\n|{}]+)", wikitext)
    if m:
        roles = []
        for r in [x.strip() for x in m.group(1).split(",")]:
            if not r or r in _ROLES_EXCLUDE:
                continue
            label = _ROLE_LABELS.get(r)
            if label and label not in roles:
                roles.append(label)
        if roles:
            result["roles"] = roles

    m = re.search(r"MVP\]\]+\s+of\s+(\d+)", wikitext) \
        or re.search(r"(\d+)\s+\[\[HLTV/MVP", wikitext)
    if m:
        result["mvp_count"] = int(m.group(1))
    if "mvp_count" not in result:
        count = len(re.findall(r"Was named the (?:HLTV )?MVP of", wikitext))
        if count:
            result["mvp_count"] = count

    m = re.search(r"(one|two|three|four|five|\d+)\s+Major MVP", wikitext)
    if m:
        raw = m.group(1)
        result["major_mvp_count"] = WORD_NUM.get(raw, int(raw) if raw.isdigit() else 0)

    m = re.search(r"(one|two|three|four|five|\d+)\s+\[\[Majors\|Major\]\]\s+championship", wikitext)
    if m:
        raw = m.group(1)
        result["major_count"] = WORD_NUM.get(raw, int(raw) if raw.isdigit() else 0)
    if "major_count" not in result:
        wins = set(re.findall(r"winning \[\[([^\]]*Major[^\]]*)\]\]", wikitext))
        if wins:
            result["major_count"] = len(wins)
    if "major_count" not in result:
        m = re.search(r"win (one|two|three|four|five|\d+) Major finals", wikitext, re.IGNORECASE)
        if m:
            raw = m.group(1).lower()
            result["major_count"] = WORD_NUM.get(raw, int(raw) if raw.isdigit() else 0)
    if "major_count" not in result:
        if re.search(r"(Oldest|Youngest|first) Major winner", wikitext):
            result["major_count"] = 1

    top20: dict[int, int] = {}
    for m in re.finditer(r"Was ranked the best player of (\d{4}) by \[\[HLTV\]\]", wikitext):
        top20[int(m.group(1))] = 1
    for m in re.finditer(
        r"Was ranked the (\d+(?:st|nd|rd|th)) best player of (\d{4}) by \[\[HLTV\]\]", wikitext
    ):
        rank = ORDINAL.get(m.group(1))
        if rank:
            top20[int(m.group(2))] = rank
    if top20:
        result["top20"]       = top20
        result["top20_count"] = len(top20)
        result["best_rank"]   = min(top20.values())
        result["top1_count"]  = sum(1 for r in top20.values() if r == 1)

    m = re.search(r"\|image\s*=\s*([^\n|{}]+)", wikitext)
    if m:
        filename = m.group(1).strip()
        if filename:
            result["liq_image"] = filename

    return result


def fetch_achievements(nickname: str) -> dict:
    """Fetch achievements for a player. Returns {} if page not found."""
    wikitext = _fetch_wikitext(nickname)
    return _parse_achievements(wikitext) if wikitext else {}


# ── Player photo ──────────────────────────────────────────────────────────────

def download_liq_image(player_id: str | int, filename: str) -> str | None:
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    dest = IMAGES_DIR / f"{player_id}.png"
    url  = COMMONS + filename.replace(" ", "_")
    try:
        resp = requests.get(url, headers={"User-Agent": UA}, allow_redirects=True, timeout=20)
        resp.raise_for_status()
        if "image" not in resp.headers.get("Content-Type", ""):
            return None
        dest.write_bytes(resp.content)
        return str(dest)
    except Exception:
        return None


# ── Team history parsing ──────────────────────────────────────────────────────

def _parse_stint_date(s: str) -> date | None:
    s = s.strip()
    if not s or s.startswith("??"):
        return None
    if s.lower() in ("present", "''present''", "'''present'''"):
        return date.today()
    s = s[:10]
    s = re.sub(r"-\?\?$", "-15", re.sub(r"-\?\?-\?\?$", "-07-01", s))
    try:
        return date.fromisoformat(s)
    except Exception:
        return None


def parse_team_history(wikitext: str) -> list[dict]:
    """Parse {{TH|...}} entries from wikitext. Returns list of {team, from, to}."""
    entries = []
    for m in re.finditer(r"\{\{TH\|([^}]+)\}\}", wikitext):
        parts = [p.strip() for p in m.group(1).split("|")]
        if len(parts) < 2:
            continue
        date_range, team = parts[0], parts[1]
        status = next((p for p in parts[2:] if "=" not in p), "")
        if status.lower() in _SKIP_STINT_STATUS:
            continue
        halves    = [x.strip() for x in date_range.split("—", 1)]
        date_from = _parse_stint_date(halves[0]) if halves else None
        date_to   = _parse_stint_date(halves[1]) if len(halves) > 1 else None
        if date_from and date_from > date.today():
            continue
        if date_from is None and date_to is None:
            continue
        if team:
            entries.append({"team": team, "from": date_from, "to": date_to})
    return entries


def fetch_team_history(nickname: str) -> list[dict]:
    """Fetch team history stints for a player from Liquipedia."""
    wikitext = _fetch_wikitext(nickname)
    return parse_team_history(wikitext) if wikitext else []


# ── Synergy calculation ───────────────────────────────────────────────────────

def _merge_intervals(intervals: list[tuple]) -> list[tuple]:
    today    = date.today()
    resolved = [(s or date(2010, 1, 1), e or today) for s, e in intervals if (s or date(2010, 1, 1)) <= (e or today)]
    if not resolved:
        return []
    resolved.sort()
    merged = [list(resolved[0])]
    for s, e in resolved[1:]:
        if s <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], e)
        else:
            merged.append([s, e])
    return [tuple(x) for x in merged]


def _group_by_team(hist: list[dict]) -> dict[str, list[tuple]]:
    groups: dict[str, list] = {}
    for e in hist:
        groups.setdefault(e["team"].lower(), []).append((e["from"], e["to"]))
    return {k: _merge_intervals(v) for k, v in groups.items()}


def compute_synergy(hist_a: list[dict], hist_b: list[dict]) -> dict | None:
    """Compute synergy between two players given their team histories."""
    ga, gb = _group_by_team(hist_a), _group_by_team(hist_b)
    shared = []
    for team_key in set(ga) & set(gb):
        days = sum(
            max(0, (min(at, bt) - max(af, bf)).days)
            for af, at in ga[team_key]
            for bf, bt in gb[team_key]
        )
        if days > 0:
            team_name = next(e["team"] for e in hist_a if e["team"].lower() == team_key)
            shared.append({"team": team_name, "days": days})
    if not shared:
        return None
    total_days         = sum(s["days"] for s in shared)
    tier_label, score  = "Alumni", 15
    for threshold, label, sc in SYNERGY_TIERS:
        if total_days >= threshold:
            tier_label, score = label, sc
            break
    return {
        "total_days":   total_days,
        "tier":         tier_label,
        "score":        score,
        "shared_teams": [s["team"] for s in shared],
    }


# ── Synergy cache helpers ─────────────────────────────────────────────────────

def load_history_cache() -> dict:
    return json.loads(HISTORY_CACHE.read_text()) if HISTORY_CACHE.exists() else {}


def save_history_cache(cache: dict) -> None:
    HISTORY_CACHE.write_text(json.dumps(cache, indent=2))


def _cache_to_hist(entry: dict) -> list[dict]:
    return [
        {
            "team": s["team"],
            "from": date.fromisoformat(s["from"]) if s["from"] else None,
            "to":   date.fromisoformat(s["to"])   if s["to"]   else None,
        }
        for s in entry.get("stints", [])
    ]


def fetch_and_cache_history(pid: str, name: str, cache: dict, force: bool = False) -> list[dict]:
    """Fetch and cache team history for one player. Returns parsed history."""
    if not force and pid in cache:
        return _cache_to_hist(cache[pid])
    hist    = fetch_team_history(name)
    cache[pid] = {
        "name": name,
        "stints": [
            {
                "team": e["team"],
                "from": e["from"].isoformat() if e["from"] else None,
                "to":   e["to"].isoformat()   if e["to"]   else None,
            }
            for e in hist
        ],
    }
    return hist


# ── Synergy pair computation + output ────────────────────────────────────────

def compute_all_pairs(entries: list[tuple[str, str]], cache: dict) -> list[dict]:
    pairs = []
    for (pid_a, name_a), (pid_b, name_b) in combinations(entries, 2):
        ha = _cache_to_hist(cache.get(pid_a, {}))
        hb = _cache_to_hist(cache.get(pid_b, {}))
        if not ha or not hb:
            continue
        result = compute_synergy(ha, hb)
        if result:
            pairs.append({"player_a": name_a, "player_b": name_b, "id_a": pid_a, "id_b": pid_b, **result})
    return sorted(pairs, key=lambda x: x["total_days"], reverse=True)


def _build_index(pairs: list[dict]) -> dict[str, list]:
    index: dict[str, list] = {}
    for p in pairs:
        for my_id, their_id, their_name in [
            (p["id_a"], p["id_b"], p["player_b"]),
            (p["id_b"], p["id_a"], p["player_a"]),
        ]:
            index.setdefault(my_id, []).append({
                "with_id":      their_id,
                "with_name":    their_name,
                "tier":         p["tier"],
                "score":        p["score"],
                "total_days":   p["total_days"],
                "shared_teams": p["shared_teams"],
            })
    return index


def write_synergy_output(pairs: list[dict], total_players: int) -> None:
    SYNERGY_FILE.write_text(json.dumps({
        "generated_at":  date.today().isoformat(),
        "total_players": total_players,
        "total_pairs":   len(pairs),
        "pairs":         pairs,
        "by_player":     _build_index(pairs),
    }, indent=2))


# ── High-level operations (used by monthly.py + main.py) ─────────────────────

def synergy_full_rebuild(entries: list[tuple[str, str]], force: bool = False) -> None:
    """Fetch history for all players, recompute all pairs. force=True ignores cache."""
    cache   = load_history_cache()
    fetched, failed = 0, []
    total   = len(entries)

    for i, (pid, name) in enumerate(entries):
        if not force and pid in cache:
            continue
        hist = fetch_and_cache_history(pid, name, cache, force=force)
        if hist:
            fetched += 1
            print(f"  [{i+1}/{total}] {name}: {len(hist)} stints", flush=True)
        else:
            failed.append(name)
            print(f"  [{i+1}/{total}] {name}: not found", flush=True)
        if fetched % 10 == 0 and fetched > 0:
            save_history_cache(cache)

    save_history_cache(cache)
    print(f"  Histories: {fetched} fetched, {len(failed)} failed", flush=True)

    pairs = compute_all_pairs(entries, cache)
    write_synergy_output(pairs, len(entries))
    print(f"  Pairs: {len(pairs)} written → {SYNERGY_FILE}", flush=True)


def synergy_update_new_players(new_entries: list[tuple[str, str]], all_entries: list[tuple[str, str]]) -> int:
    """
    Fetch history for new players only, compute their pairs against all existing players.
    Merges into synergy.json. Returns number of new pairs added.
    """
    cache   = load_history_cache()
    fetched = 0
    for pid, name in new_entries:
        hist = fetch_and_cache_history(pid, name, cache)
        if hist:
            fetched += 1
            print(f"  synergy: {name} → {len(hist)} stints", flush=True)
        else:
            print(f"  synergy: {name} → not found", flush=True)
    if fetched:
        save_history_cache(cache)

    new_pids  = {pid for pid, _ in new_entries}
    new_pairs = []
    for pid_a, name_a in new_entries:
        for pid_b, name_b in all_entries:
            if pid_b in new_pids and pid_b <= pid_a:
                continue
            ha = _cache_to_hist(cache.get(pid_a, {}))
            hb = _cache_to_hist(cache.get(pid_b, {}))
            if not ha or not hb:
                continue
            result = compute_synergy(ha, hb)
            if result:
                new_pairs.append({
                    "player_a": name_a, "player_b": name_b,
                    "id_a": pid_a,      "id_b": pid_b,
                    **result,
                })

    if not new_pairs:
        return 0

    existing = json.loads(SYNERGY_FILE.read_text()).get("pairs", []) if SYNERGY_FILE.exists() else []
    merged   = sorted(existing + new_pairs, key=lambda x: x["total_days"], reverse=True)
    write_synergy_output(merged, len(all_entries))
    return len(new_pairs)
