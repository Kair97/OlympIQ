import axios from 'axios'
import type { ApiResponse } from '../types'

const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

let isRefreshing = false
let refreshQueue: Array<(ok: boolean) => void> = []

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push((ok) => (ok ? resolve(api(original)) : reject(error)))
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
        window.location.href = '/login'
      } finally {
        isRefreshing = false
      }
    }
    return Promise.reject(error)
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
