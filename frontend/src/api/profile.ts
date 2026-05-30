import { get, put, del, post } from './client'
import type { User, PlatformAccount, UserStats, UserGoal } from '../types'

export const getProfile = () => get<User>('/profile')
export const updateProfile = (data: { email?: string; username?: string }) => put<User>('/profile', data)
export const deleteProfile = () => del<null>('/profile')

export const getAccounts = () => get<PlatformAccount[]>('/accounts')
export const connectAccount = (platform: string, handle: string) =>
  post<PlatformAccount>('/accounts/connect', { platform, handle })
export const disconnectAccount = (platform: string) => del<null>(`/accounts/${platform}`)
export const syncAccounts = () => post<null>('/accounts/sync')
export const getStats = () => get<UserStats[]>('/stats')

export const getGoals = () => get<UserGoal | null>('/goals')
export const upsertGoals = (data: Partial<UserGoal>) => put<UserGoal>('/goals', data)

export const testAI = () => get<{ status: string; response: string }>('/ai/test')

export interface SessionInfo {
  id: string
  created_at: string
  expires_at: string
}

export const getSessions = () => get<SessionInfo[]>('/sessions')
export const revokeSession = (id: string) => del<null>(`/sessions/${id}`)
export const revokeAllSessions = () => del<null>('/sessions')
