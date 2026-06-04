"""
SQLite database layer.
Handles all persistence: problems, users, submissions, vectors.
"""

import sqlite3
import json
import time
import os
from contextlib import contextmanager
from config import DB_PATH


# ─── Schema ───────────────────────────────────────────────────────────────────
SCHEMA = """
CREATE TABLE IF NOT EXISTS problems (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    platform      TEXT    NOT NULL,           -- 'codeforces' | 'leetcode'
    platform_id   TEXT    NOT NULL,           -- CF: '1234_A', LC: 'two-sum'
    title         TEXT,
    difficulty    REAL    DEFAULT 0.5,        -- normalized 0–1
    cf_rating     INTEGER,
    lc_difficulty TEXT,
    tags          TEXT    DEFAULT '[]',       -- JSON list of unified tags
    ac_rate       REAL    DEFAULT 0.5,
    solved_count  INTEGER DEFAULT 0,
    created_at    INTEGER DEFAULT 0,
    UNIQUE(platform, platform_id)
);

CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    platform        TEXT    NOT NULL,
    handle          TEXT    NOT NULL,
    rating          INTEGER DEFAULT 0,
    max_rating      INTEGER DEFAULT 0,
    rank            TEXT    DEFAULT '',
    registered_at   INTEGER DEFAULT 0,
    UNIQUE(platform, handle)
);

CREATE TABLE IF NOT EXISTS submissions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    problem_id  INTEGER NOT NULL REFERENCES problems(id),
    verdict     TEXT    DEFAULT 'AC',    -- 'AC', 'WA', 'TLE', 'MLE', ...
    timestamp   INTEGER NOT NULL,
    language    TEXT    DEFAULT '',
    time_ms     INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_sub_user    ON submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_sub_problem ON submissions(problem_id);
CREATE INDEX IF NOT EXISTS idx_sub_ts      ON submissions(timestamp);

CREATE TABLE IF NOT EXISTS user_vectors (
    user_id     INTEGER PRIMARY KEY REFERENCES users(id),
    feature_vec TEXT    NOT NULL,    -- JSON float array
    updated_at  INTEGER NOT NULL
);
"""


# ─── Connection ───────────────────────────────────────────────────────────────
@contextmanager
def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    with get_conn() as conn:
        conn.executescript(SCHEMA)
    print(f"Database initialized at {DB_PATH}")


# ─── Problems ─────────────────────────────────────────────────────────────────
def upsert_problem(platform, platform_id, title, difficulty,
                   cf_rating=None, lc_difficulty=None,
                   tags=None, ac_rate=0.5, solved_count=0):
    tags_json = json.dumps(tags or [])
    with get_conn() as conn:
        conn.execute("""
            INSERT INTO problems
                (platform, platform_id, title, difficulty, cf_rating,
                 lc_difficulty, tags, ac_rate, solved_count)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(platform, platform_id) DO UPDATE SET
                title         = excluded.title,
                difficulty    = excluded.difficulty,
                cf_rating     = excluded.cf_rating,
                lc_difficulty = excluded.lc_difficulty,
                tags          = excluded.tags,
                ac_rate       = excluded.ac_rate,
                solved_count  = excluded.solved_count
        """, (platform, platform_id, title, difficulty, cf_rating,
              lc_difficulty, tags_json, ac_rate, solved_count))


def get_problem_id(platform, platform_id) -> int | None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id FROM problems WHERE platform=? AND platform_id=?",
            (platform, platform_id)
        ).fetchone()
    return row["id"] if row else None


def get_all_problems(platform=None):
    with get_conn() as conn:
        if platform:
            rows = conn.execute(
                "SELECT * FROM problems WHERE platform=?", (platform,)
            ).fetchall()
        else:
            rows = conn.execute("SELECT * FROM problems").fetchall()
    return [dict(r) for r in rows]


