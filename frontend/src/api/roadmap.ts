import { get, post } from './client'
import type { UnifiedRoadmap } from '../types'

export const generateRoadmap = () =>
  post<UnifiedRoadmap>('/roadmap/generate', { mode: 'all' })

export const getRoadmap = () =>
  get<{ roadmap: UnifiedRoadmap; mode: string; generated_at: string }>('/roadmap')
