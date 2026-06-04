import { get } from './client'

export interface MLScores {
  cf: number
  content: number
  sequential: number
  difficulty: number
  ensemble: number
}

export interface MLRecommendation {
  rank: number
  platform: string
  platform_id: string
  title: string
  url: string
  difficulty: number
  cf_rating: number | null
  lc_difficulty: string | null
  tags: string[]
  scores: MLScores
}

export interface RecommendParams {
  topic?: string
  platform?: string
  limit?: number
}

export const getRecommendations = (params: RecommendParams = {}) => {
  const q = new URLSearchParams()
  if (params.topic)    q.set('topic', params.topic)
  if (params.platform) q.set('platform', params.platform)
  if (params.limit)    q.set('limit', String(params.limit))
  const qs = q.toString()
  return get<MLRecommendation[]>(`/recommendations${qs ? '?' + qs : ''}`)
}
