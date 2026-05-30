// shared/data.jsx — sample problems, history, AI razbor content
// Exposed on window for both direction shells.

const SAMPLE_PROBLEMS = [
  {
    id: "p-1842b",
    source: "Codeforces",
    code: "1842B",
    title: "Tenzing and Books",
    rating: 1400,
    tags: ["greedy", "constructive", "bitmask"],
    statement: `Tenzing has 3 stacks of books, each containing some non-negative integers written on the spine. He chooses a non-negative integer K and wants to know if it is possible to take some prefix from each of the three stacks (possibly empty) such that the bitwise OR of all values in the chosen prefixes equals exactly K.

You are given K and the three stacks. Decide whether it is possible.`,
    constraints: [
      "1 ≤ n₁, n₂, n₃ ≤ 1e5",
      "0 ≤ K, aᵢ < 2³⁰",
      "Sum of n across tests ≤ 1e5",
    ],
    samples: [
      { in: "5 3\n1 2 0 4 8\n0 5\n2 3 6", out: "Yes" },
      { in: "3 7\n1 2 4\n7\n9", out: "No" },
    ],
  },
  {
    id: "p-1923d",
    source: "Codeforces",
    code: "1923D",
    title: "Slimes",
    rating: 2100,
    tags: ["binary search", "data structures", "prefix sums", "two pointers"],
    statement: `There are n slimes in a row. The i-th slime has size aᵢ. Every second, each slime can eat one of its neighbours if and only if its size is strictly greater than that neighbour's. After eating, its size grows by the eaten neighbour's size.

For every slime i, find the minimum number of seconds it takes for it to be eaten, or report it can never be eaten.`,
    constraints: ["1 ≤ n ≤ 3·10⁵", "1 ≤ aᵢ ≤ 1e9"],
    samples: [
      { in: "4\n3 2 4 2", out: "2 1 2 1" },
      { in: "3\n1 2 3", out: "-1 1 -1" },
    ],
  },
  {
    id: "p-lc-198",
    source: "LeetCode",
    code: "198",
    title: "House Robber",
    rating: 1700,
    tags: ["dp", "array"],
    statement: `You are a robber planning to rob houses along a street. Each house has a certain amount of money stashed. The only constraint stopping you is that adjacent houses have connected security systems and will alert police if both are robbed on the same night.

Given an integer array nums representing the money in each house, return the maximum amount you can rob without alerting the police.`,
    constraints: ["1 ≤ nums.length ≤ 100", "0 ≤ nums[i] ≤ 400"],
    samples: [
      { in: "[1,2,3,1]", out: "4" },
      { in: "[2,7,9,3,1]", out: "12" },
    ],
  },
];

const STARTER_CODE = {
  cpp: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(nullptr);

    int t;
    cin >> t;
    while (t--) {
        int n, k;
        cin >> n >> k;
        // TODO: read stacks, OR-cover K
    }
    return 0;
}`,
  python: `import sys
input = sys.stdin.readline

def solve():
    n, k = map(int, input().split())
    # TODO: read stacks, OR-cover K
    pass

