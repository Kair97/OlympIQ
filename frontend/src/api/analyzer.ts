import { get, post } from './client'
import type { Analysis } from '../types'

export const analyzeProblem = (problem_url: string) =>
  post<{ id: string; analysis: Analysis['analysis'] }>('/analyze', { problem_url })

export const listAnalyses = (page = 1, limit = 20) =>
  get<{ items: Analysis[]; total: number; page: number; limit: number }>(
    '/analyses',
    { page: String(page), limit: String(limit) }
  )

export const getAnalysis = (id: string) =>
  get<{ id: string; problem_url: string; analysis: Analysis['analysis']; created_at: string }>(
    `/analyses/${id}`
  )

export const getRecommendations = (topic?: string, mode?: string) =>
  get<import('../types').RoadmapProblem[]>('/recommendations', {
    ...(topic ? { topic } : {}),
    ...(mode ? { mode } : {}),
  })
