"""
Monthly refresh runner.
Add tasks to MONTHLY_TASKS to extend. Each task is a (name, fn) tuple.

Usage:
  python3 monthly.py           # run all tasks
  python3 monthly.py synergy   # run one task by name
"""

import json
import sys
import time
from pathlib import Path

import liquipedia
import photos

CARDS_FILE = Path(__file__).parent / "output" / "players_cards.json"


def _load_entries() -> list[tuple[str, str]]:
    players = json.loads(CARDS_FILE.read_text())
    seen, entries = set(), []
    for p in players:
        pid = str(p.get("player_id", ""))
        if pid and pid not in seen and p.get("name"):
            seen.add(pid)
            entries.append((pid, p["name"]))
    return entries


# ── Task definitions ──────────────────────────────────────────────────────────

def task_photos():
    """Re-download all player photos — Liquipedia first, PandaScore fallback."""
    sys.argv = ["photos.py", "--force"]
    photos.main()


def task_synergy():
    """Re-fetch all team histories from Liquipedia and recompute synergy pairs."""
    entries = _load_entries()
    print(f"[synergy] Full rebuild — {len(entries)} players", flush=True)
    liquipedia.synergy_full_rebuild(entries, force=True)
    data = json.loads(liquipedia.SYNERGY_FILE.read_text())
    print(f"[synergy] Done. {data['total_pairs']} pairs.", flush=True)


# ── Runner ────────────────────────────────────────────────────────────────────

MONTHLY_TASKS = [
    ("photos",  task_photos),
    ("synergy", task_synergy),
    # ("next_task", task_next),  ← add future monthly tasks here
]


def main():
    target = sys.argv[1] if len(sys.argv) > 1 else None
    tasks  = [(n, fn) for n, fn in MONTHLY_TASKS if target is None or n == target]

    if not tasks:
        print(f"Unknown task '{target}'. Available: {[n for n, _ in MONTHLY_TASKS]}")
        sys.exit(1)

    print(f"Monthly refresh — running {len(tasks)} task(s)", flush=True)
    for name, fn in tasks:
        print(f"\n{'─'*50}\n  {name}\n{'─'*50}", flush=True)
        t = time.time()
        fn()
        print(f"[{name}] {time.time()-t:.1f}s", flush=True)


if __name__ == "__main__":
    main()
