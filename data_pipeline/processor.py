"""
Transforms raw player data into FUT-style card objects.
Stats source: csapi.de (rating, adr, kast, swing, k, d)
"""

# ── Nationality → ISO 3166-1 alpha-2 ─────────────────────────────────────────

_NAT_ISO: dict[str, str] = {
    "France": "FR", "Denmark": "DK", "Sweden": "SE", "Finland": "FI",
    "Norway": "NO", "Netherlands": "NL", "Belgium": "BE", "Germany": "DE",
    "Poland": "PL", "Czech Republic": "CZ", "Slovakia": "SK", "Hungary": "HU",
    "Romania": "RO", "Bulgaria": "BG", "Serbia": "RS", "Croatia": "HR",
    "Bosnia and Herzegovina": "BA", "North Macedonia": "MK", "Albania": "AL",
    "Montenegro": "ME", "Kosovo": "XK", "Slovenia": "SI", "Estonia": "EE",
    "Latvia": "LV", "Lithuania": "LT", "Belarus": "BY", "Ukraine": "UA",
    "Russia": "RU", "Kazakhstan": "KZ", "Georgia": "GE", "Armenia": "AM",
    "Portugal": "PT", "Spain": "ES", "Italy": "IT", "United Kingdom": "GB",
    "Turkey": "TR", "United States": "US", "Canada": "CA", "Brazil": "BR",
    "Argentina": "AR", "Chile": "CL", "Australia": "AU", "China": "CN",
    "South Korea": "KR", "Indonesia": "ID", "Mongolia": "MN", "Japan": "JP",
    "Israel": "IL", "South Africa": "ZA", "Morocco": "MA",
}


def _nat_iso(nationality: str | None) -> str | None:
    return _NAT_ISO.get(nationality) if nationality else None


# ── Category definitions ──────────────────────────────────────────────────────
#
# Mapped from available csapi.de stats. Ranges calibrated on pro player data.
#
# firepower   → ADR  (damage per round = raw impact)
# opening     → swing (K-D differential = first duel wins)
# clutching   → KAST (round contribution % = surviving/contributing)
# entrying    → K per map (raw aggression volume)
# trading     → K/D ratio (net positive duels)
# impact      → rating (composite performance)

def _norm(val: float, lo: float, hi: float) -> int:
    return max(0, min(99, round((val - lo) / (hi - lo) * 99)))


def _category_scores(stats: dict) -> dict:
    rating = stats.get("rating", 1.0)
    adr    = stats.get("adr",    70.0)
    kast   = stats.get("kast",   70.0)
    swing  = stats.get("swing",  0.0)
    k      = stats.get("k",      14.0)
    d      = stats.get("d",      14.0)
    kd     = k / max(d, 0.1)

    return {
        "firepower": _norm(adr,    45,  110),
        "opening":   _norm(swing,  -4,    8),
        "clutching": _norm(kast,   55,   88),
        "entrying":  _norm(k,       8,   26),
        "trading":   _norm(kd,    0.55, 2.1),
        "impact":    _norm(rating, 0.75, 1.65),
    }


# ── Overall formula ───────────────────────────────────────────────────────────

def _comp_mult(avg_opp_rank: float | None) -> float:
    """Debuff ratings earned against weaker competition (based on avg opponent rank)."""
    if avg_opp_rank is None: return 0.97  # unknown → conservative default
    if avg_opp_rank <= 25:   return 1.00  # élite schedule (top teams entre eux)
    if avg_opp_rank <= 50:   return 0.99
    if avg_opp_rank <= 75:   return 0.97  # médian ~75 → léger debuff
    if avg_opp_rank <= 100:  return 0.95
    return 0.93                           # surtout contre des équipes faibles (>100)


def _team_bonus(rank: int) -> int:
    """Small prestige bump based on team world ranking."""
    if rank == 1:   return 5
    if rank <= 3:   return 4
    if rank <= 5:   return 3
    if rank <= 10:  return 3
    if rank <= 25:  return 2
    if rank <= 40:  return 1
    if rank <= 70:  return 1
    return 0


def _achievement_bonus(raw: dict) -> float:
    # V1: only Top20 HLTV — the only reliably parseable achievement from Liquipedia.
    # V2: add mvp_count, major_count, major_mvp_count once parsing is improved.
    top20 = raw.get("top20") or {}
    if not top20:
        return 0.0
    pts = sum((21 - rank) / 20 for rank in top20.values())
    return min(6, pts)


