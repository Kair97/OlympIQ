"""
Central configuration for the CP Recommender System.
Adjust hyperparameters, API settings, and tag mappings here.
"""

import os

# ─── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR     = os.path.dirname(os.path.abspath(__file__))
DB_PATH      = os.getenv("DB_PATH", os.path.join(BASE_DIR, "recommender.db"))
MODELS_DIR   = os.path.join(BASE_DIR, "saved_models")

# ─── API ──────────────────────────────────────────────────────────────────────
CF_API_BASE   = "https://codeforces.com/api"
LC_GRAPHQL    = "https://leetcode.com/graphql"
CF_API_DELAY  = 0.35   # seconds between CF requests (rate limit ~3/s)
LC_API_DELAY  = 1.0    # LeetCode is stricter

# ─── Data Collection ──────────────────────────────────────────────────────────
CF_SEED_USERS        = 300    # users to bootstrap the global interaction matrix
CF_MAX_SUBMISSIONS   = 2000   # per user cap to avoid huge payloads
CF_MIN_USER_RATING   = 800    # skip unrated/inactive accounts
LC_PROBLEM_LIMIT     = 3000   # max LC problems to fetch

# ─── Unified Tag Taxonomy (30 topics, covers both platforms) ──────────────────
UNIFIED_TAGS = [
    "dynamic_programming", "graphs",          "greedy",         "implementation",
    "math",                "binary_search",   "data_structures","two_pointers",
    "strings",             "geometry",        "number_theory",  "combinatorics",
    "trees",               "bit_manipulation","sorting",        "divide_conquer",
    "hash_tables",         "graph_traversal", "shortest_paths", "constructive",
    "game_theory",         "backtracking",    "stack",          "heap",
    "sliding_window",      "linked_list",     "union_find",     "trie",
    "segment_tree",        "flows",
]
NUM_TAGS = len(UNIFIED_TAGS)
TAG_TO_IDX = {t: i for i, t in enumerate(UNIFIED_TAGS)}

# CF raw tag  →  unified tag
CF_TAG_MAP = {
    "dp": "dynamic_programming",
    "dynamic programming": "dynamic_programming",
    "graphs": "graphs",
    "graph": "graphs",
    "greedy": "greedy",
    "implementation": "implementation",
    "math": "math",
    "mathematics": "math",
    "binary search": "binary_search",
    "data structures": "data_structures",
    "two pointers": "two_pointers",
    "strings": "strings",
    "string": "strings",
    "geometry": "geometry",
    "number theory": "number_theory",
    "combinatorics": "combinatorics",
    "trees": "trees",
    "tree": "trees",
    "bitmasks": "bit_manipulation",
    "bitmask": "bit_manipulation",
    "sortings": "sorting",
    "sorting": "sorting",
    "divide and conquer": "divide_conquer",
    "hashing": "hash_tables",
    "dfs and similar": "graph_traversal",
    "dfs": "graph_traversal",
    "bfs": "graph_traversal",
    "shortest paths": "shortest_paths",
    "constructive algorithms": "constructive",
    "games": "game_theory",
    "game theory": "game_theory",
    "brute force": "backtracking",
    "backtracking": "backtracking",
    "stacks": "stack",
    "stack": "stack",
    "heaps": "heap",
    "priority queue": "heap",
    "sliding window": "sliding_window",
    "linked list": "linked_list",
    "disjoint set": "union_find",
    "union find": "union_find",
    "trie": "trie",
    "segment tree": "segment_tree",
    "flows": "flows",
    "network flow": "flows",
    "heavy light decomposition": "trees",
    "2-sat": "graphs",
    "fft": "math",
    "matrices": "math",
    "probabilities": "math",
    "meet in the middle": "divide_conquer",
}

# LeetCode raw slug  →  unified tag
LC_TAG_MAP = {
    "dynamic-programming": "dynamic_programming",
    "graph": "graphs",
    "greedy": "greedy",
    "math": "math",
    "binary-search": "binary_search",
    "two-pointers": "two_pointers",
    "string": "strings",
    "tree": "trees",
    "binary-tree": "trees",
    "bit-manipulation": "bit_manipulation",
    "sorting": "sorting",
    "divide-and-conquer": "divide_conquer",
    "hash-table": "hash_tables",
    "depth-first-search": "graph_traversal",
    "breadth-first-search": "graph_traversal",
    "shortest-path": "shortest_paths",
    "backtracking": "backtracking",
    "stack": "stack",
    "monotonic-stack": "stack",
    "heap-priority-queue": "heap",
    "sliding-window": "sliding_window",
    "linked-list": "linked_list",
    "union-find": "union_find",
    "trie": "trie",
    "segment-tree": "segment_tree",
    "array": "implementation",
    "matrix": "implementation",
    "simulation": "implementation",
    "number-theory": "number_theory",
    "combinatorics": "combinatorics",
    "geometry": "geometry",
    "game-theory": "game_theory",
    "recursion": "backtracking",
    "memoization": "dynamic_programming",
    "topological-sort": "graphs",
    "data-stream": "data_structures",
    "ordered-set": "data_structures",
    "binary-indexed-tree": "segment_tree",
    "suffix-array": "strings",
    "string-matching": "strings",
    "counting": "math",
    "enumeration": "backtracking",
    "prefix-sum": "implementation",
    "interactive": "implementation",
}

# ─── Difficulty Normalization ─────────────────────────────────────────────────
# CF ratings run from ~800 to 3500; map to [0, 1]
CF_DIFF_MIN = 800
CF_DIFF_MAX = 3500
LC_DIFF_MAP = {"Easy": 0.25, "Medium": 0.55, "Hard": 0.90}

# ─── Model Hyperparameters ────────────────────────────────────────────────────

# Collaborative Filtering (ALS via implicit)
CF_FACTORS        = 64
CF_ITERATIONS     = 25
CF_REGULARIZATION = 0.01
CF_ALPHA          = 40    # confidence weighting for implicit feedback

# Content-Based
CONTENT_DIM       = NUM_TAGS + 6   # tags + difficulty + ac_rate + solved_count_norm + activity

# SASRec
SASREC_EMBED_DIM  = 64
SASREC_NUM_HEADS  = 4
SASREC_NUM_LAYERS = 2
SASREC_MAX_LEN    = 50
SASREC_DROPOUT    = 0.1
SASREC_LR         = 1e-3
SASREC_BATCH      = 256
SASREC_EPOCHS     = 20

# Difficulty Targeting
DIFF_DELTA_BASE   = 100   # CF rating points above current
DIFF_WINDOW       = 250   # ±125 around target difficulty

# Ensemble (LightGBM)
ENSEMBLE_N_LEAVES = 31
ENSEMBLE_LR       = 0.05
ENSEMBLE_N_TREES  = 200

# Recommendation
NUM_RECS          = 10
DIVERSITY_PENALTY = 0.25   # penalize same-tag clustering in final list
