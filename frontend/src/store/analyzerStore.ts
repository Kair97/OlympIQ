import { create } from 'zustand'
import type { Analysis } from '../types'

interface AnalyzerState {
  analyses: Analysis[]
  current: Analysis | null
  loading: boolean
  setAnalyses: (a: Analysis[]) => void
  setCurrent: (a: Analysis | null) => void
  setLoading: (v: boolean) => void
}

export const useAnalyzerStore = create<AnalyzerState>((set) => ({
  analyses: [],
  current: null,
  loading: false,
  setAnalyses: (analyses) => set({ analyses }),
  setCurrent: (current) => set({ current }),
  setLoading: (loading) => set({ loading }),
}))
