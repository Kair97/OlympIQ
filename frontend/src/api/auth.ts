import { post, put } from './client'
import type { User } from '../types'

export const register = (email: string, username: string, password: string) =>
  post<User>('/auth/register', { email, username, password })

export const login = (email: string, password: string) =>
  post<User>('/auth/login', { email, password })

export const logout = () => post<null>('/auth/logout')

export const refresh = () => post<User>('/auth/refresh')

export const changePassword = (current_password: string, new_password: string, confirm_password: string) =>
  put<null>('/profile/password', { current_password, new_password, confirm_password })
