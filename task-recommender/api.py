"""
FastAPI microservice wrapping the TaskRecommender ML pipeline.
Called by OlympIQ's Go backend to get ranked problem recommendations.

POST /recommend   — sync user data + return top-K recommendations
GET  /health      — liveness check
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import json
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

import database as db
from recommender import Recommender
from config import CF_TAG_MAP, LC_TAG_MAP, CF_DIFF_MIN, CF_DIFF_MAX, LC_DIFF_MAP


# ── Request / response models ─────────────────────────────────────────────────

class CFSubmission(BaseModel):
    platform_id: str           # "contestId_index", e.g. "1234_A"
    title: str = ""
    verdict: str = "AC"        # "AC" | "WA" | "TLE" | ...
    timestamp: int = 0
    cf_rating: Optional[int] = None
    tags: list[str] = []


class LCSubmission(BaseModel):
    platform_id: str           # title slug, e.g. "two-sum"
    title: str = ""
    verdict: str = "AC"
    timestamp: int = 0
    lc_difficulty: Optional[str] = None   # "Easy" | "Medium" | "Hard"


class RecommendRequest(BaseModel):
    cf_handle: Optional[str] = None
    cf_rating: int = 0
    cf_max_rating: int = 0
    cf_rank: str = ""
    cf_registered_at: int = 0
    cf_submissions: list[CFSubmission] = []

    lc_handle: Optional[str] = None
    lc_rating: float = 0.0
    lc_submissions: list[LCSubmission] = []

    top_k: int = 10
    platform_filter: Optional[str] = None   # "codeforces" | "leetcode" | null
    topic_filter: Optional[str] = None       # unified tag, e.g. "dynamic_programming"


# ── App lifecycle ─────────────────────────────────────────────────────────────

rec = Recommender()


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    try:
        rec.load_models()
        print("All models loaded successfully.")
    except Exception as e:
        print(f"Warning: could not load models ({e}). Using fallback weights.")
    yield


app = FastAPI(title="OlympIQ Task Recommender", lifespan=lifespan)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _normalize_cf_difficulty(rating: Optional[int]) -> float:
    if not rating:
        return 0.5
    return max(0.0, min(1.0, (rating - CF_DIFF_MIN) / (CF_DIFF_MAX - CF_DIFF_MIN)))


def _map_cf_tags(raw: list[str]) -> list[str]:
    unified = {CF_TAG_MAP[t.lower()] for t in raw if t.lower() in CF_TAG_MAP}
    return list(unified)


def _make_url(platform: str, platform_id: str) -> str:
    if platform == "codeforces":
        parts = platform_id.split("_", 1)
        if len(parts) == 2:
            return f"https://codeforces.com/contest/{parts[0]}/problem/{parts[1]}"
    elif platform == "leetcode":
        return f"https://leetcode.com/problems/{platform_id}/"
    return ""


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    stats = db.db_stats()
    return {"status": "ok", "models_loaded": rec._models_loaded, "db": stats}


@app.post("/recommend")
def recommend(req: RecommendRequest):
    if not req.cf_handle and not req.lc_handle:
        raise HTTPException(status_code=400, detail="At least one platform handle is required")

    primary_uid: Optional[int] = None

    # ── Upsert CF user + submissions ──────────────────────────────────────────
    if req.cf_handle:
        uid = db.upsert_user(
            platform="codeforces",
            handle=req.cf_handle,
            rating=req.cf_rating,
            max_rating=req.cf_max_rating,
            rank=req.cf_rank,
            registered_at=req.cf_registered_at,
        )
        primary_uid = uid  # prefer CF for difficulty targeting

        for sub in req.cf_submissions:
            unified_tags = _map_cf_tags(sub.tags)
            difficulty = _normalize_cf_difficulty(sub.cf_rating)

            prob_id = db.get_problem_id("codeforces", sub.platform_id)
            if prob_id is None:
                db.upsert_problem(
                    platform="codeforces",
                    platform_id=sub.platform_id,
                    title=sub.title,
                    difficulty=difficulty,
                    cf_rating=sub.cf_rating,
                    tags=unified_tags,
                )
                prob_id = db.get_problem_id("codeforces", sub.platform_id)

            if prob_id and sub.timestamp > 0:
                db.insert_submission(uid, prob_id, sub.verdict, sub.timestamp)

    # ── Upsert LC user + submissions ──────────────────────────────────────────
    if req.lc_handle:
        lc_uid = db.upsert_user(
            platform="leetcode",
            handle=req.lc_handle,
            rating=int(req.lc_rating),
            max_rating=int(req.lc_rating),
        )
        if primary_uid is None:
            primary_uid = lc_uid

        for sub in req.lc_submissions:
            difficulty = LC_DIFF_MAP.get(sub.lc_difficulty or "", 0.55)

            prob_id = db.get_problem_id("leetcode", sub.platform_id)
            if prob_id is None:
                db.upsert_problem(
                    platform="leetcode",
                    platform_id=sub.platform_id,
                    title=sub.title,
                    difficulty=difficulty,
                    lc_difficulty=sub.lc_difficulty,
                    tags=[],
                )
                prob_id = db.get_problem_id("leetcode", sub.platform_id)

            if prob_id and sub.timestamp > 0:
                db.insert_submission(lc_uid, prob_id, sub.verdict, sub.timestamp)

    if primary_uid is None:
        raise HTTPException(status_code=400, detail="Failed to resolve user")

    results = rec.recommend(
        user_db_id=primary_uid,
        top_k=req.top_k * 3,        # over-fetch so topic filter has room
        platform_filter=req.platform_filter,
        verbose=False,
    )

    # ── Post-process: add URLs, apply topic filter, cap at top_k ─────────────
    output = []
    for r in results:
        if req.topic_filter and req.topic_filter not in r.get("tags", []):
            continue
        r["url"] = _make_url(r["platform"], r["platform_id"])
        output.append(r)
        if len(output) >= req.top_k:
            break

    return output
