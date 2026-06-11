import { create } from 'zustand'
import type { MLRecommendation, StructuredRecs, RecsProb } from '../api/recommendations'

function topicSlug(topic: string): string {
  return topic.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

// Full topic list for the dropdown. The backend sends `available_topics`
// (all topic slugs in the agent's full response, "any" first) even when the
// problem buckets are filtered to a single topic. Falls back to deriving the
// list from the bucket keys for older cached responses.
export function availableTopics(structured: StructuredRecs): string[] {
  if (structured.available_topics && structured.available_topics.length > 0) {
    return structured.available_topics
  }
  const seen = new Set<string>()
  const topics: string[] = []
  for (const dict of [structured.leetcode, structured.codeforces]) {
    if (!dict) continue
    for (const key of Object.keys(dict)) {
      const slug = topicSlug(key)
      if (!seen.has(slug)) {
        seen.add(slug)
        topics.push(slug)
      }
    }
  }
  const sorted = topics.filter(t => t !== 'any').sort()
  return topics.includes('any') ? ['any', ...sorted] : sorted
}

// Flatten the (already topic-filtered by the server) buckets, applying the
// platform filter client-side. Deduplicates by URL.
export function filterStructured(
  structured: StructuredRecs,
  platform: string,
): Array<RecsProb & { platform: string }> {
  const platforms: Array<'leetcode' | 'codeforces'> =
    platform === 'all' ? ['leetcode', 'codeforces'] : [platform as 'leetcode' | 'codeforces']

  const result: Array<RecsProb & { platform: string }> = []
  const seenUrls = new Set<string>()

  for (const p of platforms) {
    const dict = structured[p]
    if (!dict) continue
    for (const probs of Object.values(dict)) {
      for (const prob of probs) {
        if (prob.url && seenUrls.has(prob.url)) continue
        if (prob.url) seenUrls.add(prob.url)
        result.push({ ...prob, platform: p })
      }
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
