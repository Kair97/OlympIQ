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
}

export interface LCSkill {
  tagName: string
  problemsSolved: number
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
  calendar: Record<string, number>
  skills: LCSkill[]
}

export interface DashboardData {
  codeforces: CFDashboard | null
  leetcode: LCDashboard | null
}

export const getDashboard = () => get<DashboardData>('/dashboard')
