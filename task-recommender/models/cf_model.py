"""
Model 1: Collaborative Filtering via Alternating Least Squares (ALS).
Uses the implicit library which is optimized for implicit feedback data.

What it learns: latent user/problem embeddings purely from who-solved-what patterns.
"Users similar to you solved these next."
"""

import numpy as np
import scipy.sparse as sp
import pickle
import os
from config import CF_FACTORS, CF_ITERATIONS, CF_REGULARIZATION, CF_ALPHA, MODELS_DIR
import database as db

try:
    import implicit
    from implicit.als import AlternatingLeastSquares
    HAS_IMPLICIT = True
except ImportError:
    HAS_IMPLICIT = False
    print("Warning: implicit not available, CF model will use SVD fallback")


class CollaborativeFilteringModel:
    """
    ALS matrix factorization on the user-problem interaction matrix.
    Input:  sparse (users × problems) matrix with confidence weights
    Output: relevance scores for unseen problems for any user
    """

    def __init__(self):
        self.model        = None
        self.user_map     = {}    # db user_id → matrix row index
        self.problem_map  = {}    # db problem_id → matrix col index
        self.rev_user_map = {}
        self.rev_prob_map = {}
        self.user_items   = None  # sparse matrix kept for inference

    # ─── Build interaction matrix ─────────────────────────────────────────────
    def _build_matrix(self, interactions: list):
        """
        Build sparse user-item matrix from raw interaction list.
        Confidence:  AC → alpha * 1,  WA → alpha * 0.25  (still a signal)
        """
        all_users    = sorted(set(r["user_id"]    for r in interactions))
        all_problems = sorted(set(r["problem_id"] for r in interactions))

        self.user_map    = {u: i for i, u in enumerate(all_users)}
        self.problem_map = {p: i for i, p in enumerate(all_problems)}
        self.rev_user_map = {i: u for u, i in self.user_map.items()}
        self.rev_prob_map = {i: p for p, i in self.problem_map.items()}

        n_users    = len(all_users)
        n_problems = len(all_problems)

        rows, cols, data = [], [], []
        for r in interactions:
            u_idx = self.user_map[r["user_id"]]
            p_idx = self.problem_map[r["problem_id"]]
            weight = 1.0 if r["verdict"] == "AC" else 0.25
            rows.append(u_idx)
            cols.append(p_idx)
            data.append(weight)

        # Sum duplicate (user, problem) pairs
        mat = sp.csr_matrix(
            (data, (rows, cols)), shape=(n_users, n_problems), dtype=np.float32
        )
        return mat

    # ─── Train ────────────────────────────────────────────────────────────────
    def fit(self):
        print("Building user-problem interaction matrix...")
        interactions = db.get_all_interactions()
        if len(interactions) < 50:
            print("Not enough interactions for CF model (need ≥50). Skipping.")
            return

        self.user_items = self._build_matrix(interactions)
        n_u, n_p = self.user_items.shape
        print(f"Matrix: {n_u} users x {n_p} problems, {self.user_items.nnz} interactions")

        if HAS_IMPLICIT:
            self.model = AlternatingLeastSquares(
                factors       = CF_FACTORS,
                iterations    = CF_ITERATIONS,
                regularization= CF_REGULARIZATION,
                alpha         = CF_ALPHA,
                use_gpu       = False,
                calculate_training_loss=True,
            )
            # implicit expects user-item matrix (not item-user in v0.7+)
            print(f"Training ALS ({CF_FACTORS} factors, {CF_ITERATIONS} iterations)...")
            self.model.fit(self.user_items)
            self.user_factors = self.model.user_factors
            self.item_factors = self.model.item_factors
            print("CF model training complete.")
        else:
            self._fit_svd_fallback()

    def _fit_svd_fallback(self):
        """Simple SVD fallback when implicit is unavailable."""
        from sklearn.decomposition import TruncatedSVD
        print("Training SVD fallback CF model...")
        svd = TruncatedSVD(n_components=min(CF_FACTORS, min(self.user_items.shape) - 1))
        self.user_factors = svd.fit_transform(self.user_items)        # (users, k)
        self.item_factors = svd.components_.T                          # (items, k)
        self.model = "svd"
        print("SVD CF model complete.")

    # ─── Predict ──────────────────────────────────────────────────────────────
    def predict(self, user_db_id: int,
                candidate_problem_db_ids: list,
                top_k: int = None) -> dict:
        """
        Score candidate problems for a user.
        Returns dict {problem_db_id: score (0–1)}.
        """
        if self.model is None:
            return {pid: 0.0 for pid in candidate_problem_db_ids}

        u_idx = self.user_map.get(user_db_id)
        if u_idx is None:
            return {pid: 0.0 for pid in candidate_problem_db_ids}

        # Candidate indices in the matrix
        cand_indices = []
        valid_ids    = []
        for pid in candidate_problem_db_ids:
            p_idx = self.problem_map.get(pid)
            if p_idx is not None:
                cand_indices.append(p_idx)
                valid_ids.append(pid)

        if not cand_indices:
            return {pid: 0.0 for pid in candidate_problem_db_ids}

        u_factor  = self.user_factors[u_idx]
        i_factors = self.item_factors[cand_indices]
        scores    = i_factors @ u_factor

        # Normalize to [0, 1]
        s_min, s_max = scores.min(), scores.max()
        if s_max > s_min:
            scores = (scores - s_min) / (s_max - s_min)
        else:
            scores = np.ones_like(scores) * 0.5

        result = {pid: 0.0 for pid in candidate_problem_db_ids}
        for pid, score in zip(valid_ids, scores.tolist()):
            result[pid] = float(score)
        return result

    # ─── Save / Load ──────────────────────────────────────────────────────────
    def save(self, path: str = None):
        path = path or os.path.join(MODELS_DIR, "cf_model.pkl")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        payload = {
            "user_map":     self.user_map,
            "problem_map":  self.problem_map,
            "rev_user_map": self.rev_user_map,
            "rev_prob_map": self.rev_prob_map,
        }
        if HAS_IMPLICIT and self.model not in (None, "svd"):
            payload["model_type"] = "als"
            payload["user_factors"] = self.model.user_factors
            payload["item_factors"] = self.model.item_factors
        elif hasattr(self, "user_factors"):
            payload["model_type"] = "svd"
            payload["user_factors"] = self.user_factors
            payload["item_factors"] = self.item_factors
        else:
            payload["model_type"] = None

        with open(path, "wb") as f:
            pickle.dump(payload, f)
        print(f"CF model saved → {path}")

    def load(self, path: str = None):
        path = path or os.path.join(MODELS_DIR, "cf_model.pkl")
        if not os.path.exists(path):
            print(f"No CF model found at {path}")
            return
        with open(path, "rb") as f:
            payload = pickle.load(f)

        self.user_map    = payload["user_map"]
        self.problem_map = payload["problem_map"]
        self.rev_user_map= payload["rev_user_map"]
        self.rev_prob_map= payload["rev_prob_map"]

        if payload.get("model_type") in ("als", "svd"):
            self.user_factors = payload["user_factors"]
            self.item_factors = payload["item_factors"]
            self.model        = payload["model_type"]
        print(f"CF model loaded ← {path}")
