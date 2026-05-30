import { create } from 'zustand'
import type { UserStats, PlatformAccount } from '../types'

interface StatsState {
  stats: UserStats[]
  accounts: PlatformAccount[]
  cfRating: number | null
  setStats: (s: UserStats[]) => void
  setAccounts: (a: PlatformAccount[]) => void
  setCfRating: (r: number | null) => void
}

export const useStatsStore = create<StatsState>((set) => ({
  stats: [],
  accounts: [],
  cfRating: null,
  setStats: (stats) => set({ stats }),
  setAccounts: (accounts) => set({ accounts }),
  setCfRating: (cfRating) => set({ cfRating }),
}))
