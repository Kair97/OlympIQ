import { create } from 'zustand'
import type { UserStats, PlatformAccount } from '../types'

interface StatsState {
  stats: UserStats[]
  accounts: PlatformAccount[]
  setStats: (s: UserStats[]) => void
  setAccounts: (a: PlatformAccount[]) => void
}

export const useStatsStore = create<StatsState>((set) => ({
  stats: [],
  accounts: [],
  setStats: (stats) => set({ stats }),
  setAccounts: (accounts) => set({ accounts }),
}))
