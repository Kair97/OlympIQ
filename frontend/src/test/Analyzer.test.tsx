import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import Analyzer from '../pages/Analyzer'

vi.mock('../api/analyzer', () => ({
  listAnalyses: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 }),
  analyzeProblem: vi.fn(),
}))

vi.mock('../store/authStore', () => ({
  useAuthStore: () => ({ user: { id: '1', username: 'alice', email: 'a@b.com', created_at: '' } }),
}))

test('analyzer has no code editor element', () => {
  render(<BrowserRouter><Analyzer /></BrowserRouter>)
  expect(document.querySelector('textarea')).toBeNull()
  expect(document.querySelector('.CodeMirror')).toBeNull()
  expect(document.querySelector('[class*="editor"]')).toBeNull()
})

test('shows URL input for problem analysis', () => {
  render(<BrowserRouter><Analyzer /></BrowserRouter>)
  const input = screen.getByPlaceholderText(/codeforces/i)
  expect(input).toBeInTheDocument()
  expect(input).not.toHaveAttribute('type', 'textarea')
})

test('has analyze button', () => {
  render(<BrowserRouter><Analyzer /></BrowserRouter>)
  const buttons = screen.getAllByRole('button', { name: /analyze/i })
  expect(buttons.some(button => !button.hasAttribute('disabled'))).toBe(true)
})
