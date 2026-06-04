"""
CLI entry point for the CP Recommender System.

Commands:
  python main.py collect              — Collect problems + seed users from CF/LC
  python main.py collect --cf-users 100
  python main.py add-user tourist     — Add a specific CF user
  python main.py train                — Train all 4 models
  python main.py recommend tourist    — Get recommendations for a user
  python main.py stats                — Show database statistics
  python main.py demo                 — Run a full demo with synthetic data
"""

import argparse
import sys
import os
import io

# Force UTF-8 output on Windows (cp1251 console can't print Unicode symbols)
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace", line_buffering=True)
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace", line_buffering=True)

# Ensure project root is on path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import database as db
from recommender import Recommender
from config import CF_SEED_USERS


# ─── Commands ─────────────────────────────────────────────────────────────────
def cmd_collect(args):
    """Collect problems and user data from Codeforces and LeetCode."""
    db.init_db()

    if not args.skip_problems:
        print("\n--- Collecting Codeforces Problems ---")
        from data_collection.codeforces import fetch_all_problems
        fetch_all_problems()

        print("\n--- Collecting LeetCode Problems ---")
        from data_collection.leetcode import fetch_all_problems as lc_fetch
        lc_fetch()

    if not args.skip_users:
        n = args.cf_users or CF_SEED_USERS
        print(f"\n--- Collecting {n} CF seed users ---")
        from data_collection.codeforces import get_seed_handles, collect_users
        handles = get_seed_handles(n)
        collect_users(handles)

    db.db_stats()


def cmd_add_user(args):
    """Add a single CF user to the database."""
    db.init_db()
    from data_collection.codeforces import fetch_user_info, store_user, fetch_user_submissions

    handle = args.handle
    print(f"Fetching user: {handle}")
    info = fetch_user_info(handle)
    if not info:
        print(f"User '{handle}' not found on Codeforces.")
        return

    uid = store_user(info)
    print(f"Stored user '{handle}' (DB id: {uid}, rating: {info.get('rating', 0)})")

    print(f"Fetching submissions for '{handle}'...")
    n = fetch_user_submissions(handle, uid)
    print(f"Stored {n} submissions.")
    db.db_stats()


def cmd_add_lc_user(args):
    """Add a LeetCode user."""
    db.init_db()
    from data_collection.leetcode import store_lc_user_submissions

    username = args.handle
    print(f"Fetching LC user: {username}")
    n = store_lc_user_submissions(username)
    print(f"Stored {n} submissions for {username}.")


def cmd_train(args):
    """Train all 4 models."""
    rec = Recommender()
    rec.train_all(retrain_ensemble=not args.skip_ensemble)


def cmd_recommend(args):
    """Generate recommendations for a user."""
    rec = Recommender()
    rec.load_models()

    platform = args.platform or "codeforces"
    results  = rec.recommend_by_handle(
        handle   = args.handle,
        platform = platform,
        top_k    = args.top_k or 10,
        platform_filter = args.filter_platform,
    )

    if not results:
        print("No recommendations generated.")


def cmd_stats(args):
    """Show database statistics."""
    db.db_stats()

    # Show distribution
    with db.get_conn() as conn:
        cf_p = conn.execute(
            "SELECT COUNT(*) as n FROM problems WHERE platform='codeforces'"
        ).fetchone()["n"]
        lc_p = conn.execute(
            "SELECT COUNT(*) as n FROM problems WHERE platform='leetcode'"
        ).fetchone()["n"]
        cf_u = conn.execute(
            "SELECT COUNT(*) as n FROM users WHERE platform='codeforces'"
        ).fetchone()["n"]
        ac   = conn.execute(
            "SELECT COUNT(*) as n FROM submissions WHERE verdict='AC'"
        ).fetchone()["n"]

    print(f"  CF problems:  {cf_p}")
    print(f"  LC problems:  {lc_p}")
    print(f"  CF users:     {cf_u}")
    print(f"  AC solves:    {ac}")


