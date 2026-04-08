import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// ── Mock the api module so no real HTTP calls are made ────────────────────────
vi.mock('../../lib/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  },
}))

import api from '../../lib/api'
import ChatWidget from '../../components/chat/ChatWidget'

// ── Helper: render with router context ───────────────────────────────────────
function renderWidget() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <ChatWidget />
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  // Default: history returns empty
  api.get.mockResolvedValue({ data: { messages: [], total: 0 } })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('ChatWidget – Floating Button', () => {
  it('renders the floating chat button', () => {
    renderWidget()
    const btn = screen.getByRole('button', { name: /open noteflow ai chat/i })
    expect(btn).toBeTruthy()
  })

  it('does not show the chat window initially', () => {
    renderWidget()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens the chat window when button is clicked', async () => {
    renderWidget()
    const fab = screen.getByRole('button', { name: /open noteflow ai chat/i })
    fireEvent.click(fab)
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeTruthy()
    })
  })

  it('closes the chat window on second click', async () => {
    renderWidget()
    const fab = screen.getByRole('button', { name: /open noteflow ai chat/i })
    fireEvent.click(fab) // open
    await waitFor(() => screen.getByRole('dialog'))
    fireEvent.click(screen.getByRole('button', { name: /close chat/i })) // close
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('ChatWidget – Welcome State', () => {
  it('shows welcome message when no history', async () => {
    renderWidget()
    fireEvent.click(screen.getByRole('button', { name: /open noteflow ai chat/i }))
    await waitFor(() => {
      expect(screen.getByText(/hi! i'm noteflow ai/i)).toBeTruthy()
    })
  })

  it('shows quick suggestion chips', async () => {
    renderWidget()
    fireEvent.click(screen.getByRole('button', { name: /open noteflow ai chat/i }))
    await waitFor(() => {
      expect(screen.getByText(/how do i join a classroom/i)).toBeTruthy()
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('ChatWidget – Sending Messages', () => {
  it('renders the text input', async () => {
    renderWidget()
    fireEvent.click(screen.getByRole('button', { name: /open noteflow ai chat/i }))
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/ask noteflow ai/i)).toBeTruthy()
    })
  })

  it('send button is disabled when input is empty', async () => {
    renderWidget()
    fireEvent.click(screen.getByRole('button', { name: /open noteflow ai chat/i }))
    await waitFor(() => screen.getByRole('dialog'))
    const sendBtn = screen.getByRole('button', { name: /send message/i })
    expect(sendBtn.disabled).toBe(true)
  })

  it('sends a message and shows AI reply', async () => {
    api.post.mockResolvedValueOnce({
      data: { reply: 'Karma is your reputation!', message_id: 'm1', created_at: new Date().toISOString() }
    })

    renderWidget()
    fireEvent.click(screen.getByRole('button', { name: /open noteflow ai chat/i }))
    await waitFor(() => screen.getByRole('dialog'))

    const input = screen.getByLabelText(/chat message input/i)
    fireEvent.change(input, { target: { value: 'What is karma?' } })
    const sendBtn = screen.getByRole('button', { name: /send message/i })
    expect(sendBtn.disabled).toBe(false)
    fireEvent.click(sendBtn)

    await waitFor(() => {
      expect(screen.getByText('What is karma?')).toBeTruthy()
    })
    await waitFor(() => {
      expect(screen.getByText(/karma is your reputation/i)).toBeTruthy()
    })
    expect(api.post).toHaveBeenCalledWith('/api/chat', {
      message: 'What is karma?',
      classroom_id: null,
    })
  })

  it('shows error message when API call fails', async () => {
    api.post.mockRejectedValueOnce({ response: { data: { error: 'Server error' } } })

    renderWidget()
    fireEvent.click(screen.getByRole('button', { name: /open noteflow ai chat/i }))
    await waitFor(() => screen.getByRole('dialog'))

    const input = screen.getByLabelText(/chat message input/i)
    fireEvent.change(input, { target: { value: 'Hello?' } })
    fireEvent.click(screen.getByRole('button', { name: /send message/i }))

    await waitFor(() => {
      expect(screen.getByText(/server error/i)).toBeTruthy()
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('ChatWidget – Suggestion Chips', () => {
  it('clicking a suggestion chip sends that message', async () => {
    api.post.mockResolvedValueOnce({
      data: { reply: 'Here is how to join…', message_id: 'm2', created_at: new Date().toISOString() }
    })

    renderWidget()
    fireEvent.click(screen.getByRole('button', { name: /open noteflow ai chat/i }))
    await waitFor(() => screen.getByRole('dialog'))

    const chip = screen.getByText(/how do i join a classroom/i)
    fireEvent.click(chip)

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/chat', expect.objectContaining({
        message: 'How do I join a classroom?'
      }))
    })
  })
})
