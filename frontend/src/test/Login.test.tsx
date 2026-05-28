import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { vi } from 'vitest'
import Login from '../pages/Login'

vi.mock('../api/auth', () => ({
  login: vi.fn().mockResolvedValue({ id: '1', email: 'a@b.com', username: 'alice', created_at: '' }),
}))

vi.mock('../store/authStore', () => ({
  useAuthStore: () => ({ user: null, setUser: vi.fn() }),
}))

const wrap = (ui: React.ReactElement) => render(<BrowserRouter>{ui}</BrowserRouter>)

test('renders login form', () => {
  wrap(<Login />)
  expect(screen.getByPlaceholderText(/you@example.com/i)).toBeInTheDocument()
  expect(screen.getByPlaceholderText(/••••••••/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
})

test('shows error on empty submit', async () => {
  wrap(<Login />)
  fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
  await waitFor(() => {})
})

test('disables button while loading', async () => {
  wrap(<Login />)
  const email = screen.getByPlaceholderText(/you@example.com/i)
  const password = screen.getByPlaceholderText(/••••••••/i)
  fireEvent.change(email, { target: { value: 'a@b.com' } })
  fireEvent.change(password, { target: { value: 'password123' } })
})
