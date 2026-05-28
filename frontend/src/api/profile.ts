import { get, put, del, post } from './client'
import type { User, PlatformAccount, UserStats, UserGoal } from '../types'

export const getProfile = () => get<User>('/profile')
export const updateProfile = (data: { email?: string; username?: string }) => put<User>('/profile', data)
export const deleteProfile = () => del<null>('/profile')

export const connectAccount = (platform: string, handle: string) =>
  post<PlatformAccount>('/accounts/connect', { platform, handle })
export const disconnectAccount = (platform: string) => del<null>(`/accounts/${platform}`)
export const syncAccounts = () => post<null>('/accounts/sync')
export const getStats = () => get<UserStats[]>('/stats')

export const getGoals = () => get<UserGoal | null>('/goals')
export const upsertGoals = (data: Partial<UserGoal>) => put<UserGoal>('/goals', data)
