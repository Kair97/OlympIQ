import { create } from 'zustand'
import type { AnyRoadmap, UserGoal } from '../types'

interface RoadmapState {
  roadmap: AnyRoadmap | null
  mode: string
  goals: UserGoal | null
  loading: boolean
  setRoadmap: (r: AnyRoadmap | null, mode: string) => void
  setGoals: (g: UserGoal | null) => void
  setLoading: (v: boolean) => void
}

export const useRoadmapStore = create<RoadmapState>((set) => ({
  roadmap: null,
  mode: 'weekly',
  goals: null,
  loading: false,
  setRoadmap: (roadmap, mode) => set({ roadmap, mode }),
  setGoals: (goals) => set({ goals }),
  setLoading: (loading) => set({ loading }),
}))
