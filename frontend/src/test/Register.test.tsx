import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { vi } from 'vitest'
import Register from '../pages/Register'
import { register } from '../api/auth'

vi.mock('../api/auth', () => ({
  register: vi.fn().mockResolvedValue({ id: '1', email: 'a@b.com', username: 'alice', created_at: '' }),
}))

vi.mock('../store/authStore', () => ({
  useAuthStore: () => ({ user: null, setUser: vi.fn() }),
}))

const wrap = (ui: React.ReactElement) => render(<BrowserRouter>{ui}</BrowserRouter>)

test('renders all registration fields', () => {
  wrap(<Register />)
  expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
})

test('shows password length error before submitting', async () => {
  wrap(<Register />)
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.com' } })
  fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'alice' } })
  fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'short' } })
  fireEvent.click(screen.getByRole('button', { name: /create account/i }))
  await waitFor(() => {
    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument()
  })
})

test('shows a friendly username error before submitting', async () => {
  wrap(<Register />)
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'kair@gmail.com' } })
  fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'kair@gmail.com' } })
  fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } })
  fireEvent.submit(screen.getByRole('button', { name: /create account/i }).closest('form')!)

  expect(await screen.findByText(/only letters, numbers, and underscores/i)).toBeInTheDocument()
  expect(vi.mocked(register)).not.toHaveBeenCalled()
})

test('has link to login page', () => {
  wrap(<Register />)
  expect(screen.getByText(/sign in/i)).toBeInTheDocument()
})
