"""
Codeforces API client.
Collects: problems, user info, submission history, rating history.
All endpoints are public — no authentication needed.
"""

import requests
import time
import json
from tqdm import tqdm
from config import CF_API_BASE, CF_API_DELAY, CF_TAG_MAP, UNIFIED_TAGS
from config import CF_DIFF_MIN, CF_DIFF_MAX, CF_MAX_SUBMISSIONS
import database as db


# ─── Low-level request helper ─────────────────────────────────────────────────
def _cf_get(endpoint: str, params: dict = None, retries=3) -> dict | None:
    url = f"{CF_API_BASE}/{endpoint}"
    for attempt in range(retries):
        try:
            time.sleep(CF_API_DELAY)
            resp = requests.get(url, params=params, timeout=15)
            data = resp.json()
            if data.get("status") == "OK":
                return data["result"]
            print(f"  CF API error on {endpoint}: {data.get('comment', 'unknown')}")
            return None
        except Exception as e:
            if attempt == retries - 1:
                print(f"  CF request failed after {retries} tries: {e}")
                return None
            time.sleep(2 ** attempt)
    return None


# ─── Tag normalization ────────────────────────────────────────────────────────
def normalize_cf_tags(raw_tags: list) -> list:
    unified = []
    for tag in raw_tags:
        mapped = CF_TAG_MAP.get(tag.lower().strip())
        if mapped and mapped not in unified:
            unified.append(mapped)
    return unified


def normalize_cf_difficulty(rating: int | None) -> float:
    if not rating:
        return 0.5
    clamped = max(CF_DIFF_MIN, min(CF_DIFF_MAX, rating))
    return (clamped - CF_DIFF_MIN) / (CF_DIFF_MAX - CF_DIFF_MIN)


# ─── Problem collection ───────────────────────────────────────────────────────
def fetch_all_problems() -> int:
    """Download full Codeforces problem set and store in DB. Returns count."""
    print("Fetching Codeforces problem set...")
    result = _cf_get("problemset.problems")
    if not result:
        print("Failed to fetch CF problems")
        return 0

    problems   = result.get("problems", [])
    stats      = result.get("problemStatistics", [])
    stat_map   = {(s["contestId"], s["index"]): s.get("solvedCount", 0) for s in stats}

    stored = 0
    for p in tqdm(problems, desc="Storing CF problems"):
        cid   = p.get("contestId")
        idx   = p.get("index", "")
        if not cid:
            continue

        pid       = f"{cid}_{idx}"
        rating    = p.get("rating")
        raw_tags  = p.get("tags", [])
        unified   = normalize_cf_tags(raw_tags)
        difficulty= normalize_cf_difficulty(rating)
        solved    = stat_map.get((cid, idx), 0)

        db.upsert_problem(
            platform     = "codeforces",
            platform_id  = pid,
            title        = p.get("name", ""),
            difficulty   = difficulty,
            cf_rating    = rating,
            tags         = unified,
            ac_rate      = 0.5,           # CF doesn't expose AC rate directly
            solved_count = solved,
        )
        stored += 1

    print(f"Stored {stored} Codeforces problems")
    return stored


# ─── User info ────────────────────────────────────────────────────────────────
def fetch_user_info(handle: str) -> dict | None:
    result = _cf_get("user.info", {"handles": handle})
    if not result:
        return None
    return result[0]


def store_user(info: dict) -> int:
    return db.upsert_user(
        platform      = "codeforces",
        handle        = info["handle"],
        rating        = info.get("rating", 0),
        max_rating    = info.get("maxRating", 0),
        rank          = info.get("rank", ""),
        registered_at = info.get("registrationTimeSeconds", 0),
    )


# ─── Submission collection ────────────────────────────────────────────────────
VERDICT_MAP = {
    "OK": "AC",
    "WRONG_ANSWER": "WA",
    "TIME_LIMIT_EXCEEDED": "TLE",
    "MEMORY_LIMIT_EXCEEDED": "MLE",
    "RUNTIME_ERROR": "RTE",
    "COMPILATION_ERROR": "CE",
    "PARTIAL": "PA",
}


