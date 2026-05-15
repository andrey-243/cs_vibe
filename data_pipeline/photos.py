"""
Download player photos into output/images/{player_id}.png.

Priority: Liquipedia first (better quality), PandaScore fallback.

Usage:
    python photos.py           # skip players that already have a file
    python photos.py --force   # re-download everyone (overwrites)

Generates output/photos_report.html for visual review.
"""

import json
import os
import sys
import time
import requests
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

sys.path.insert(0, str(Path(__file__).parent))
import liquipedia

OUTPUT_DIR  = Path(__file__).parent / "output"
CARDS_FILE  = OUTPUT_DIR / "players_cards.json"
LIQ_CACHE   = OUTPUT_DIR / "liq_image_cache.json"
IMAGES_DIR  = OUTPUT_DIR / "images"
REPORT_FILE = OUTPUT_DIR / "photos_report.html"

FORCE = "--force" in sys.argv

TOKEN = os.environ["PANDASCORE_TOKEN"]
BASE  = "https://api.pandascore.co"

IMAGES_DIR.mkdir(exist_ok=True)


# ── PandaScore ────────────────────────────────────────────────────────────────

def _ps_get(path, params=None):
    headers = {"Authorization": f"Bearer {TOKEN}"}
    for delay in [0, 3, 8, 15]:
        if delay:
            time.sleep(delay)
        try:
            r = requests.get(f"{BASE}{path}", headers=headers, params=params, timeout=15)
            r.raise_for_status()
            return r.json()
        except Exception:
            continue
    return []


def fetch_ps_map():
    """Returns {name_lower: image_url} from live PandaScore API."""
    result = {}
    page = 1
    print("── PandaScore: fetching player list ──")
    while True:
        data = _ps_get("/csgo/players", {"per_page": 100, "page": page})
        if not data:
            break
        for p in data:
            name = (p.get("name") or "").lower()
            url  = p.get("image_url")
            if name and url:
                result[name] = url
        print(f"  page {page:>3}: {len(data)} players  ({len(result)} with URL)")
        if len(data) < 100:
            break
        page += 1
        time.sleep(0.5)
    print(f"  → {len(result)} players have a PandaScore photo URL\n")
    return result


def download_ps(player_id, url):
    dest = IMAGES_DIR / f"{player_id}.png"
    for delay in [0, 3, 8, 15]:
        if delay:
            time.sleep(delay)
        try:
            r = requests.get(url, timeout=20)
            r.raise_for_status()
            dest.write_bytes(r.content)
            return True
        except Exception:
            continue
    return False


# ── Liquipedia ────────────────────────────────────────────────────────────────

def download_liq(player_id, filename):
    dest = IMAGES_DIR / f"{player_id}.png"
    url  = liquipedia.COMMONS + filename.replace(" ", "_")
    try:
        r = requests.get(url, headers={"User-Agent": liquipedia.UA},
                         allow_redirects=True, timeout=20)
        r.raise_for_status()
        if "image" not in r.headers.get("Content-Type", ""):
            return False
        dest.write_bytes(r.content)
        return True
    except Exception:
        return False


def fetch_liq_map(cards, liq_cache):
    """Returns {player_id: filename_or_None} using cache, fetches missing."""
    result = {}
    need_fetch = []

    for p in cards:
        name = p["name"].lower()
        pid  = p["player_id"]
        if name in liq_cache:
            result[pid] = liq_cache[name].get("filename")
        else:
            need_fetch.append(p)

    print(f"── Liquipedia: {len(result)} cached, {len(need_fetch)} to fetch ──")

    if need_fetch:
        print(f"  (rate limit 1 req/2s → ~{len(need_fetch)*2//60}min {len(need_fetch)*2%60}s)")
        for i, p in enumerate(need_fetch, 1):
            name = p["name"].lower()
            pid  = p["player_id"]
            print(f"  [{i:>3}/{len(need_fetch)}] {p['name']:<22}", end="", flush=True)
            achiev = liquipedia.fetch_achievements(p["name"])
            fname  = achiev.get("liq_image")
            liq_cache[name] = {"filename": fname, "local_path": None}
            result[pid] = fname
            print(f" → {fname[:50]}" if fname else " → no image")
        LIQ_CACHE.write_text(json.dumps(liq_cache, indent=2, ensure_ascii=False))
        print()

    return result


# ── HTML report ───────────────────────────────────────────────────────────────

def make_report(cards, results):
    """results: {player_id: "liq" | "ps" | None}"""
    liq_count = sum(1 for v in results.values() if v == "liq")
    ps_count  = sum(1 for v in results.values() if v == "ps")
    none_count = sum(1 for v in results.values() if v is None)
    total = len(cards)

    rows = ""
    for p in cards:
        pid    = p["player_id"]
        name   = p["name"]
        team   = p.get("team", "")
        rar    = p.get("rarity", "")
        src    = results.get(pid)

        src_label = {"liq": "✓ LIQ", "ps": "✓ PS", None: "—"}.get(src, "—")
        src_color = {"liq": "#4aff88", "ps": "#4a9eff", None: "#666"}.get(src, "#666")

        if src:
            img = f'<img src="./images/{pid}.png" style="height:90px;width:70px;object-fit:cover;border-radius:4px">'
        else:
            img = '<div style="height:90px;width:70px;background:#1a1a22;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#444;font-size:20px">?</div>'

        rows += f"""
        <tr>
          <td style="padding:6px 10px"><b style="color:#fff">{name}</b><br><span style="color:#666;font-size:11px">{team} · {rar}</span></td>
          <td style="padding:6px 10px;text-align:center">{img}<br><span style="font-size:9px;color:{src_color}">{src_label}</span></td>
        </tr>"""

    html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Photos Report</title>
