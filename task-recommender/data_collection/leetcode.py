"""
LeetCode GraphQL API client.
Collects: problem list + metadata, user stats (where public).
Note: full submission history requires auth cookies — we collect what's public.
"""

import requests
import time
import json
from tqdm import tqdm
from config import LC_GRAPHQL, LC_API_DELAY, LC_TAG_MAP, LC_DIFF_MAP
import database as db


HEADERS = {
    "Content-Type":  "application/json",
    "Referer":       "https://leetcode.com",
    "User-Agent":    "Mozilla/5.0 (compatible; CPRecommender/1.0)",
    "x-csrftoken":   "na",
}

SESSION = requests.Session()
SESSION.headers.update(HEADERS)


# ─── Low-level request helper ─────────────────────────────────────────────────
def _lc_query(query: str, variables: dict = None, retries=3) -> dict | None:
    payload = {"query": query}
    if variables:
        payload["variables"] = variables

    for attempt in range(retries):
        try:
            time.sleep(LC_API_DELAY)
            resp = SESSION.post(LC_GRAPHQL, json=payload, timeout=20)
            if resp.status_code == 200:
                data = resp.json()
                return data.get("data")
            if resp.status_code == 429:
                wait = 5 * (attempt + 1)
                print(f"  LC rate limited, waiting {wait}s...")
                time.sleep(wait)
        except Exception as e:
            if attempt == retries - 1:
                print(f"  LC request failed: {e}")
    return None


# ─── Tag normalization ────────────────────────────────────────────────────────
def normalize_lc_tags(topic_tags: list) -> list:
    unified = []
    for t in topic_tags:
        slug   = t.get("slug", "").lower()
        mapped = LC_TAG_MAP.get(slug)
        if mapped and mapped not in unified:
            unified.append(mapped)
    return unified


# ─── Problem collection ───────────────────────────────────────────────────────
PROBLEMS_QUERY = """
query problemsetQuestionList($skip: Int, $limit: Int) {
  problemsetQuestionList: questionList(
    categorySlug: ""
    limit: $limit
    skip: $skip
    filters: {}
  ) {
    total: totalNum
    questions: data {
      titleSlug
      title
      difficulty
      acRate
      topicTags { slug name }
      isPaidOnly
      questionFrontendId
    }
  }
}
"""


def fetch_all_problems(page_size: int = 100) -> int:
    """Download full LC problem list and store in DB. Returns count."""
    print("Fetching LeetCode problems...")

    # First get total count
    first_page = _lc_query(PROBLEMS_QUERY, {"skip": 0, "limit": 1})
    if not first_page:
        print("Failed to connect to LeetCode API")
        return 0

    total = first_page["problemsetQuestionList"]["total"]
    print(f"Total LC problems: {total}")

    stored = 0
    for skip in tqdm(range(0, total, page_size), desc="Fetching LC pages"):
        page = _lc_query(PROBLEMS_QUERY, {"skip": skip, "limit": page_size})
        if not page:
            continue

        questions = page["problemsetQuestionList"]["questions"]
        for q in questions:
            if q.get("isPaidOnly"):
                continue   # skip locked problems

            slug       = q["titleSlug"]
            difficulty = q.get("difficulty", "Medium")
            diff_norm  = LC_DIFF_MAP.get(difficulty, 0.55)
            ac_rate    = q.get("acRate", 50.0) / 100.0
            tags       = normalize_lc_tags(q.get("topicTags", []))

            db.upsert_problem(
                platform      = "leetcode",
                platform_id   = slug,
                title         = q.get("title", ""),
                difficulty    = diff_norm,
                lc_difficulty = difficulty,
                tags          = tags,
                ac_rate       = ac_rate,
                solved_count  = 0,         # LC doesn't expose exact counts publicly
            )
            stored += 1

    print(f"Stored {stored} LeetCode problems")
    return stored


# ─── User public stats ────────────────────────────────────────────────────────
USER_QUERY = """
query userPublicProfile($username: String!) {
  matchedUser(username: $username) {
    username
    submitStats: submitStatsGlobal {
      acSubmissionNum {
        difficulty
        count
        submissions
      }
    }
    profile {
      ranking
    }
    userCalendar { streak totalActiveDays }
    badges { name }
  }
}
"""

RECENT_SOLVED_QUERY = """
query recentAcSubmissions($username: String!, $limit: Int!) {
  recentAcSubmissionList(username: $username, limit: $limit) {
    titleSlug
    timestamp
    lang
  }
}
"""


def fetch_user_stats(username: str) -> dict | None:
    data = _lc_query(USER_QUERY, {"username": username})
    if not data or not data.get("matchedUser"):
        return None
    return data["matchedUser"]


def fetch_recent_solved(username: str, limit: int = 50) -> list:
    data = _lc_query(RECENT_SOLVED_QUERY, {"username": username, "limit": limit})
    if not data:
        return []
    return data.get("recentAcSubmissionList", [])


def store_lc_user_submissions(username: str) -> int:
    """
    Store LC user info and recent solved problems.
    Full history needs auth; we use public recent submissions (up to 20).
    """
    stats = fetch_user_stats(username)
    if not stats:
        return 0

    # Estimate a pseudo-rating from ranking (LC doesn't expose contest rating publicly without auth)
    ranking  = stats.get("profile", {}).get("ranking", 999999)
    # Very rough heuristic: top 5k ≈ CF 2000+, top 50k ≈ CF 1500, top 200k ≈ CF 1200
    pseudo_cf = max(800, 2200 - int(ranking / 200))

    submit_stats = stats.get("submitStats", {}).get("acSubmissionNum", [])
    total_ac = sum(s.get("count", 0) for s in submit_stats)

    user_id = db.upsert_user(
        platform  = "leetcode",
        handle    = username,
        rating    = pseudo_cf,
        max_rating= pseudo_cf,
        rank      = f"rank_{ranking}",
    )

    # Fetch and store recent solved problems
    recent = fetch_recent_solved(username, limit=20)
    stored = 0
    for sub in recent:
        slug      = sub.get("titleSlug")
        timestamp = int(sub.get("timestamp", 0))
        lang      = sub.get("lang", "")

        if not slug:
            continue

        problem_id = db.get_problem_id("leetcode", slug)
        if not problem_id:
            # Minimal record for unknown problem
            db.upsert_problem("leetcode", slug, slug, 0.55)
            problem_id = db.get_problem_id("leetcode", slug)

        if problem_id:
            db.insert_submission(user_id, problem_id, "AC", timestamp, lang)
            stored += 1

    return stored


# ─── Problem similarity (from LC similar questions field) ─────────────────────
SIMILAR_QUERY = """
query similarQuestions($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    similarQuestions
  }
}
"""


def fetch_similar_questions(slug: str) -> list:
    """Returns list of similar question slugs — useful for content graph."""
    data = _lc_query(SIMILAR_QUERY, {"titleSlug": slug})
    if not data or not data.get("question"):
        return []
    raw = data["question"].get("similarQuestions", "[]")
    try:
        parsed = json.loads(raw)
        return [q.get("titleSlug", "") for q in parsed]
    except Exception:
        return []
