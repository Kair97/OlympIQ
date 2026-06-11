import axios from 'axios'
import type { ApiResponse } from '../types'

const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

let isRefreshing = false
let refreshQueue: Array<(ok: boolean) => void> = []

function toUserMessage(error: unknown): string {
  if (!axios.isAxiosError(error)) return 'Something went wrong'
  const serverMsg: string | undefined = error.response?.data?.error
  if (serverMsg) return serverMsg
  switch (error.response?.status) {
    case 400: return 'Invalid request — please check your input'
    case 401: return 'Incorrect email or password'
    case 403: return 'You do not have permission to do that'
    case 404: return 'Not found'
    case 409: return 'An account with that email or username already exists'
    case 429: return 'Too many attempts — please wait a moment and try again'
    case 500: return 'Server error — please try again later'
    case 502: return 'An external service is unavailable - please try again shortly'
    case 504: return 'Request timed out — the AI service took too long, try again'
    default:  return 'Something went wrong'
  }
}

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config
    const isAuthRoute = original?.url?.startsWith('/auth/')
    if (error.response?.status === 401 && !original._retry && !isAuthRoute) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push((ok) => (ok ? resolve(api(original)) : reject(new Error(toUserMessage(error)))))
        })
      }
      original._retry = true
      isRefreshing = true
      try {
        await axios.post('/api/v1/auth/refresh', {}, { withCredentials: true })
        refreshQueue.forEach((cb) => cb(true))
        refreshQueue = []
        return api(original)
      } catch {
        refreshQueue.forEach((cb) => cb(false))
        refreshQueue = []
        // Only force the login page from protected app routes. Public pages
        // (landing, login, register) probe the session too — a failed refresh
        // there must not yank the visitor away from the page.
        const publicPaths = ['/', '/login', '/register']
        if (!publicPaths.includes(window.location.pathname)) {
          window.location.href = '/login'
        }
      } finally {
        isRefreshing = false
      }
    }
    return Promise.reject(new Error(toUserMessage(error)))
  }
)

export async function get<T>(path: string, params?: Record<string, string>): Promise<T> {
  const r = await api.get<ApiResponse<T>>(path, { params })
  return r.data.data
}

export async function post<T>(path: string, body?: unknown): Promise<T> {
  const r = await api.post<ApiResponse<T>>(path, body)
  return r.data.data
}

export async function put<T>(path: string, body?: unknown): Promise<T> {
  const r = await api.put<ApiResponse<T>>(path, body)
  return r.data.data
}

export async function del<T>(path: string): Promise<T> {
  const r = await api.delete<ApiResponse<T>>(path)
  return r.data.data
}

export default api