<style>
  body{{background:#0a0a0d;color:#ccc;font-family:sans-serif;padding:20px;margin:0}}
  h1{{color:#fff;margin-bottom:16px}}
  .stats{{display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap}}
  .s{{background:#12121f;padding:10px 18px;border-radius:8px;text-align:center}}
  .s b{{display:block;font-size:22px;color:#fff}}
  .s span{{font-size:11px;color:#888}}
  table{{border-collapse:collapse;width:100%;max-width:400px}}
  tr:hover{{background:#12121f}}
  th{{background:#12121f;padding:8px 10px;text-align:left;color:#888;font-size:11px;letter-spacing:.08em}}
  td{{border-bottom:1px solid #18181f;vertical-align:middle}}
</style>
</head><body>
<h1>Player Photos</h1>
<div class="stats">
  <div class="s"><b>{total}</b><span>Total players</span></div>
  <div class="s"><b style="color:#4aff88">{liq_count}</b><span>Liquipedia</span></div>
  <div class="s"><b style="color:#4a9eff">{ps_count}</b><span>PandaScore</span></div>
  <div class="s"><b style="color:#ff6b6b">{none_count}</b><span>No photo</span></div>
</div>
<table>
<thead><tr><th>Player</th><th>Photo</th></tr></thead>
<tbody>{rows}</tbody>
</table>
</body></html>"""
    REPORT_FILE.write_text(html, encoding="utf-8")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    cards     = json.loads(CARDS_FILE.read_text())
    liq_cache = json.loads(LIQ_CACHE.read_text()) if LIQ_CACHE.exists() else {}

    # Track which source was used per player
    results: dict[str, str | None] = {}

    # ── Step 1: Liquipedia filenames ──────────────────────────────────────────
    liq_map = fetch_liq_map(cards, liq_cache)

    # ── Step 2: PandaScore map (only needed for players with no Liq) ──────────
    needs_ps = [p for p in cards if not liq_map.get(p["player_id"])]
    ps_map   = {}
    if needs_ps:
        ps_map = fetch_ps_map()

    # ── Step 3: Download — Liq first, PS fallback ─────────────────────────────
    liq_tasks = [
        (p["player_id"], p["name"], liq_map[p["player_id"]])
        for p in cards
        if liq_map.get(p["player_id"])
        and (FORCE or not (IMAGES_DIR / f"{p['player_id']}.png").exists())
    ]
    ps_tasks = [
        (p["player_id"], p["name"], ps_map[p["name"].lower()])
        for p in cards
        if not liq_map.get(p["player_id"])
        and p["name"].lower() in ps_map
        and (FORCE or not (IMAGES_DIR / f"{p['player_id']}.png").exists())
    ]

    # Mark players that already have files (no download needed)
    for p in cards:
        pid = p["player_id"]
        if not FORCE and (IMAGES_DIR / f"{pid}.png").exists():
            # Determine original source from existing file — treat as liq if liq_map has it
            results[pid] = "liq" if liq_map.get(pid) else "ps"

    print(f"── Liquipedia: downloading {len(liq_tasks)} photos ──")
    for i, (pid, name, fname) in enumerate(liq_tasks, 1):
        ok = download_liq(pid, fname)
        results[pid] = "liq" if ok else None
        print(f"  [{i:>3}/{len(liq_tasks)}] {'✓' if ok else '✗'} {name}")
        time.sleep(0.15)

    print(f"\n── PandaScore: downloading {len(ps_tasks)} photos (4 workers) ──")

    def dl_ps_task(task):
        pid, name, url = task
        ok = download_ps(pid, url)
        return pid, name, ok

    done = 0
    with ThreadPoolExecutor(max_workers=4) as ex:
        futs = {ex.submit(dl_ps_task, t): t for t in ps_tasks}
        for fut in as_completed(futs):
            pid, name, ok = fut.result()
            done += 1
            results[pid] = "ps" if ok else None
            print(f"  [{done:>3}/{len(ps_tasks)}] {'✓' if ok else '✗'} {name}")

    # Players with no source at all
    for p in cards:
        if p["player_id"] not in results:
            results[p["player_id"]] = None

    # ── Step 4: Report ────────────────────────────────────────────────────────
    make_report(cards, results)

    liq_ok = sum(1 for v in results.values() if v == "liq")
    ps_ok  = sum(1 for v in results.values() if v == "ps")
    none   = sum(1 for v in results.values() if v is None)

    print(f"\n── Done ──")
    print(f"Liquipedia : {liq_ok} players")
    print(f"PandaScore : {ps_ok} players")
    print(f"No photo   : {none} players")
    print(f"Report     : output/photos_report.html")


if __name__ == "__main__":
    main()
