import { create } from 'zustand'
import type { MLRecommendation, StructuredRecs, RecsProb } from '../api/recommendations'

// Collect all topic keys from both platforms (preserves insertion order, deduplicates)
export function availableTopics(structured: StructuredRecs): string[] {
  const seen = new Set<string>()
  const topics: string[] = []
  for (const dict of [structured.leetcode, structured.codeforces]) {
    if (!dict) continue
    for (const key of Object.keys(dict)) {
      if (!seen.has(key)) {
        seen.add(key)
        topics.push(key)
      }
    }
  }
  // "any" always first
  const sorted = topics.filter(t => t !== 'any').sort()
  return topics.includes('any') ? ['any', ...sorted] : sorted
}

// Filter structured recs by topic + platform (client-side, no fetch)
export function filterStructured(
  structured: StructuredRecs,
  topic: string,
  platform: string,
): Array<RecsProb & { platform: string }> {
  const platforms: Array<'leetcode' | 'codeforces'> =
    platform === 'all' ? ['leetcode', 'codeforces'] : [platform as 'leetcode' | 'codeforces']

  const result: Array<RecsProb & { platform: string }> = []

  for (const p of platforms) {
    const dict = structured[p]
    if (!dict) continue

    if (topic === 'any') {
      // Use the "any" bucket if present; otherwise flatten everything
      const bucket = dict['any']
      if (bucket) {
        result.push(...bucket.map(prob => ({ ...prob, platform: p })))
      } else {
        for (const probs of Object.values(dict)) {
          result.push(...probs.map(prob => ({ ...prob, platform: p })))
        }
      }
    } else {
      const bucket = dict[topic] ?? []
      result.push(...bucket.map(prob => ({ ...prob, platform: p })))
    }
  }

  return result
}

interface RecommenderState {
  // New structured format
  structured: StructuredRecs | null
  // Legacy ML format fallback
  recs: MLRecommendation[]

  loading: boolean
  error: string
  loaded: boolean
  topic: string
  platform: string

  setStructured: (s: StructuredRecs | null) => void
  setRecs: (r: MLRecommendation[]) => void
  setLoading: (v: boolean) => void
  setError: (e: string) => void
  setLoaded: (v: boolean) => void
  setTopic: (t: string) => void
  setPlatform: (p: string) => void
  reset: () => void
}

export const useRecommenderStore = create<RecommenderState>((set) => ({
  structured: null,
  recs: [],
  loading: false,
  error: '',
  loaded: false,
  topic: 'any',
  platform: 'all',

  setStructured: (structured: StructuredRecs | null) => set({ structured }),
  setRecs:       (recs)       => set({ recs }),
  setLoading:    (loading)    => set({ loading }),
  setError:      (error)      => set({ error }),
  setLoaded:     (loaded)     => set({ loaded }),
  setTopic:      (topic)      => set({ topic }),
  setPlatform:   (platform)   => set({ platform }),
  reset:         ()           => set({ structured: null, recs: [], loaded: false, error: '' }),
}))
