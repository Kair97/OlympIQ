"""
Feature engineering.
Builds:
  - user skill vectors  (mastery per tag + global stats)
  - problem feature vectors  (tag one-hot + difficulty + quality signals)
"""

import numpy as np
import json
import time
from config import UNIFIED_TAGS, NUM_TAGS, TAG_TO_IDX
import database as db


# ─── Recency decay ────────────────────────────────────────────────────────────
def recency_weight(ts: int, now: int = None, half_life_days: int = 180) -> float:
    """Exponential decay: problems solved 6 months ago count half as much."""
    now    = now or int(time.time())
    age_d  = max(0, (now - ts) / 86400)
    return 2 ** (-age_d / half_life_days)


# ─── Problem feature vector ───────────────────────────────────────────────────
def build_problem_feature_vector(problem: dict) -> np.ndarray:
    """
    Fixed-length vector for one problem:
      [0..NUM_TAGS-1]  multi-hot unified tag flags
      [NUM_TAGS]       normalized difficulty (0–1)
      [NUM_TAGS+1]     acceptance rate (0–1)
      [NUM_TAGS+2]     log-normalized solved count
      [NUM_TAGS+3]     is_codeforces flag
      [NUM_TAGS+4]     is_leetcode flag
      [NUM_TAGS+5]     has_cf_rating flag
    """
    vec = np.zeros(NUM_TAGS + 6, dtype=np.float32)

    # Tags
    tags = json.loads(problem.get("tags") or "[]")
    for tag in tags:
        idx = TAG_TO_IDX.get(tag)
        if idx is not None:
            vec[idx] = 1.0

    # Scalar features
    vec[NUM_TAGS]     = float(problem.get("difficulty", 0.5))
    vec[NUM_TAGS + 1] = float(problem.get("ac_rate", 0.5))

    solved = problem.get("solved_count", 0) or 0
    vec[NUM_TAGS + 2] = np.log1p(solved) / np.log1p(1_000_000)   # normalize ~0-1

    platform = problem.get("platform", "")
    vec[NUM_TAGS + 3] = 1.0 if platform == "codeforces" else 0.0
    vec[NUM_TAGS + 4] = 1.0 if platform == "leetcode"   else 0.0
    vec[NUM_TAGS + 5] = 1.0 if problem.get("cf_rating") else 0.0

    return vec


def build_all_problem_vectors() -> dict:
    """Returns {problem_db_id: np.ndarray} for every problem in DB."""
    problems = db.get_all_problems()
    return {p["id"]: build_problem_feature_vector(p) for p in problems}


# ─── User feature vector ──────────────────────────────────────────────────────
def compute_tag_mastery(submissions: list) -> np.ndarray:
    """
    For each unified tag: weighted sum of solved problems tagged with it.
    Weight = recency_decay × difficulty_factor × (1 if AC else 0.15)
    Normalized to [0, 1] by capping at heavy mastery.
    """
    tag_scores = np.zeros(NUM_TAGS, dtype=np.float32)
    now = int(time.time())

    for sub in submissions:
        is_ac       = sub.get("verdict") == "AC"
        verdict_w   = 1.0 if is_ac else 0.15
        difficulty  = float(sub.get("difficulty") or 0.5)
        diff_w      = 0.5 + difficulty           # harder problems = more signal
        rec_w       = recency_weight(sub.get("timestamp", 0), now)
        weight      = verdict_w * diff_w * rec_w

        tags = json.loads(sub.get("tags") or "[]")
        for tag in tags:
            idx = TAG_TO_IDX.get(tag)
            if idx is not None:
                tag_scores[idx] += weight

    # Normalize: sigmoid-like squash so 0 = never tried, 1 = heavily practiced
    tag_scores = tag_scores / (tag_scores + 5.0)   # soft cap; 5 good solves ≈ 0.5
    return tag_scores


