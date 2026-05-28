import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { vi } from 'vitest'
import Register from '../pages/Register'

vi.mock('../api/auth', () => ({
  register: vi.fn().mockResolvedValue({ id: '1', email: 'a@b.com', username: 'alice', created_at: '' }),
}))

vi.mock('../store/authStore', () => ({
  useAuthStore: () => ({ user: null, setUser: vi.fn() }),
}))

const wrap = (ui: React.ReactElement) => render(<BrowserRouter>{ui}</BrowserRouter>)

test('renders all registration fields', () => {
  wrap(<Register />)
  expect(screen.getByPlaceholderText(/you@example.com/i)).toBeInTheDocument()
  expect(screen.getByPlaceholderText(/tourney_handle/i)).toBeInTheDocument()
  expect(screen.getByPlaceholderText(/min 8/i)).toBeInTheDocument()
})

test('shows password length error before submitting', async () => {
  wrap(<Register />)
  fireEvent.change(screen.getByPlaceholderText(/you@example.com/i), { target: { value: 'a@b.com' } })
  fireEvent.change(screen.getByPlaceholderText(/tourney_handle/i), { target: { value: 'alice' } })
  fireEvent.change(screen.getByPlaceholderText(/min 8/i), { target: { value: 'short' } })
  fireEvent.click(screen.getByRole('button', { name: /create account/i }))
  await waitFor(() => {
    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument()
  })
})

test('has link to login page', () => {
  wrap(<Register />)
  expect(screen.getByText(/sign in/i)).toBeInTheDocument()
})
