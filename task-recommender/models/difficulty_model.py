"""
Model 4: Difficulty Targeting.
Computes each user's optimal difficulty window based on current rating,
recent performance trajectory, and solve rate.

Primarily formula-based (interpretable + fast), with an optional
linear regression layer trained on historical data.
"""

import numpy as np
import pickle
import os
import time
from sklearn.linear_model import Ridge
from config import (
    MODELS_DIR, DIFF_DELTA_BASE, DIFF_WINDOW,
    CF_DIFF_MIN, CF_DIFF_MAX, LC_DIFF_MAP,
)
import database as db


class DifficultyTargetingModel:
    """
    Outputs an optimal difficulty window [low, high] (normalized 0–1).
    Also provides a scalar fit-score for any candidate problem.
    """

    def __init__(self):
        self.regressor = None   # optional regression refinement
        self._fitted   = False

    # ─── Core heuristic formula ───────────────────────────────────────────────
    @staticmethod
    def compute_optimal_difficulty(
        rating: int,
        rating_velocity: float,   # Δrating / 30 days
        recent_solve_rate: float, # AC / total in last 30 days
        total_solved: int,
    ) -> tuple:
        """
        Returns (target_cf_rating, low_cf_rating, high_cf_rating).

        Logic:
          - Baseline: current_rating + DIFF_DELTA_BASE (always push a bit)
          - Adjust up   if player is improving AND solving easily
          - Adjust down if player is struggling (low solve rate or declining)
          - New players (< 50 solved): gentler window
        """
        delta = DIFF_DELTA_BASE

        # Performance trajectory adjustment
        if rating_velocity > 0:
            # Gaining rating → can push harder
            delta += min(rating_velocity * 0.5, 200)
        else:
            # Losing rating → ease off
            delta += max(rating_velocity * 0.4, -150)

        # Solve-rate adjustment
        if recent_solve_rate < 0.25:
            # Struggling → lower the bar
            delta -= 100
        elif recent_solve_rate > 0.70:
            # Too easy → raise the bar
            delta += 80

        # New user guard
        if total_solved < 50:
            delta = min(delta, 150)
            delta = max(delta, 50)

        target = rating + delta
        target = np.clip(target, CF_DIFF_MIN, CF_DIFF_MAX)

        half_w = DIFF_WINDOW / 2
        low    = max(CF_DIFF_MIN, target - half_w)
        high   = min(CF_DIFF_MAX, target + half_w)

        return float(target), float(low), float(high)

    # ─── Compute user stats ───────────────────────────────────────────────────
    @staticmethod
    def _get_user_stats(user_db_id: int) -> dict:
        users  = db.get_all_users()
        user   = next((u for u in users if u["id"] == user_db_id), {})
        rating = user.get("rating") or 800

        subs   = db.get_user_submissions(user_db_id)
        now    = int(time.time())
        month  = now - 30 * 86400

        recent_subs  = [s for s in subs if s["timestamp"] > month]
        recent_ac    = sum(1 for s in recent_subs if s["verdict"] == "AC")
        recent_total = len(recent_subs)
        solve_rate   = recent_ac / max(recent_total, 1)

        total_ac     = sum(1 for s in subs if s["verdict"] == "AC")

        # Velocity: rating change approximated from recent AC difficulty
        recent_ac_subs = [s for s in recent_subs if s["verdict"] == "AC"]
        if recent_ac_subs:
            avg_diff = np.mean([s.get("difficulty", 0.5) for s in recent_ac_subs])
            # Normalized diff → CF rating scale
            recent_cf_level = CF_DIFF_MIN + avg_diff * (CF_DIFF_MAX - CF_DIFF_MIN)
            velocity = (recent_cf_level - rating) * 0.1   # rough proxy
        else:
            velocity = 0.0

        return {
            "rating":     rating,
            "velocity":   velocity,
            "solve_rate": solve_rate,
            "total_ac":   total_ac,
        }

    # ─── Public API ───────────────────────────────────────────────────────────
    def get_difficulty_window(self, user_db_id: int) -> dict:
        """
        Returns:
          {
            'target_diff': float (0–1 normalized),
            'low_diff':    float,
            'high_diff':   float,
            'target_cf':   int,
          }
        """
        stats  = self._get_user_stats(user_db_id)
        target_cf, low_cf, high_cf = self.compute_optimal_difficulty(
            stats["rating"],
            stats["velocity"],
            stats["solve_rate"],
            stats["total_ac"],
        )

        def to_norm(cf): return (cf - CF_DIFF_MIN) / (CF_DIFF_MAX - CF_DIFF_MIN)

        return {
            "target_diff": to_norm(target_cf),
            "low_diff":    to_norm(low_cf),
            "high_diff":   to_norm(high_cf),
            "target_cf":   int(target_cf),
        }

    def score_problem(self, problem_difficulty: float,
                      window: dict) -> float:
        """
        Returns a fit score [0, 1] for how well a problem's difficulty
        matches the user's target window.
        0 = way too easy or too hard, 1 = perfect fit.

        Uses a Gaussian centered at target_diff with σ = half_window.
        """
        target   = window["target_diff"]
        half_w   = (window["high_diff"] - window["low_diff"]) / 2 + 1e-6
        dist     = abs(problem_difficulty - target) / half_w
        score    = np.exp(-0.5 * dist ** 2)   # Gaussian bell curve
        return float(score)

    def predict(self, user_db_id: int,
                candidate_problem_db_ids: list) -> dict:
        """
        Returns difficulty fit scores {problem_db_id: score (0–1)}.
        """
        window   = self.get_difficulty_window(user_db_id)
        problems = {p["id"]: p for p in db.get_all_problems()}

        result = {}
        for pid in candidate_problem_db_ids:
            prob = problems.get(pid)
            if prob is None:
                result[pid] = 0.5
            else:
                diff       = float(prob.get("difficulty") or 0.5)
                result[pid] = self.score_problem(diff, window)
        return result

    # ─── Optional: train a regression refiner on historical data ─────────────
    def fit(self):
        """
        Optionally train a Ridge regression to predict optimal difficulty
        from user features, using historical solve patterns as ground truth.
        Falls back to heuristic if insufficient data.
        """
        users = db.get_all_users()
        X, y  = [], []

        for user in users:
            uid    = user["id"]
            stats  = self._get_user_stats(uid)
            subs   = db.get_user_submissions(uid, verdict_filter="AC")

            if len(subs) < 10:
                continue

            # Ground truth: 90th percentile of solved difficulty
            diffs = sorted([s.get("difficulty", 0.5) for s in subs])
            gt    = np.percentile(diffs, 75)   # 75th pct = natural challenge ceiling

            features = [
                stats["rating"] / CF_DIFF_MAX,
                stats["velocity"] / 500,
                stats["solve_rate"],
                np.log1p(stats["total_ac"]) / 10,
            ]
            X.append(features)
            y.append(gt)

        if len(X) >= 10:
            self.regressor = Ridge(alpha=1.0)
            self.regressor.fit(np.array(X), np.array(y))
            self._fitted = True
            print(f"Difficulty regressor trained on {len(X)} users.")
        else:
            print("Not enough data for difficulty regressor. Using heuristic only.")

    # ─── Save / Load ──────────────────────────────────────────────────────────
    def save(self, path: str = None):
        path = path or os.path.join(MODELS_DIR, "difficulty_model.pkl")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            pickle.dump({"regressor": self.regressor, "fitted": self._fitted}, f)
        print(f"Difficulty model saved → {path}")

    def load(self, path: str = None):
        path = path or os.path.join(MODELS_DIR, "difficulty_model.pkl")
        if not os.path.exists(path):
            return
        with open(path, "rb") as f:
            data = pickle.load(f)
        self.regressor = data.get("regressor")
        self._fitted   = data.get("fitted", False)
        print(f"Difficulty model loaded ← {path}")
