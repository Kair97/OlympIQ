"""
Ensemble / Re-ranker.
Combines scores from all 4 models using LightGBM (learning-to-rank).
Also enforces diversity to avoid recommending 10 problems of the same type.

Features for the ranker:
  - CF score, Content score, Sequential score, Difficulty fit
  - Problem popularity, novelty
  - Tag overlap with user's weak areas
  - Platform match preference
  - Problem freshness
"""

import numpy as np
import lightgbm as lgb
import pickle
import os
import json
import time
from config import (
    MODELS_DIR, ENSEMBLE_N_LEAVES, ENSEMBLE_LR, ENSEMBLE_N_TREES,
    NUM_RECS, DIVERSITY_PENALTY, NUM_TAGS, TAG_TO_IDX, UNIFIED_TAGS,
)
import database as db
from features.user_features import get_weak_tags


# ─── Feature extraction ───────────────────────────────────────────────────────
def build_ranking_features(
    user_db_id:    int,
    problem_db_id: int,
    cf_score:      float,
    content_score: float,
    seq_score:     float,
    diff_score:    float,
    weak_tags:     list,
    all_problems:  dict,
) -> np.ndarray:
    """
    Build a fixed-length feature vector for one (user, problem) pair.
    Dimension: 12 features.
    """
    prob = all_problems.get(problem_db_id, {})
    tags = json.loads(prob.get("tags") or "[]")

    # Tag overlap with user's weak areas
    weak_overlap = sum(1 for t in tags if t in weak_tags) / max(len(weak_tags), 1)

    # Problem quality signals
    ac_rate     = float(prob.get("ac_rate")     or 0.5)
    difficulty  = float(prob.get("difficulty")  or 0.5)
    solved_cnt  = int(  prob.get("solved_count") or 0)

    # Popularity: log-normalized
    popularity  = np.log1p(solved_cnt) / np.log1p(1_000_000)

    # Novelty: inverse of popularity (prefer less trodden paths)
    novelty     = 1.0 - popularity

    # Freshness: prefer newer problems (smaller contest_id ~ older for CF)
    # Use a proxy: solved_count < 1000 = relatively fresh
    freshness   = 1.0 if solved_cnt < 1000 else 0.5

    # Platform flag
    platform    = prob.get("platform", "")
    is_cf       = 1.0 if platform == "codeforces" else 0.0
    is_lc       = 1.0 if platform == "leetcode"   else 0.0

    return np.array([
        cf_score,         # 0: collaborative signal
        content_score,    # 1: skill profile match
        seq_score,        # 2: learning journey next step
        diff_score,       # 3: difficulty fit
        weak_overlap,     # 4: targets user's weak tags
        ac_rate,          # 5: problem acceptance rate
        difficulty,       # 6: raw difficulty
        popularity,       # 7: how popular globally
        novelty,          # 8: how rare/unexplored
        freshness,        # 9: is it a newer problem
        is_cf,            # 10: platform CF
        is_lc,            # 11: platform LC
    ], dtype=np.float32)