def fetch_user_submissions(handle: str, user_id: int) -> int:
    """Download and store all submissions for a CF user. Returns count."""
    result = _cf_get("user.status", {"handle": handle, "count": CF_MAX_SUBMISSIONS})
    if not result:
        return 0

    stored = 0
    seen_ac = set()   # deduplicate: one AC per problem counts

    for sub in result:
        prob = sub.get("problem", {})
        cid  = prob.get("contestId")
        idx  = prob.get("index", "")
        if not cid:
            continue

        pid     = f"{cid}_{idx}"
        verdict = VERDICT_MAP.get(sub.get("verdict", ""), sub.get("verdict", "WA"))
        ts      = sub.get("creationTimeSeconds", 0)
        lang    = sub.get("programmingLanguage", "")
        time_ms = sub.get("timeConsumedMillis", 0)

        # Ensure problem exists in DB (may have been added from problemset)
        problem_db_id = db.get_problem_id("codeforces", pid)
        if not problem_db_id:
            # Store minimal record
            db.upsert_problem(
                platform    = "codeforces",
                platform_id = pid,
                title       = prob.get("name", ""),
                difficulty  = normalize_cf_difficulty(prob.get("rating")),
                cf_rating   = prob.get("rating"),
                tags        = normalize_cf_tags(prob.get("tags", [])),
            )
            problem_db_id = db.get_problem_id("codeforces", pid)

        if problem_db_id:
            # For CF model: store every AC once, WA separately for attempt signal
            if verdict == "AC":
                key = (user_id, problem_db_id)
                if key not in seen_ac:
                    db.insert_submission(user_id, problem_db_id, "AC", ts, lang, time_ms)
                    seen_ac.add(key)
                    stored += 1
            else:
                db.insert_submission(user_id, problem_db_id, verdict, ts, lang, time_ms)
                stored += 1

    return stored


# ─── Rating history ───────────────────────────────────────────────────────────
def fetch_rating_history(handle: str) -> list:
    result = _cf_get("user.rating", {"handle": handle})
    return result or []


# ─── Seed user collection ─────────────────────────────────────────────────────
def get_seed_handles(count: int = 200) -> list:
    """
    Fetch handles of active, rated users from recent contest participants.
    We use ratedList with a minimum rating to get quality training data.
    """
    print(f"Fetching {count} seed CF user handles...")
    result = _cf_get("user.ratedList", {"activeOnly": "true", "includeRetired": "false"})
    if not result:
        # Fallback: use known competitive programmers
        return FALLBACK_HANDLES[:count]

    # Filter: rating >= 1200, sort descending to get diverse quality range
    rated = [u for u in result if u.get("rating", 0) >= 1200]
    rated.sort(key=lambda u: u.get("rating", 0), reverse=True)

    # Sample evenly across rating ranges to get diversity
    step  = max(1, len(rated) // count)
    picks = rated[::step][:count]
    return [u["handle"] for u in picks]


def collect_users(handles: list) -> int:
    """Collect user info + submissions for a list of handles."""
    total_subs = 0
    for handle in tqdm(handles, desc="Collecting CF users"):
        info = fetch_user_info(handle)
        if not info:
            continue
        if info.get("rating", 0) < 800:
            continue
        user_id   = store_user(info)
        subs      = fetch_user_submissions(handle, user_id)
        total_subs += subs
    print(f"Collected {total_subs} total CF submissions from {len(handles)} users")
    return total_subs


# ─── Fallback handles (well-known CF users across rating ranges) ──────────────
FALLBACK_HANDLES = [
    "tourist", "Petr", "Um_nik", "jiangly", "ecnerwala", "Radewoosh",
    "mnbvmar", "scott_wu", "neal", "maroonrk", "244mhq", "benq",
    "tmwilliamlin", "Benq", "Retired_amturner", "kotatsugame",
    "ksun48", "tfg", "newbiedmy", "Ormlis",
]
