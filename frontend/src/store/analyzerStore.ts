import { create } from 'zustand'
import type { Analysis, AnalysisContent } from '../types'

type RazborTab = 'all' | 'hints' | 'solution'

interface AnalyzerState {
  // Persistent across navigation
  history: Analysis[]
  currentContent: AnalysisContent | null
  currentURL: string
  activeId: string | null
  tab: RazborTab
  revealedHints: number
  historyOpen: boolean
  historySearch: string

  // Transient (reset on new analysis attempt)
  analyzing: boolean
  error: string

  // Actions
  setHistory: (h: Analysis[]) => void
  setCurrentContent: (c: AnalysisContent | null, url: string, id?: string | null) => void
  setTab: (t: RazborTab) => void
  setRevealedHints: (n: number) => void
  setHistoryOpen: (v: boolean) => void
  setHistorySearch: (s: string) => void
  setAnalyzing: (v: boolean) => void
  setError: (e: string) => void
  reset: () => void
}

export const useAnalyzerStore = create<AnalyzerState>((set) => ({
  history: [],
  currentContent: null,
  currentURL: '',
  activeId: null,
  tab: 'all',
  revealedHints: 0,
  historyOpen: false,
  historySearch: '',
  analyzing: false,
  error: '',

  setHistory: (history) => set({ history }),
  setCurrentContent: (currentContent, currentURL, activeId = null) =>
    set({ currentContent, currentURL, activeId, revealedHints: 0, tab: 'all', error: '' }),
  setTab: (tab) => set({ tab }),
  setRevealedHints: (revealedHints) => set({ revealedHints }),
  setHistoryOpen: (historyOpen) => set({ historyOpen }),
  setHistorySearch: (historySearch) => set({ historySearch }),
  setAnalyzing: (analyzing) => set({ analyzing }),
  setError: (error) => set({ error }),
  reset: () => set({ currentContent: null, currentURL: '', activeId: null, error: '', revealedHints: 0, tab: 'all' }),
}))
