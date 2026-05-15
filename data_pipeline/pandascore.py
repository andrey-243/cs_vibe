import os
import time
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

BASE       = "https://api.pandascore.co"
TOKEN      = os.environ["PANDASCORE_TOKEN"]
IMAGES_DIR = Path(__file__).parent / "output" / "images"
LOGOS_DIR  = Path(__file__).parent / "output" / "team_logos"
_RETRIES   = [2, 5, 10]


def _get(path: str, params: dict = None) -> dict | list:
    url     = f"{BASE}{path}"
    headers = {"Authorization": f"Bearer {TOKEN}"}
    for attempt, delay in enumerate([0] + _RETRIES):
        if delay:
            time.sleep(delay)
        try:
            resp = requests.get(url, headers=headers, params=params, timeout=15)
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            if attempt < len(_RETRIES):
                pass
            else:
                raise


def fetch_all_players() -> dict[str, dict]:
    """
    Returns dict keyed by slug (lowercase nickname).
    Paginates through all CS2 players to build an identity lookup.
    """
    result = {}
    page   = 1
    while True:
        data = _get(
            "/csgo/players",
            params={"per_page": 100, "page": page, "videogame_title": "cs-2"},
        )
        if not data:
            break
        for p in data:
            entry = {
                "first_name":  p.get("first_name"),
                "last_name":   p.get("last_name"),
                "nationality": p.get("nationality"),
                "image_url":   p.get("image_url"),
                "age":         p.get("age"),
            }
            # Index by name.lower() (primary lookup key) AND by slug as fallback
            name_key = p.get("name", "").lower()
            if name_key:
                result[name_key] = entry
            slug = p.get("slug", "")
            if slug and slug != name_key:
                result[slug] = entry
        if len(data) < 100:
            break
        page += 1
        time.sleep(0.4)
    return result


def fetch_recent_event_teams(days: int = 21) -> set[str]:
    """
    Returns lowercase team names that participated in events
    ending in the last N days (tiers S/A/B).
    Used to scope Liquipedia re-fetches on weekly refresh.
    """
    from datetime import datetime, timezone, timedelta
    now    = datetime.now(timezone.utc)
    cutoff = (now - timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%SZ")
    end    = now.strftime("%Y-%m-%dT%H:%M:%SZ")

    data = _get("/csgo/tournaments", params={
        "sort":          "-end_at",
        "filter[tier]":  "s,a,b",
        "range[end_at]": f"{cutoff},{end}",
        "per_page":      50,
    })
    names: set[str] = set()
    for t in (data or []):
        for team in t.get("teams", []):
            if team.get("name"):
                names.add(team["name"].lower())
    return names


def fetch_all_teams() -> dict[str, dict]:
    """
    Returns dict keyed by lowercase team name.
    Contains image_url, acronym, slug for each team.
    """
    result = {}
    page   = 1
    while True:
        data = _get("/csgo/teams", params={"per_page": 100, "page": page})
        if not data:
            break
        for t in data:
            key = t.get("name", "").lower()
            result[key] = {
                "image_url": t.get("image_url"),
                "acronym":   t.get("acronym"),
                "slug":      t.get("slug"),
            }
        if len(data) < 100:
            break
        page += 1
        time.sleep(0.4)
    return result


def download_team_logo(team_name: str, image_url: str) -> str | None:
    if not image_url:
        return None

    LOGOS_DIR.mkdir(parents=True, exist_ok=True)
    safe = team_name.lower().replace(" ", "_").replace("/", "-")
    ext  = image_url.split("?")[0].rsplit(".", 1)[-1] or "png"
    path = LOGOS_DIR / f"{safe}.{ext}"

    if path.exists():
        return str(path)

    try:
        resp = requests.get(image_url, timeout=15)
        resp.raise_for_status()
        path.write_bytes(resp.content)
        time.sleep(0.1)
        return str(path)
    except Exception:
        return None


def download_image(player_id: int | str, image_url: str) -> str | None:
    if not image_url:
        return None

    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    ext  = image_url.split("?")[0].rsplit(".", 1)[-1] or "png"
    path = IMAGES_DIR / f"{player_id}.{ext}"

    if path.exists():
        return str(path)

    try:
        resp = requests.get(image_url, timeout=15)
        resp.raise_for_status()
        path.write_bytes(resp.content)
        time.sleep(0.1)
        return str(path)
    except Exception:
        return None