# ─── Users ────────────────────────────────────────────────────────────────────
def upsert_user(platform, handle, rating=0, max_rating=0,
                rank="", registered_at=0) -> int:
    with get_conn() as conn:
        conn.execute("""
            INSERT INTO users (platform, handle, rating, max_rating, rank, registered_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(platform, handle) DO UPDATE SET
                rating        = excluded.rating,
                max_rating    = excluded.max_rating,
                rank          = excluded.rank,
                registered_at = excluded.registered_at
        """, (platform, handle, rating, max_rating, rank, registered_at))
        row = conn.execute(
            "SELECT id FROM users WHERE platform=? AND handle=?",
            (platform, handle)
        ).fetchone()
    return row["id"]


def get_user_id(platform, handle) -> int | None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id FROM users WHERE platform=? AND handle=?",
            (platform, handle)
        ).fetchone()
    return row["id"] if row else None


def get_all_users(platform=None):
    with get_conn() as conn:
        if platform:
            rows = conn.execute(
                "SELECT * FROM users WHERE platform=?", (platform,)
            ).fetchall()
        else:
            rows = conn.execute("SELECT * FROM users").fetchall()
    return [dict(r) for r in rows]


# ─── Submissions ──────────────────────────────────────────────────────────────
def insert_submission(user_id, problem_id, verdict, timestamp,
                      language="", time_ms=0):
    with get_conn() as conn:
        conn.execute("""
            INSERT OR IGNORE INTO submissions
                (user_id, problem_id, verdict, timestamp, language, time_ms)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (user_id, problem_id, verdict, timestamp, language, time_ms))


def get_user_submissions(user_id, verdict_filter=None):
    with get_conn() as conn:
        if verdict_filter:
            rows = conn.execute("""
                SELECT s.*, p.platform, p.platform_id, p.tags, p.difficulty, p.cf_rating
                FROM submissions s
                JOIN problems p ON s.problem_id = p.id
                WHERE s.user_id=? AND s.verdict=?
                ORDER BY s.timestamp ASC
            """, (user_id, verdict_filter)).fetchall()
        else:
            rows = conn.execute("""
                SELECT s.*, p.platform, p.platform_id, p.tags, p.difficulty, p.cf_rating
                FROM submissions s
                JOIN problems p ON s.problem_id = p.id
                WHERE s.user_id=?
                ORDER BY s.timestamp ASC
            """, (user_id,)).fetchall()
    return [dict(r) for r in rows]


def get_all_interactions():
    """Return (user_id, problem_id, verdict, timestamp) for all submissions."""
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT user_id, problem_id, verdict, timestamp FROM submissions"
        ).fetchall()
    return [dict(r) for r in rows]


def get_solved_problem_ids(user_id) -> set:
    with get_conn() as conn:
        rows = conn.execute("""
            SELECT DISTINCT problem_id FROM submissions
            WHERE user_id=? AND verdict='AC'
        """, (user_id,)).fetchall()
    return {r["problem_id"] for r in rows}


# ─── User Vectors ─────────────────────────────────────────────────────────────
def save_user_vector(user_id, vector: list):
    with get_conn() as conn:
        conn.execute("""
            INSERT INTO user_vectors (user_id, feature_vec, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                feature_vec = excluded.feature_vec,
                updated_at  = excluded.updated_at
        """, (user_id, json.dumps(vector), int(time.time())))


def load_user_vector(user_id) -> list | None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT feature_vec FROM user_vectors WHERE user_id=?",
            (user_id,)
        ).fetchone()
    return json.loads(row["feature_vec"]) if row else None


# ─── Stats ────────────────────────────────────────────────────────────────────
def db_stats():
    with get_conn() as conn:
        p = conn.execute("SELECT COUNT(*) as n FROM problems").fetchone()["n"]
        u = conn.execute("SELECT COUNT(*) as n FROM users").fetchone()["n"]
        s = conn.execute("SELECT COUNT(*) as n FROM submissions").fetchone()["n"]
    print(f"DB stats → problems: {p}, users: {u}, submissions: {s}")
    return {"problems": p, "users": u, "submissions": s}
