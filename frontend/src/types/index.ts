export interface User {
  id: string
  email: string
  username: string
  created_at: string
}

export interface PlatformAccount {
  id: string
  user_id: string
  platform: 'codeforces' | 'leetcode'
  handle: string
  last_synced_at: string | null
}

export interface UserStats {
  id: string
  user_id: string
  platform: string
  rating: number | null
  rank: string | null
  max_rating: number | null
  problems_solved: number | null
  contest_count: number | null
  fetched_at: string
}

export interface UserGoal {
  id: string
  user_id: string
  goal_type: 'rating' | 'interview' | 'topic_mastery'
  target_rating: number | null
  target_date: string | null
  weekly_hours: number | null
  notify_daily: boolean
  notify_weekly: boolean
  notify_problems: boolean
}

export interface RoadmapProblem {
  title: string
  platform: string
  url: string
  rating: number | null
  difficulty: 'easy' | 'medium' | 'hard' | null
  tags: string[]
  reason: string
}

export interface RoadmapWeek {
  week: number
  theme: string
  focus_topics: string[]
  difficulty_target?: string   // e.g. "CF 1300–1500 / LC Easy-Medium"
  problems: RoadmapProblem[]
}

export interface RoadmapTopic {
  name: string
  why: string
  strength_score: number
  sub_patterns_covered?: string[]  // e.g. ["Interval DP", "Bitmask DP"]
  problems: RoadmapProblem[]
}

export interface RoadmapPattern {
  name: string
  frequency: number
  user_strength?: string
  problems_solved?: number
  problems: RoadmapProblem[]
}

export interface RoadmapMilestone {
  week: number
  description?: string  // old schema
  goal?: string         // new schema
}

export interface RoadmapPlatformBalance {
  leetcode_percentage: number
  codeforces_percentage: number
  note: string
}

export interface RoadmapSummary {
  total_weeks: number
  estimated_hours: number
  current_level?: string       // e.g. "Strong in Arrays but DP is a critical gap"
  focus_areas: string[]
  milestones: RoadmapMilestone[]
  platform_balance?: RoadmapPlatformBalance
}

export interface WeeklyRoadmap {
  mode: 'weekly'
  generated_at: string
  goal_summary: string
  weeks: RoadmapWeek[]
}

export interface TopicRoadmap {
  mode: 'topic'
  generated_at: string
  topics: RoadmapTopic[]
}

export interface InterviewRoadmap {
  mode: 'interview'
  generated_at: string
  target_companies: string[]
  patterns: RoadmapPattern[]
}

export interface UnifiedRoadmap {
  summary:        RoadmapSummary
  topic_mode:     { generated_at: string; goal_summary: string; topics: RoadmapTopic[] }
  weekly_mode:    { generated_at: string; goal_summary: string; total_weeks?: number; weeks: RoadmapWeek[] }
  interview_mode: { generated_at: string; target_companies: string[]; readiness_score?: number; patterns: RoadmapPattern[] }
}

export type AnyRoadmap = WeeklyRoadmap | TopicRoadmap | InterviewRoadmap | UnifiedRoadmap

export interface Analysis {
  id: string
  problem_url: string
  problem_title: string | null
  platform: string | null
  created_at: string
  analysis?: AnalysisContent
}

export interface AnalysisHint {
  level: string | number   // new: "easy"/"intermediate"/"advanced"  old: 1/2/3
  text?: string            // old field name (backend normalizes new → old)
  hint?: string            // new field name (kept for raw passthrough)
}

export interface AnalysisContent {
  problem_title: string
  platform: string
  problem_url: string
  difficulty?: string      // e.g. "1900" for CF or "Medium" for LC
  classification: {
    type: string
    subtype: string
    difficulty_label: string
    confidence: number
  }
  key_observations: string[]
  algorithm_approach: {
    summary: string
    hints: AnalysisHint[]
  }
  solution_steps: string[]
  complexity: {
    time: string
    space: string
    note?: string        // synthesized from time_note + space_note by backend
    time_note?: string   // new: explanation for time complexity
    space_note?: string  // new: explanation for space complexity
  }
  common_mistakes: string[]
  similar_problems: Array<{
    title: string
    platform: string
    url: string
    rating: number | null
    tags: string[]
    similarity_reason: string
  }>
}

export interface ApiResponse<T> {
  success: boolean
  data: T
  error: string | null
}
