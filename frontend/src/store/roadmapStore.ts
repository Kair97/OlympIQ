import { create } from 'zustand'
import type { AnyRoadmap, UserGoal } from '../types'

type Mode = 'weekly' | 'topic' | 'interview'

interface NotifyPrefs {
  daily: boolean
  weekly: boolean
  problems: boolean
}

interface RoadmapState {
  roadmap: AnyRoadmap | null
  mode: Mode
  goals: UserGoal | null
  notify: NotifyPrefs
  loaded: boolean
  generating: boolean
  genError: string
  editing: boolean

  setRoadmap: (r: AnyRoadmap | null, mode?: Mode) => void
  setMode: (m: Mode) => void
  setGoals: (g: UserGoal | null) => void
  setNotify: (n: NotifyPrefs) => void
  setLoaded: (v: boolean) => void
  setGenerating: (v: boolean) => void
  setGenError: (e: string) => void
  setEditing: (v: boolean) => void
}

export const useRoadmapStore = create<RoadmapState>((set) => ({
  roadmap: null,
  mode: 'weekly',
  goals: null,
  notify: { daily: false, weekly: false, problems: false },
  loaded: false,
  generating: false,
  genError: '',
  editing: false,

  setRoadmap: (roadmap, mode) =>
    set((s) => ({ roadmap, mode: mode ?? s.mode })),
  setMode: (mode) => set({ mode }),
  setGoals: (goals) => set({ goals }),
  setNotify: (notify) => set({ notify }),
  setLoaded: (loaded) => set({ loaded }),
  setGenerating: (generating) => set({ generating }),
  setGenError: (genError) => set({ genError }),
  setEditing: (editing) => set({ editing }),
}))