def cmd_demo(args):
    """
    Run a full demo with synthetic data so you can see the system work
    even without collecting live API data.
    """
    print("Running demo with synthetic data...\n")
    db.init_db()

    import numpy as np
    import json
    import time
    from config import UNIFIED_TAGS

    np.random.seed(42)

    # ── Insert synthetic problems ──────────────────────────────────────────────
    print("Creating 200 synthetic problems...")
    for i in range(200):
        platform  = "codeforces" if i < 150 else "leetcode"
        pid       = f"demo_{i}"
        diff_raw  = np.random.uniform(0.1, 0.95)
        cf_rating = int(800 + diff_raw * 2700) if platform == "codeforces" else None
        lc_diff   = (["Easy", "Medium", "Hard"][int(diff_raw * 2.99)]
                     if platform == "leetcode" else None)
        n_tags    = np.random.randint(1, 4)
        tags      = list(np.random.choice(UNIFIED_TAGS, n_tags, replace=False))
        solved_cnt= int(np.random.exponential(5000))

        db.upsert_problem(
            platform      = platform,
            platform_id   = pid,
            title         = f"Problem {i}: {tags[0].replace('_',' ').title()}",
            difficulty    = diff_raw,
            cf_rating     = cf_rating,
            lc_difficulty = lc_diff,
            tags          = tags,
            ac_rate       = np.random.uniform(0.1, 0.8),
            solved_count  = solved_cnt,
        )

    # ── Insert synthetic users ─────────────────────────────────────────────────
    print("Creating 50 synthetic users with submission histories...")
    all_problems = db.get_all_problems()

    for u in range(50):
        rating   = int(np.random.normal(1400, 400))
        rating   = max(800, min(3000, rating))
        uid      = db.upsert_user(
            platform  = "codeforces",
            handle    = f"demo_user_{u}",
            rating    = rating,
            max_rating= rating + np.random.randint(0, 200),
            rank      = "specialist",
        )

        # Solve problems proportional to difficulty matching their rating
        now      = int(time.time())
        n_solved = np.random.randint(20, 100)
        target_diff = (rating - 800) / 2700   # normalized

        # Prefer problems near their level
        weights = []
        for p in all_problems:
            d    = float(p.get("difficulty") or 0.5)
            dist = abs(d - target_diff)
            weights.append(np.exp(-5 * dist))
        weights = np.array(weights)
        weights /= weights.sum()

        chosen = np.random.choice(len(all_problems), size=min(n_solved, len(all_problems)),
                                  replace=False, p=weights)

        for k, idx in enumerate(chosen):
            prob = all_problems[idx]
            pid  = prob["id"]
            ts   = now - (n_solved - k) * 86400 * np.random.uniform(0.5, 3)
            verdict = "AC" if np.random.random() > 0.2 else np.random.choice(["WA","TLE"])
            db.insert_submission(uid, pid, verdict, int(ts))

    db.db_stats()

    # ── Train all models ───────────────────────────────────────────────────────
    print("\nTraining all models on synthetic data...")
    rec = Recommender()
    rec.train_all(retrain_ensemble=True)

    # ── Get recommendations ────────────────────────────────────────────────────
    users = db.get_all_users()
    test_user = users[0]
    print(f"\nGetting recommendations for: {test_user['handle']}")
    rec.recommend(test_user["id"], top_k=10)


# ─── CLI setup ────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        description="CP Recommender — ML-powered problem recommendation"
    )
    sub = parser.add_subparsers(dest="command")

    # collect
    p_collect = sub.add_parser("collect", help="Collect data from CF/LC APIs")
    p_collect.add_argument("--cf-users",      type=int, default=None)
    p_collect.add_argument("--skip-problems", action="store_true")
    p_collect.add_argument("--skip-users",    action="store_true")

    # add-user (CF)
    p_add = sub.add_parser("add-user", help="Add a specific CF user")
    p_add.add_argument("handle")

    # add-lc-user
    p_lc = sub.add_parser("add-lc-user", help="Add a LeetCode user")
    p_lc.add_argument("handle")

    # train
    p_train = sub.add_parser("train", help="Train all 4 models")
    p_train.add_argument("--skip-ensemble", action="store_true")

    # recommend
    p_rec = sub.add_parser("recommend", help="Get recommendations for a user")
    p_rec.add_argument("handle")
    p_rec.add_argument("--platform",         default="codeforces")
    p_rec.add_argument("--top-k",            type=int, default=10)
    p_rec.add_argument("--filter-platform",  default=None,
                       help="Filter recs to 'codeforces' or 'leetcode'")

    # stats
    sub.add_parser("stats", help="Show database statistics")

    # demo
    sub.add_parser("demo", help="Run demo with synthetic data")

    args = parser.parse_args()

    if args.command == "collect":        cmd_collect(args)
    elif args.command == "add-user":     cmd_add_user(args)
    elif args.command == "add-lc-user":  cmd_add_lc_user(args)
    elif args.command == "train":        cmd_train(args)
    elif args.command == "recommend":    cmd_recommend(args)
    elif args.command == "stats":        cmd_stats(args)
    elif args.command == "demo":         cmd_demo(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
