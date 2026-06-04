"""
Model 2: Content-Based Filtering.
Matches user skill profile against problem feature vectors.

What it learns: which problem characteristics match which skill levels.
"This problem fits your current skill profile in graphs/DP/etc."
"""

import numpy as np
import pickle
import os
import json
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import roc_auc_score
from config import MODELS_DIR, NUM_TAGS
import database as db
from features.user_features import (
    build_user_feature_vector,
    build_all_problem_vectors,
)


class ContentBasedModel:
    """
    Binary classifier:
      Input:  concat(user_vector, problem_vector)
      Target: did this user solve this problem (1) or not (0)?

    At inference time: score all candidates and rank by predicted probability.
    """

    def __init__(self):
        self.clf     = None
        self.scaler  = StandardScaler()
        self.prob_vecs: dict = {}    # problem_db_id → feature vector

    # ─── Build training pairs ─────────────────────────────────────────────────
    def _build_training_data(self, neg_ratio: int = 4):
        """
        For each user:
          Positive: user_vec ⊕ problem_vec for each solved problem
          Negative: user_vec ⊕ problem_vec for neg_ratio random unsolved problems
        """
        print("Building content-based training pairs...")
        self.prob_vecs = build_all_problem_vectors()
        all_problem_ids = list(self.prob_vecs.keys())

        X, y = [], []
        users = db.get_all_users()

        for user in users:
            uid       = user["id"]
            user_vec  = build_user_feature_vector(uid)
            solved    = db.get_solved_problem_ids(uid)

            if not solved:
                continue

            # Positives
            for pid in solved:
                if pid in self.prob_vecs:
                    pair = np.concatenate([user_vec, self.prob_vecs[pid]])
                    X.append(pair)
                    y.append(1)

            # Negatives (random unsolved)
            unsolved = [p for p in all_problem_ids if p not in solved]
            np.random.shuffle(unsolved)
            for pid in unsolved[:len(solved) * neg_ratio]:
                pair = np.concatenate([user_vec, self.prob_vecs[pid]])
                X.append(pair)
                y.append(0)

        return np.array(X, dtype=np.float32), np.array(y, dtype=np.int32)

    # ─── Train ────────────────────────────────────────────────────────────────
    def fit(self):
        X, y = self._build_training_data()
        if len(X) < 20:
            print("Not enough data for content model. Need more users/submissions.")
            return

        print(f"Training content model: {len(X)} samples "
              f"({y.sum()} pos, {(1-y).sum()} neg)...")

        X_scaled = self.scaler.fit_transform(X)

        self.clf = LogisticRegression(
            C           = 1.0,
            max_iter    = 500,
            solver      = "lbfgs",
            class_weight= "balanced",
            random_state= 42,
            n_jobs      = -1,
        )
        self.clf.fit(X_scaled, y)

        # Quick eval
        proba = self.clf.predict_proba(X_scaled)[:, 1]
        auc   = roc_auc_score(y, proba)
        print(f"Content model AUC (train): {auc:.4f}")

    # ─── Predict ──────────────────────────────────────────────────────────────
    def predict(self, user_db_id: int,
                candidate_problem_db_ids: list) -> dict:
        """
        Returns {problem_db_id: probability_score (0–1)}.
        """
        if self.clf is None:
            return {pid: 0.0 for pid in candidate_problem_db_ids}

        # Refresh problem vectors if needed
        if not self.prob_vecs:
            self.prob_vecs = build_all_problem_vectors()

        user_vec = build_user_feature_vector(user_db_id)

        pairs, valid_ids = [], []
        for pid in candidate_problem_db_ids:
            if pid in self.prob_vecs:
                pairs.append(np.concatenate([user_vec, self.prob_vecs[pid]]))
                valid_ids.append(pid)

        if not pairs:
            return {pid: 0.0 for pid in candidate_problem_db_ids}

        X       = np.array(pairs, dtype=np.float32)
        X_s     = self.scaler.transform(X)
        probas  = self.clf.predict_proba(X_s)[:, 1]

        result  = {pid: 0.0 for pid in candidate_problem_db_ids}
        for pid, score in zip(valid_ids, probas.tolist()):
            result[pid] = float(score)
        return result

    def predict_from_vectors(self, user_vec: np.ndarray,
                              problem_vecs: dict) -> dict:
        """
        Alternative interface: pass precomputed vectors directly.
        Returns {problem_db_id: score}.
        """
        if self.clf is None:
            return {pid: 0.0 for pid in problem_vecs}

        pairs    = []
        prob_ids = list(problem_vecs.keys())
        for pid in prob_ids:
            pairs.append(np.concatenate([user_vec, problem_vecs[pid]]))

        if not pairs:
            return {}

        X      = np.array(pairs, dtype=np.float32)
        X_s    = self.scaler.transform(X)
        probas = self.clf.predict_proba(X_s)[:, 1]
        return {pid: float(s) for pid, s in zip(prob_ids, probas)}

    # ─── Save / Load ──────────────────────────────────────────────────────────
    def save(self, path: str = None):
        path = path or os.path.join(MODELS_DIR, "content_model.pkl")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            pickle.dump({"clf": self.clf, "scaler": self.scaler}, f)
        print(f"Content model saved → {path}")

    def load(self, path: str = None):
        path = path or os.path.join(MODELS_DIR, "content_model.pkl")
        if not os.path.exists(path):
            print(f"No content model at {path}")
            return
        with open(path, "rb") as f:
            data = pickle.load(f)
        self.clf    = data["clf"]
        self.scaler = data["scaler"]
        self.prob_vecs = build_all_problem_vectors()
        print(f"Content model loaded ← {path}")
