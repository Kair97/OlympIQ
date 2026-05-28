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
  problems: RoadmapProblem[]
}

export interface RoadmapTopic {
  name: string
  why: string
  strength_score: number
  problems: RoadmapProblem[]
}

export interface RoadmapPattern {
  name: string
  frequency: number
  problems: RoadmapProblem[]
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

export type AnyRoadmap = WeeklyRoadmap | TopicRoadmap | InterviewRoadmap

export interface Analysis {
  id: string
  problem_url: string
  problem_title: string | null
  platform: string | null
  created_at: string
  analysis?: AnalysisContent
}

export interface AnalysisContent {
  problem_title: string
  platform: string
  problem_url: string
  classification: {
    type: string
    subtype: string
    difficulty_label: string
    confidence: number
  }
  key_observations: string[]
  algorithm_approach: {
    summary: string
    hints: Array<{ level: number; text: string }>
  }
  solution_steps: string[]
  complexity: { time: string; space: string; note: string }
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
