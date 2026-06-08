import { get, post } from './client'

// ── Legacy ML microservice format ─────────────────────────────────────────────
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
  reason?: string
  scores?: MLScores
}

// ── New n8n structured recommender format ────────────────────────────────────
export interface RecsMeta {
  username: string
  generated_at?: string
  codeforces_rating?: number
  leetcode_solved?: number
  weak_topics: string[]       // display names e.g. "Dynamic Programming"
  next_best_topic: string     // display name
}

export interface RecsProb {
  title: string
  url: string
  difficulty: string | null   // "easy"|"medium"|"hard" for LC, null for CF
  rating?: number | null       // CF integer rating
  tags: string[]
  reason: string
}

// Keys are topic slugs (e.g. "any", "dynamic_programming", "graphs")
// or display names used as keys (agent may return either)
export interface StructuredRecs {
  meta: RecsMeta
  leetcode: Record<string, RecsProb[]>
  codeforces: Record<string, RecsProb[]>
}

export type RecsResponse = StructuredRecs | MLRecommendation[]

export function isStructuredRecs(v: RecsResponse): v is StructuredRecs {
  return !Array.isArray(v) && typeof v === 'object' && v !== null && 'meta' in v
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
  return get<RecsResponse>(`/recommendations${qs ? '?' + qs : ''}`)
}

// POST /recommendations — triggers the n8n recommender (or serves Redis cache).
// The backend builds the full student context server-side; body is intentionally empty.
export const postRecommendations = () =>
  post<RecsResponse>('/recommendations', {})
