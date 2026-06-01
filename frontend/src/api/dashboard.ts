import { get } from './client'

export interface CFDashboard {
  handle: string
  rating: number
  max_rating: number
  rank: string
  problems_solved: number
  contest_count: number
  tag_freq: Record<string, number>
  rating_history: number[]
  lang_freq: Record<string, number>
  rating_buckets: Record<string, number>
  index_freq: Record<string, number>
  recent_ac: CFRecentProblem[]
}

export interface CFRecentProblem {
  name: string
  contestId: number
  index: string
  rating: number | null
  tags: string[]
  solved_at: number
}

export interface LCSkill {
  tagName: string
  problemsSolved: number
}

export interface LCContestEntry {
  attended: boolean
  trendDirection: string
  problemsSolved: number
  totalProblems: number
  rating: number
  ranking: number
  contest: {
    title: string
    startTime: number
  }
}

export interface LCRecentProblem {
  title: string
  titleSlug: string
  solved_at: number
  lang: string
}

export interface LCDashboard {
  handle: string
  rating: number
  ranking: number
  problems_solved: number
  easy_solved: number
  medium_solved: number
  hard_solved: number
  contest_attend: number
  top_percentage: number
  streak: number
  calendar: Record<string, number>
  skills: LCSkill[]
  language_stats: Record<string, number>
  contest_history: LCContestEntry[]
  recent_ac: LCRecentProblem[]
}

export interface Recommendation {
  title: string
  platform: string
  url: string
  rating?: number | null
  difficulty?: string | null
  tags: string[]
  reason: string
}

export interface DashboardData {
  codeforces: CFDashboard | null
  leetcode: LCDashboard | null
  recommendations?: Recommendation[]
}

export const getDashboard = () => get<DashboardData>('/dashboard')