def _calc_overall(rating: float, team_rank: int, avg_opp_rank: float | None = None, raw: dict | None = None) -> int:
    n         = int((raw or {}).get("N") or 0)
    # Dampen toward 1.0 for low sample sizes (reliable at N >= 30)
    reliability = min(1.0, n / 30) if n else 0.5
    effective   = (1.0 + (rating - 1.0) * reliability) * _comp_mult(avg_opp_rank)
    base        = max(0, min(99, round((effective - 0.87) * (67 / 0.58) + 30)))
    achiev      = round(_achievement_bonus(raw or {}))
    return min(99, base + _team_bonus(team_rank) + achiev)


# ── Rarity ────────────────────────────────────────────────────────────────────

def _assign_rarity(overall: int, rating: float, mvp_count: int = 0, top20_count: int = 0) -> str:
    """
    Icon: overall >= 90 AND real achievements when available (mvp or top20),
    otherwise proxy rating >= 1.35 as fallback for players without Liquipedia data.
    """
    if overall >= 90:
        if mvp_count > 0 or top20_count > 0:
            return "icon"
        if rating >= 1.35:
            return "icon"
    if overall >= 68:
        return "diamond"
    if overall >= 56:
        return "gold"
    if overall >= 46:
        return "silver"
    return "bronze"


# ── Card builder ──────────────────────────────────────────────────────────────

def build_card(
    raw: dict,
    team_rank: int = 100,
    avg_opp_rank: float | None = None,
    team_logo: str | None = None,
    team_acronym: str | None = None,
) -> dict:
    rating    = float(raw.get("rating") or 1.0)
    stats     = {k: raw.get(k, 0.0) for k in ("rating", "adr", "kast", "swing", "k", "d")}
    ov        = _calc_overall(rating, team_rank, avg_opp_rank, raw)
    mvp_count = int(raw.get("mvp_count") or 0)
    t20_count = int(raw.get("top20_count") or 0)
    nat       = raw.get("nationality")

    return {
        "player_id":       raw["player_id"],
        "name":            raw.get("name", ""),
        "first_name":      raw.get("first_name"),
        "last_name":       raw.get("last_name"),
        "age":             raw.get("age"),
        "roles":           raw.get("roles") or [],
        "team":            raw.get("team_name", ""),
        "team_rank":       team_rank,
        "team_logo":       team_logo,
        "team_acronym":    team_acronym,
        "nationality":     nat,
        "nationality_iso": _nat_iso(nat),
        "image_url":       raw.get("image_url"),
        "photo_local":     raw.get("photo_local"),
        "no_photo":        raw.get("no_photo", False),
        "rarity":          _assign_rarity(ov, rating, mvp_count, t20_count),
        "overall":         ov,
        "category_scores": _category_scores(stats),
        "raw_stats":       stats,
        "achievements": {
            "mvp_count":       mvp_count,
            "major_mvp_count": int(raw.get("major_mvp_count") or 0),
            "major_count":     int(raw.get("major_count") or 0),
            "top20_count":     t20_count,
            "top1_count":      int(raw.get("top1_count") or 0),
            "best_rank":       raw.get("best_rank"),
            "top20":           raw.get("top20"),
        },
        "N":               raw.get("N", 0),
    }


# ── Batch processing ──────────────────────────────────────────────────────────

def process_players(raw_players: list[dict], teams: list[dict] | None = None) -> list[dict]:
    team_info: dict[str, dict] = {}
    if teams:
        for t in teams:
            team_info[t["name"]] = {
                "rank":         t.get("rank",         100),
                "avg_opp_rank": t.get("avg_opp_rank", None),
                "logo":         t.get("logo_local"),
                "acronym":      t.get("acronym"),
            }

    cards = []
    for p in raw_players:
        ti = team_info.get(p.get("team_name", ""), {})
        cards.append(build_card(
            p,
            team_rank=ti.get("rank",         100),
            avg_opp_rank=ti.get("avg_opp_rank", None),
            team_logo=ti.get("logo"),
            team_acronym=ti.get("acronym"),
        ))

    cards.sort(key=lambda c: c["overall"], reverse=True)
    return cards


def rarity_distribution(cards: list[dict]) -> dict:
    dist: dict[str, int] = {}
    for c in cards:
        dist[c["rarity"]] = dist.get(c["rarity"], 0) + 1
    return dict(sorted(dist.items()))
