"""
Main Recommender Pipeline.
Loads all 4 models and orchestrates the full recommendation flow for any user.
"""

import os
import json
import time
from config import MODELS_DIR, NUM_RECS
import database as db
from models.cf_model       import CollaborativeFilteringModel
from models.content_model  import ContentBasedModel
from models.sasrec         import SASRecModel
from models.difficulty_model import DifficultyTargetingModel
from models.ensemble       import EnsembleModel


class Recommender:
    """
    End-to-end recommendation pipeline.

    Usage:
        rec = Recommender()
        rec.load_models()
        results = rec.recommend(user_db_id=1, top_k=10)
    """

    def __init__(self):
        self.cf_model      = CollaborativeFilteringModel()
        self.content_model = ContentBasedModel()
        self.seq_model     = SASRecModel()
        self.diff_model    = DifficultyTargetingModel()
        self.ensemble      = EnsembleModel()
        self._models_loaded = False

    # ─── Train all models ─────────────────────────────────────────────────────
    def train_all(self, retrain_ensemble: bool = True):
        print("\n" + "="*60)
        print("TRAINING ALL MODELS")
        print("="*60)

        print("\n[1/5] Collaborative Filtering (ALS)...")
        self.cf_model.fit()

        print("\n[2/5] Content-Based Model...")
        self.content_model.fit()

        print("\n[3/5] Sequential Model (SASRec)...")
        self.seq_model.fit()

        print("\n[4/5] Difficulty Targeting Model...")
        self.diff_model.fit()

        if retrain_ensemble:
            print("\n[5/5] Ensemble / Re-ranker (LightGBM)...")
            self.ensemble.fit(
                self.cf_model,
                self.content_model,
                self.seq_model,
                self.diff_model,
            )

        self.save_all_models()
        self._models_loaded = True
        print("\nAll models trained and saved.")

    # ─── Save / Load ──────────────────────────────────────────────────────────
    def save_all_models(self):
        os.makedirs(MODELS_DIR, exist_ok=True)
        self.cf_model.save()
        self.content_model.save()
        self.seq_model.save()
        self.diff_model.save()
        self.ensemble.save()

    def load_models(self):
        self.cf_model.load()
        self.content_model.load()
        self.seq_model.load()
        self.diff_model.load()
        self.ensemble.load()
        self._models_loaded = True
        print("All models loaded.")

    # ─── Generate recommendations ─────────────────────────────────────────────
    def recommend(
        self,
        user_db_id:     int,
        top_k:          int  = NUM_RECS,
        candidate_pool: int  = 500,    # how many problems to score
        platform_filter: str = None,   # 'codeforces', 'leetcode', or None
        verbose:        bool = True,
    ) -> list:
        """
        Full recommendation pipeline for one user.

        Returns a list of dicts:
        [{
            'rank':        int,
            'problem_id':  int (DB id),
            'platform':    str,
            'platform_id': str,
            'title':       str,
            'difficulty':  float,
            'cf_rating':   int or None,
            'lc_difficulty': str or None,
            'tags':        list,
            'scores': {
                'cf':       float,
                'content':  float,
                'sequential': float,
                'difficulty': float,
                'ensemble': float,
            }
        }, ...]
        """
        t0 = time.time()

        # ── 1. Get candidate pool ─────────────────────────────────────────────
        solved_ids = db.get_solved_problem_ids(user_db_id)
        all_probs  = db.get_all_problems()

        if platform_filter:
            all_probs = [p for p in all_probs if p["platform"] == platform_filter]

        # Exclude already solved
        candidates_meta = [p for p in all_probs if p["id"] not in solved_ids]

        # Filter out too-easy problems (bottom 10% difficulty)
        window = self.diff_model.get_difficulty_window(user_db_id)
        min_diff = max(0.0, window["low_diff"] - 0.15)
        candidates_meta = [p for p in candidates_meta
                           if float(p.get("difficulty") or 0) >= min_diff]

        # Sample for scoring (or score all if small enough)
        if len(candidates_meta) > candidate_pool:
            import random
            # Stratified: take some from difficulty target zone + random rest
            in_zone = [p for p in candidates_meta
                       if window["low_diff"] <= float(p.get("difficulty") or 0)
                       <= window["high_diff"]]
            out_zone = [p for p in candidates_meta if p not in in_zone]
            random.shuffle(in_zone)
            random.shuffle(out_zone)
            selected = in_zone[:candidate_pool//2] + out_zone[:candidate_pool//2]
        else:
            selected = candidates_meta

        candidate_ids    = [p["id"]   for p in selected]
        all_problems_map = {p["id"]: p for p in all_probs}

        if verbose:
            print(f"Scoring {len(candidate_ids)} candidates for user {user_db_id}...")

        # ── 2. Get scores from all 4 models ───────────────────────────────────
        cf_scores   = self.cf_model.predict(user_db_id, candidate_ids)
        cont_scores = self.content_model.predict(user_db_id, candidate_ids)
        seq_scores  = self.seq_model.predict(user_db_id, candidate_ids)
        diff_scores = self.diff_model.predict(user_db_id, candidate_ids)

        # ── 3. Ensemble / re-rank ─────────────────────────────────────────────
        ensemble_scores = self.ensemble.predict(
            user_db_id, candidate_ids,
            cf_scores, cont_scores, seq_scores, diff_scores,
            all_problems_map,
        )

        # Sort by ensemble score
        ranked = sorted(ensemble_scores.items(), key=lambda x: -x[1])

        # ── 4. Diversity re-ranking ───────────────────────────────────────────
        ranked_diverse = self.ensemble.diverse_rerank(ranked, all_problems_map, top_k)

        # ── 5. Format output ──────────────────────────────────────────────────
        results = []
        for rank, (pid, ens_score) in enumerate(ranked_diverse, start=1):
            prob = all_problems_map.get(pid, {})
            results.append({
                "rank":           rank,
                "problem_id":     pid,
                "platform":       prob.get("platform", ""),
                "platform_id":    prob.get("platform_id", ""),
                "title":          prob.get("title", ""),
                "difficulty":     round(float(prob.get("difficulty") or 0), 3),
                "cf_rating":      prob.get("cf_rating"),
                "lc_difficulty":  prob.get("lc_difficulty"),
                "tags":           json.loads(prob.get("tags") or "[]"),
                "scores": {
                    "cf":           round(cf_scores.get(pid, 0), 4),
                    "content":      round(cont_scores.get(pid, 0), 4),
                    "sequential":   round(seq_scores.get(pid, 0), 4),
                    "difficulty":   round(diff_scores.get(pid, 0), 4),
                    "ensemble":     round(ens_score, 4),
                },
            })

        elapsed = time.time() - t0
        if verbose:
            print(f"Recommendations generated in {elapsed:.2f}s")
            self._print_recommendations(results, user_db_id, window)

        return results

    def _print_recommendations(self, results: list, user_db_id: int, window: dict):
        """Pretty-print recommendation results."""
        users = db.get_all_users()
        user  = next((u for u in users if u["id"] == user_db_id), {})

        print("\n" + "="*70)
        print(f"RECOMMENDATIONS for {user.get('handle', f'user_{user_db_id}')} "
              f"(rating: {user.get('rating', '?')}, "
              f"target CF: {window['target_cf']})")
        print("="*70)

        for r in results:
            diff_str = (f"CF {r['cf_rating']}" if r["cf_rating"]
                       else r.get("lc_difficulty") or "?")
            tags_str = ", ".join(r["tags"][:3]) + ("..." if len(r["tags"]) > 3 else "")
            print(
                f"#{r['rank']:2d}  [{r['platform'][:2].upper()}]  "
                f"{r['title'][:35]:<35}  "
                f"Diff: {diff_str:<10}  "
                f"Tags: {tags_str}"
            )
            s = r["scores"]
            print(f"      CF={s['cf']:.3f}  "
                  f"Content={s['content']:.3f}  "
                  f"Seq={s['sequential']:.3f}  "
                  f"Diff={s['difficulty']:.3f}  "
                  f"→ Ensemble={s['ensemble']:.3f}")
        print()

    # ─── Recommend by handle (convenience) ───────────────────────────────────
    def recommend_by_handle(
        self,
        handle: str,
        platform: str = "codeforces",
        top_k: int = NUM_RECS,
        **kwargs,
    ) -> list:
        uid = db.get_user_id(platform, handle)
        if uid is None:
            print(f"User '{handle}' on {platform} not found in DB. "
                  f"Please collect their data first.")
            return []
        return self.recommend(uid, top_k=top_k, **kwargs)
