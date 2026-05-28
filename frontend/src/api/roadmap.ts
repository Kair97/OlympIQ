import { get, post } from './client'
import type { AnyRoadmap } from '../types'

export const generateRoadmap = (mode: string) =>
  post<AnyRoadmap>('/roadmap/generate', { mode })

export const getRoadmap = () =>
  get<{ roadmap: AnyRoadmap; mode: string; generated_at: string }>('/roadmap')
