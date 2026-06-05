import { create } from 'zustand'
import type { MLRecommendation } from '../api/recommendations'

interface RecommenderState {
  recs: MLRecommendation[]
  loading: boolean
  error: string
  loaded: boolean
  topic: string
  platform: string

  setRecs: (r: MLRecommendation[]) => void
  setLoading: (v: boolean) => void
  setError: (e: string) => void
  setLoaded: (v: boolean) => void
  setTopic: (t: string) => void
  setPlatform: (p: string) => void
}

export const useRecommenderStore = create<RecommenderState>((set) => ({
  recs: [],
  loading: false,
  error: '',
  loaded: false,
  topic: 'any',
  platform: 'any',

  setRecs:     (recs)     => set({ recs }),
  setLoading:  (loading)  => set({ loading }),
  setError:    (error)    => set({ error }),
  setLoaded:   (loaded)   => set({ loaded }),
  setTopic:    (topic)    => set({ topic }),
  setPlatform: (platform) => set({ platform }),
}))