def compute_user_global_stats(user: dict, submissions: list) -> np.ndarray:
    """
    6-dim global stat vector:
      [0] normalized rating (CF scale, 0–1 for 0–3500)
      [1] solve_rate  = AC / total submissions
      [2] activity    = active weeks / 52 (last year)
      [3] avg_difficulty of solved problems
      [4] rating_velocity (delta / 30d, normalized)
      [5] total_solved log-normalized
    """
    rating   = float(user.get("rating") or 0) / 3500.0

    total    = len(submissions)
    ac_count = sum(1 for s in submissions if s.get("verdict") == "AC")
    solve_rate = ac_count / max(total, 1)

    now = int(time.time())
    year_ago = now - 365 * 86400
    recent_ts = [s["timestamp"] for s in submissions if s["timestamp"] > year_ago]
    active_weeks = len(set(t // (7 * 86400) for t in recent_ts))
    activity = min(active_weeks / 52.0, 1.0)

    solved_subs = [s for s in submissions if s.get("verdict") == "AC"]
    avg_diff = (np.mean([s.get("difficulty", 0.5) for s in solved_subs])
                if solved_subs else 0.5)

    # Rating velocity: change in last 30d (rough from DB data)
    month_ago = now - 30 * 86400
    recent_ac = sum(1 for s in submissions
                    if s.get("verdict") == "AC" and s["timestamp"] > month_ago)
    # proxy: more AC recently relative to rating = positive velocity
    velocity = min(recent_ac / max(ac_count, 1) * 2.0, 1.0)

    total_solved_norm = np.log1p(ac_count) / np.log1p(5000)

    return np.array([rating, solve_rate, activity, avg_diff, velocity,
                     total_solved_norm], dtype=np.float32)


def build_user_feature_vector(user_id: int) -> np.ndarray:
    """
    Full user vector: [tag_mastery (NUM_TAGS) | global_stats (6)]
    Total dimension = NUM_TAGS + 6
    """
    subs  = db.get_user_submissions(user_id)
    users = db.get_all_users()
    user  = next((u for u in users if u["id"] == user_id), {})

    mastery = compute_tag_mastery(subs)
    stats   = compute_user_global_stats(user, subs)
    vec     = np.concatenate([mastery, stats]).astype(np.float32)
    return vec


def build_and_cache_all_user_vectors():
    """Compute and store feature vectors for all users in DB."""
    users = db.get_all_users()
    print(f"Building feature vectors for {len(users)} users...")
    for user in users:
        vec = build_user_feature_vector(user["id"])
        db.save_user_vector(user["id"], vec.tolist())
    print("Done caching user vectors.")


# ─── Sequence builder (for SASRec) ───────────────────────────────────────────
def build_user_solve_sequence(user_id: int) -> list:
    """
    Return ordered list of problem DB IDs that user solved (AC), by timestamp.
    Deduped: each problem appears at most once (first solve time).
    """
    subs = db.get_user_submissions(user_id, verdict_filter="AC")
    seen, seq = set(), []
    for s in sorted(subs, key=lambda x: x["timestamp"]):
        pid = s["problem_id"]
        if pid not in seen:
            seq.append(pid)
            seen.add(pid)
    return seq


def build_all_sequences() -> list:
    """Returns list of sequences (one per user with enough data)."""
    users = db.get_all_users()
    seqs  = []
    for u in users:
        seq = build_user_solve_sequence(u["id"])
        if len(seq) >= 5:   # need at least 5 solves to be useful
            seqs.append(seq)
    print(f"Built {len(seqs)} sequences (users with ≥5 solved problems)")
    return seqs


# ─── Weak tag identification ──────────────────────────────────────────────────
def get_weak_tags(user_id: int, top_n: int = 5) -> list:
    """
    Tags the user has attempted but has low mastery — prime recommendation targets.
    """
    subs      = db.get_user_submissions(user_id)
    mastery   = compute_tag_mastery(subs)

    # Count attempts per tag (including WA)
    attempt_counts = np.zeros(NUM_TAGS, dtype=np.float32)
    for s in subs:
        tags = json.loads(s.get("tags") or "[]")
        for tag in tags:
            idx = TAG_TO_IDX.get(tag)
            if idx is not None:
                attempt_counts[idx] += 1

    # Weak = tried but low mastery
    attempted_mask = attempt_counts > 0
    weakness_score = np.where(attempted_mask, 1.0 - mastery, 0.0)
    top_indices    = np.argsort(-weakness_score)[:top_n]
    return [UNIFIED_TAGS[i] for i in top_indices if weakness_score[i] > 0]