t = int(input())
for _ in range(t):
    solve()`,
};

const HISTORY = [
  { id: "h1", title: "Tenzing and Books", code: "1842B", when: "2 min ago", rating: 1400, verdict: "AC" },
  { id: "h2", title: "Slimes", code: "1923D", when: "Yesterday", rating: 2100, verdict: "WA" },
  { id: "h3", title: "Maximum Subarray", code: "53", when: "Yesterday", rating: 1200, verdict: "AC" },
  { id: "h4", title: "Kuroni and Antihype", code: "1305G", when: "2d ago", rating: 2900, verdict: "—" },
  { id: "h5", title: "Sparse Graph", code: "1093E", when: "3d ago", rating: 2200, verdict: "AC" },
  { id: "h6", title: "Range Update Queries", code: "Lazy-1", when: "4d ago", rating: 1900, verdict: "AC" },
  { id: "h7", title: "Two Pointer Drill", code: "Drill-04", when: "5d ago", rating: 1500, verdict: "AC" },
  { id: "h8", title: "Centroid Decomposition", code: "CD-Intro", when: "1w ago", rating: 2400, verdict: "TLE" },
];

// AI razbor — broken into stream chunks for the "streaming" effect.
// Each entry produces a section in the AI panel.
const RAZBOR_STREAM = {
  classification: {
    type: "Constructive · Bitmask",
    difficulty: "Div2 B (~1400)",
    confidence: 0.92,
  },
  observations: [
    "Any value chosen from any stack contributes its bits via OR. Bits never turn off, only on.",
    "Therefore: every bit set in some chosen aᵢ must also be set in K. If aᵢ contains any bit outside K, we cannot include it.",
    "Within each stack we must take a *prefix* — we can't skip a forbidden element to reach a useful one later.",
    "So per stack, the usable prefix length is bounded by the first index whose value has a bit outside K.",
  ],
  hints: [
    { level: 1, text: "Forget the answer for a moment. What does taking the prefix of one stack tell you about which bits become set?" },
    { level: 2, text: "If any element of a chosen prefix contains a bit not in K, the OR will exceed K. Prefixes are 'sealed' at the first bad element." },
    { level: 3, text: "Compute the maximal safe prefix per stack — i.e. its OR, until you hit an element with a bit outside K. Then OR the three results together and compare to K." },
  ],
  steps: [
    "For each of the 3 stacks, scan left to right and keep a running OR.",
    "Stop as soon as the next element would introduce a bit not present in K. Record the OR up to that point.",
    "Combine the 3 recorded ORs with bitwise OR. Call it M.",
    "If M == K, output Yes — those prefixes form a valid choice. Otherwise output No.",
  ],
  complexity: {
    time: "O(n₁ + n₂ + n₃) per test",
    space: "O(1) extra",
    note: "Linear scan, no data structures required.",
  },
  similar: [
    { code: "1556D", title: "Take a Guess", rating: 1800, tags: ["bitmask", "interactive"] },
    { code: "1554C", title: "Mikasa", rating: 1700, tags: ["bitmask", "greedy"] },
    { code: "1601B", title: "Frog Traveler", rating: 1900, tags: ["dp", "greedy"] },
  ],
};

// Dashboard data
const DASHBOARD = {
  user: { name: "kael.solver", joined: "Mar 2024", country: "KZ" },
  streak: { current: 14, best: 31, todaySolved: 3, goal: 5 },
  platforms: {
    codeforces: {
      handle: "kael_solver",
      rating: 1847,
      peak: 1912,
      rank: "Expert",
      solved: 318,
      contests: 42,
      // 24 weeks of rating history (small)
      history: [1100,1180,1210,1255,1290,1340,1380,1370,1420,1460,1490,1530,1560,1600,1640,1670,1710,1690,1720,1760,1790,1820,1830,1847],
    },
    leetcode: {
      handle: "kael",
      rating: 1923,
      peak: 1923,
      rank: "Top 8%",
      solved: 412,
      contests: 19,
      history: [1200,1240,1290,1330,1380,1420,1480,1520,1560,1610,1660,1700,1740,1790,1820,1860,1880,1900,1923],
    },
  },
  byTopic: [
    { topic: "dp",                solved: 64,  strength: 0.78 },
    { topic: "graphs",            solved: 41,  strength: 0.62 },
    { topic: "data structures",   solved: 58,  strength: 0.71 },
    { topic: "math",              solved: 49,  strength: 0.55 },
    { topic: "greedy",            solved: 73,  strength: 0.84 },
    { topic: "strings",           solved: 22,  strength: 0.41 },
    { topic: "geometry",          solved: 11,  strength: 0.27 },
    { topic: "number theory",     solved: 18,  strength: 0.38 },
  ],
  // 7×24 heatmap of last 7 days × 24 hours, integer 0..4
  activity: (() => {
    const seed = [0,0,0,0,0,1,2,2,1,1,1,2,2,3,3,2,2,3,4,4,3,2,1,0];
    return Array.from({length: 7}, (_, d) =>
      seed.map((v, h) => Math.max(0, Math.min(4, v + ((d*7+h)%5===0?1:0) - (d===6&&h<8?1:0))))
    );
  })(),
  recommended: [
    { code: "1759E", title: "Lost Array", rating: 1600, why: "fills gap in greedy + constructive" },
    { code: "1593F", title: "Red-Black Number", rating: 2100, why: "stretches your DP comfort zone" },
    { code: "1611C", title: "Polycarp Recovers Array", rating: 1300, why: "warmup, two-pointer pattern" },
  ],
};

// External-platform URL builders. The Analyzer uses these for the
// "Open original problem ↗" / editorial / submit buttons.
const PLATFORM_LINKS = {
  Codeforces: (p) => {
    const contest = p.code.replace(/[^\d]/g, "");
    const idx = p.code.replace(/\d/g, "");
    return {
      problem:   `https://codeforces.com/contest/${contest}/problem/${idx}`,
      editorial: `https://codeforces.com/blog/entry/search?query=${contest}${idx}`,
      submit:    `https://codeforces.com/contest/${contest}/submit/${idx}`,
      profile:   "https://codeforces.com/profile/kael_solver",
      tagSearch: (t) => `https://codeforces.com/problemset?tags=${encodeURIComponent(t)}`,
    };
  },
  LeetCode: (p) => {
    const slug = p.title.toLowerCase().replace(/['"]/g, "").replace(/\s+/g, "-");
    return {
      problem:   `https://leetcode.com/problems/${slug}/`,
      editorial: `https://leetcode.com/problems/${slug}/editorial/`,
      submit:    `https://leetcode.com/problems/${slug}/submissions/`,
      profile:   "https://leetcode.com/u/kael/",
      tagSearch: (t) => `https://leetcode.com/tag/${encodeURIComponent(t)}/`,
    };
  },
};

// ────────────────────────────── Roadmap data ─────────────────────────────

const ROADMAP = {
  generatedAt: "May 28, 2026",
  model: "claude-sonnet-4",
  goal: {
    kind: "rating",
    label: "Reach Candidate Master",
    target: 2000,
    current: 1847,
    deadline: "Sep 1, 2026",
    daysLeft: 96,
    requiredPace: 1.59,
    actualPace: 1.62,
    onTrack: true,
  },
  goalOptions: [
    { id: "rating",    icon: "↑", label: "Rating target",   sub: "Push your Codeforces / LeetCode rating to a number." },
    { id: "contest",   icon: "◇", label: "Contest ranking", sub: "Place within a top-K in your next N contests." },
    { id: "interview", icon: "▢", label: "Interview prep",  sub: "FAANG-flavoured drills: arrays, DP, graphs, system thinking." },
    { id: "topic",     icon: "▤", label: "Topic mastery",   sub: "Reach 'comfortable' on a topic — measured per-problem." },
  ],
  weeks: [
    { idx: 1, theme: "Two pointers · sliding windows", done: 8, total: 8, status: "done" },
    { idx: 2, theme: "Prefix sums · difference arrays", done: 7, total: 8, status: "done" },
    { idx: 3, theme: "Greedy · exchange arguments",     done: 8, total: 8, status: "done" },
    { idx: 4, theme: "Binary search on the answer",     done: 6, total: 7, status: "done" },
    { idx: 5, theme: "Number theory · sieves",          done: 6, total: 6, status: "done" },
    { idx: 6, theme: "DP on subsets · bitmask warmups", done: 5, total: 8, status: "current",
      problems: [
        { source: "Codeforces", code: "1556D",  title: "Take a Guess",        rating: 1800, tags: ["bitmask", "interactive"], status: "unsolved", est: "45 min" },
        { source: "Codeforces", code: "1556E",  title: "Equilibrium",         rating: 2400, tags: ["bitmask", "data structures"], status: "unsolved", est: "1h 30m" },
        { source: "Codeforces", code: "1554C",  title: "Mikasa",              rating: 1700, tags: ["bitmask", "greedy"], status: "stretch", est: "40 min" },
        { source: "LeetCode",   code: "1125",   title: "Smallest Sufficient Team", rating: 2000, tags: ["bitmask", "dp"], status: "unsolved", est: "1h" }
      ]
    },
    { idx: 7, theme: "Segment trees · lazy propagation", done: 0, total: 7, status: "upcoming" },
    { idx: 8, theme: "Centroid decomposition · HLD intro", done: 0, total: 6, status: "upcoming" },
    { idx: 9, theme: "Convex hull trick · Li Chao tree", done: 0, total: 6, status: "upcoming" },
    { idx: 10, theme: "Suffix structures",               done: 0, total: 6, status: "upcoming" },
    { idx: 11, theme: "Min-cost flow · matchings",       done: 0, total: 5, status: "upcoming" },
    { idx: 12, theme: "Mock contests · review",          done: 0, total: 4, status: "upcoming" },
  ],
  byTopicRecs: [
    { topic: "strings",       strength: 0.41, why: "your weakest topic — high leverage",
      picks: [
        { source: "Codeforces", code: "1538F", title: "Interesting Function", rating: 1700, tags: ["strings", "math"] },
        { source: "Codeforces", code: "1469B", title: "Red and Blue",         rating: 1100, tags: ["dp", "greedy"] },
        { source: "LeetCode",   code: "647",   title: "Palindromic Substrings", rating: 1500, tags: ["strings", "dp"] },
      ]
    },
    { topic: "graphs",        strength: 0.62, why: "you skipped flow last sprint",
      picks: [
        { source: "Codeforces", code: "1473D", title: "Program",       rating: 1800, tags: ["graphs", "dp"] },
        { source: "Codeforces", code: "1320B", title: "Navigation System", rating: 1700, tags: ["graphs", "bfs"] },
      ]
    },
    { topic: "math",          strength: 0.55, why: "borderline for CM problems",
      picks: [
        { source: "Codeforces", code: "1542B", title: "Plus and Multiply", rating: 1300, tags: ["math", "number theory"] },
        { source: "Codeforces", code: "1559C", title: "Mocha and Hiking",  rating: 1500, tags: ["constructive", "graphs"] },
      ]
    },
    { topic: "geometry",      strength: 0.27, why: "neglected — low priority for CM",
      picks: [
        { source: "Codeforces", code: "1284B", title: "New Year and Ascent Sequence", rating: 1600, tags: ["math"] },
      ]
    },
  ],
  interview: {
    enabled: true,
    track: "FAANG · backend",
    weeks: 3,
    today: [
      { source: "LeetCode", code: "146",  title: "LRU Cache",                 rating: 1700, pattern: "design",   est: "30 min" },
      { source: "LeetCode", code: "215",  title: "Kth Largest Element",       rating: 1400, pattern: "heaps",    est: "20 min" },
      { source: "LeetCode", code: "200",  title: "Number of Islands",         rating: 1500, pattern: "graphs",   est: "25 min" },
    ],
    patterns: [
      { name: "Two pointers",      done: 12, total: 12 },
      { name: "Sliding window",    done: 9,  total: 12 },
      { name: "BFS / DFS",         done: 8,  total: 14 },
      { name: "Top-K (heaps)",     done: 6,  total: 10 },
      { name: "Dynamic programming", done: 4, total: 16 },
      { name: "Design questions",  done: 2,  total: 8 },
    ],
  },
  notify: {
    daily:        { on: true,  time: "08:30", text: "morning problem nudge" },
    streak:       { on: true,  time: "20:00", text: "streak about to break" },
    contest:      { on: true,  text: "1h before any rated Codeforces round" },
    weekly:       { on: false, text: "Sunday digest of progress vs goal" },
  },
};

// ────────────────────────────── Profile data ─────────────────────────────

const PROFILE = {
  user: {
    displayName: "Kael Solver",
    username:    "kael.solver",
    email:       "kael@olympiq.dev",
    emailVerified: true,
    country:     "Kazakhstan",
    joined:      "Mar 12, 2024",
    timezone:    "Asia/Almaty",
  },
  platforms: [
    { id: "codeforces", name: "Codeforces", handle: "kael_solver", connected: true,  lastSync: "2 min ago",  rating: 1847, color: "#a78bfa" },
    { id: "leetcode",   name: "LeetCode",   handle: "kael",        connected: true,  lastSync: "5 min ago",  rating: 1923, color: "#f59e0b" },
    { id: "atcoder",    name: "AtCoder",    handle: null,          connected: false, lastSync: null,         rating: null, color: "#94a3b8" },
    { id: "codechef",   name: "CodeChef",   handle: null,          connected: false, lastSync: null,         rating: null, color: "#94a3b8" },
  ],
  sessions: [
    { device: "MacBook Pro · Chrome",  where: "Almaty, KZ", when: "now",        current: true },
    { device: "iPhone 15 · Safari",    where: "Almaty, KZ", when: "2h ago",     current: false },
    { device: "Firefox · Ubuntu 24",   where: "Astana, KZ", when: "yesterday",  current: false },
  ],
};

Object.assign(window, {
  OLYMPIQ_DATA: { SAMPLE_PROBLEMS, STARTER_CODE, HISTORY, RAZBOR_STREAM, DASHBOARD, ROADMAP, PROFILE, PLATFORM_LINKS },
});