# ─── Ensemble model ───────────────────────────────────────────────────────────
class EnsembleModel:
    """
    LightGBM ranker that learns optimal combination of the 4 model scores.
    Falls back to a linear weighted combination when training data is scarce.
    """

    # Linear weights for fallback (tunable)
    FALLBACK_WEIGHTS = {
        "cf_score":      0.25,
        "content_score": 0.30,
        "seq_score":     0.30,
        "diff_score":    0.15,
    }

    def __init__(self):
        self.ranker  = None
        self._fitted = False

    # ─── Build training data ──────────────────────────────────────────────────
    def build_training_data(
        self,
        cf_model,
        content_model,
        seq_model,
        diff_model,
        n_candidates: int = 50,
    ):
        """
        For each user, collect (features, label) pairs:
          - Positives: problems they actually solved next
          - Negatives: randomly sampled unsolved problems

        Returns X (N, 12), y (N,), groups (for LightGBM ranker).
        """
        print("Building ensemble training data...")
        users       = db.get_all_users()
        all_problems= {p["id"]: p for p in db.get_all_problems()}
        all_prob_ids= list(all_problems.keys())

        X, y, groups = [], [], []

        for user in users:
            uid        = user["id"]
            subs       = db.get_user_submissions(uid, verdict_filter="AC")

            if len(subs) < 10:
                continue

            # Use last 20% of solved problems as "future" positives
            n_test  = max(1, len(subs) // 5)
            past    = subs[:-n_test]
            future  = subs[-n_test:]

            solved_in_future = {s["problem_id"] for s in future}
            solved_ever      = {s["problem_id"] for s in subs}

            # Sample negatives
            unsolved     = [p for p in all_prob_ids if p not in solved_ever]
            np.random.shuffle(unsolved)
            neg_sample   = unsolved[:n_candidates]

            candidates   = list(solved_in_future) + neg_sample
            labels       = [1] * len(solved_in_future) + [0] * len(neg_sample)

            if not candidates:
                continue

            # Get all 4 model scores
            cf_s    = cf_model.predict(uid, candidates)
            cont_s  = content_model.predict(uid, candidates)
            seq_s   = seq_model.predict(uid, candidates)
            diff_s  = diff_model.predict(uid, candidates)
            weak_t  = get_weak_tags(uid)

            for pid, label in zip(candidates, labels):
                feat = build_ranking_features(
                    uid, pid,
                    cf_s.get(pid, 0), cont_s.get(pid, 0),
                    seq_s.get(pid, 0), diff_s.get(pid, 0),
                    weak_t, all_problems,
                )
                X.append(feat)
                y.append(label)

            groups.append(len(candidates))

        return (np.array(X, dtype=np.float32),
                np.array(y, dtype=np.int32),
                groups)

    # ─── Train ────────────────────────────────────────────────────────────────
    def fit(self, cf_model, content_model, seq_model, diff_model):
        X, y, groups = self.build_training_data(
            cf_model, content_model, seq_model, diff_model
        )

        if len(X) < 20:
            print("Not enough data for LightGBM ranker. Using weighted fallback.")
            return

        print(f"Training LightGBM ranker: {len(X)} samples, {len(groups)} users...")

        train_ds = lgb.Dataset(X, label=y, group=groups)

        params = {
            "objective":        "lambdarank",
            "metric":           "ndcg",
            "ndcg_eval_at":     [5, 10],
            "num_leaves":       ENSEMBLE_N_LEAVES,
            "learning_rate":    ENSEMBLE_LR,
            "feature_fraction": 0.8,
            "bagging_fraction": 0.8,
            "bagging_freq":     5,
            "verbose":          -1,
            "n_jobs":           -1,
        }

        self.ranker = lgb.train(
            params,
            train_ds,
            num_boost_round = ENSEMBLE_N_TREES,
            valid_sets      = [train_ds],
            callbacks       = [lgb.log_evaluation(50)],
        )
        self._fitted = True
        print("Ensemble ranker training complete.")

    # ─── Predict (single user) ────────────────────────────────────────────────
    def predict(
        self,
        user_db_id:    int,
        candidates:    list,
        cf_scores:     dict,
        content_scores:dict,
        seq_scores:    dict,
        diff_scores:   dict,
        all_problems:  dict,
    ) -> dict:
        """
        Returns {problem_db_id: ensemble_score}.
        """
        weak_tags = get_weak_tags(user_db_id)

        if self._fitted and self.ranker:
            # LightGBM ranking
            rows = []
            for pid in candidates:
                feat = build_ranking_features(
                    user_db_id, pid,
                    cf_scores.get(pid, 0),
                    content_scores.get(pid, 0),
                    seq_scores.get(pid, 0),
                    diff_scores.get(pid, 0),
                    weak_tags,
                    all_problems,
                )
                rows.append(feat)
            X      = np.array(rows, dtype=np.float32)
            scores = self.ranker.predict(X)
        else:
            # Weighted fallback
            w = self.FALLBACK_WEIGHTS
            scores = np.array([
                w["cf_score"]      * cf_scores.get(pid, 0)
                + w["content_score"] * content_scores.get(pid, 0)
                + w["seq_score"]    * seq_scores.get(pid, 0)
                + w["diff_score"]   * diff_scores.get(pid, 0)
                for pid in candidates
            ])

        # Normalize
        if scores.max() > scores.min():
            scores = (scores - scores.min()) / (scores.max() - scores.min())

        return {pid: float(s) for pid, s in zip(candidates, scores)}

    # ─── Re-rank with diversity ────────────────────────────────────────────────
    def diverse_rerank(
        self,
        ranked_candidates: list,   # [(problem_db_id, score), ...] sorted desc
        all_problems: dict,
        top_k: int = NUM_RECS,
    ) -> list:
        """
        Greedy diversity re-ranking:
        Penalize a candidate if its tags overlap heavily with already-selected ones.
        Returns list of (problem_db_id, score).
        """
        selected       = []
        selected_tags  = set()

        for pid, score in ranked_candidates:
            if len(selected) >= top_k:
                break
            prob = all_problems.get(pid, {})
            tags = set(json.loads(prob.get("tags") or "[]"))

            overlap = len(tags & selected_tags) / max(len(tags), 1)
            penalized_score = score * (1 - DIVERSITY_PENALTY * overlap)

            selected.append((pid, penalized_score))
            selected_tags.update(tags)

        return sorted(selected, key=lambda x: -x[1])

    # ─── Save / Load ──────────────────────────────────────────────────────────
    def save(self, path: str = None):
        path = path or os.path.join(MODELS_DIR, "ensemble.pkl")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            pickle.dump({"ranker": self.ranker, "fitted": self._fitted}, f)
        print(f"Ensemble saved → {path}")

    def load(self, path: str = None):
        path = path or os.path.join(MODELS_DIR, "ensemble.pkl")
        if not os.path.exists(path):
            return
        with open(path, "rb") as f:
            data = pickle.load(f)
        self.ranker  = data.get("ranker")
        self._fitted = data.get("fitted", False)
        print(f"Ensemble loaded ← {path}")
