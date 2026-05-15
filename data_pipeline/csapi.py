import threading
import time
import requests
from datetime import datetime

BASE = "https://api.csapi.de"

# ── Logging ───────────────────────────────────────────────────────────────────

_RESET  = "\033[0m"
_GREY   = "\033[90m"
_CYAN   = "\033[96m"
_GREEN  = "\033[92m"
_YELLOW = "\033[93m"
_RED    = "\033[91m"
_BOLD   = "\033[1m"

def _ts():       return datetime.now().strftime("%H:%M:%S")
def _log(s,c,m): print(f"{_GREY}{_ts()}{_RESET}  {c}{s}{_RESET}  {m}", flush=True)
def info(m):     _log("●", _CYAN,   m)
def ok(m):       _log("✔", _GREEN,  m)
def warn(m):     _log("⚠", _YELLOW, m)
def err(m):      _log("✖", _RED,    m)
def section(m):  print(f"\n{_BOLD}{_CYAN}{'─'*60}\n  {m}\n{'─'*60}{_RESET}", flush=True)

# ── Client ────────────────────────────────────────────────────────────────────

_session      = requests.Session()
_RETRIES      = [2, 5, 10]
_rate_lock = threading.Lock()
_CALL_GAP  = 1.0  # 1 req/s — lock held for full HTTP call, no overlapping requests


def _get(path: str) -> dict | list:
    url = f"{BASE}{path}"
    with _rate_lock:  # held for entire call — truly 1 request at a time
        for attempt, delay in enumerate([0] + _RETRIES):
            if delay:
                warn(f"  retry {attempt}/{len(_RETRIES)} in {delay}s…")
                time.sleep(delay)
            try:
                resp = _session.get(url, timeout=15)
                resp.raise_for_status()
                time.sleep(_CALL_GAP)
                return resp.json()
            except Exception as e:
                if attempt < len(_RETRIES):
                    warn(f"  {url}: {e}")
                else:
                    raise


# ── Public API ────────────────────────────────────────────────────────────────

def get_rankings(limit: int = 100) -> list[dict]:
    """Top N teams with rank + points."""
    data = _get("/rankings/")
    return [r for r in data.get("rankings", []) if r["rank"] <= limit]


def get_team(team_id: int) -> dict:
    """Team detail: name, streak, roster [{id, name}]."""
    return _get(f"/teams/{team_id}")


def get_player(player_id: int | str) -> dict:
    """Player detail: name, team {id, name}, stats {rating, adr, kast, swing, k, d, N}."""
    return _get(f"/players/{player_id}")


def get_avg_opp_rank(team_id: int) -> float | None:
    """Average rank of opponents in recent matches. Returns None if no data."""
    matches = _get(f"/teams/{team_id}/matchhistory")
    if not isinstance(matches, list):
        return None
    ranks = []
    for m in matches:
        t1, t2 = m.get("team1", {}), m.get("team2", {})
        opp = t2 if t1.get("id") == team_id else t1
        r = opp.get("rank")
        if r and isinstance(r, (int, float)):
            ranks.append(r)
    return round(sum(ranks) / len(ranks), 1) if ranks else None
