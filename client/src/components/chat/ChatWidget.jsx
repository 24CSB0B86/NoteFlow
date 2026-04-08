import { useState, useRef, useEffect, useCallback } from 'react'
import api from '../../lib/api'
import { useLocation } from 'react-router-dom'

// ─── Simple markdown renderer (bold, inline code, lists) ─────────────────────
function renderMarkdown(text) {
  if (!text) return null
  const lines = text.split('\n')
  const elements = []
  let listItems = []

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} style={{ marginLeft: '1rem', marginTop: '0.25rem' }}>
          {listItems.map((li, i) => <li key={i} style={{ marginBottom: '0.15rem' }}>{parseInline(li)}</li>)}
        </ul>
      )
      listItems = []
    }
  }

  const parseInline = (str) => {
    const parts = str.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**'))
        return <strong key={i}>{part.slice(2, -2)}</strong>
      if (part.startsWith('`') && part.endsWith('`'))
        return <code key={i} style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '3px', padding: '0 3px', fontFamily: 'monospace', fontSize: '0.85em' }}>{part.slice(1, -1)}</code>
      return part
    })
  }

  lines.forEach((line, idx) => {
    if (line.match(/^[-*•]\s/)) {
      listItems.push(line.replace(/^[-*•]\s/, ''))
    } else if (line.match(/^\d+\.\s/)) {
      listItems.push(line.replace(/^\d+\.\s/, ''))
    } else {
      flushList()
      if (line.trim() === '') {
        elements.push(<br key={`br-${idx}`} />)
      } else {
        elements.push(<p key={`p-${idx}`} style={{ margin: '0.15rem 0' }}>{parseInline(line)}</p>)
      }
    }
  })
  flushList()
  return elements
}

// ─── Quick suggestion chips ───────────────────────────────────────────────────
const SUGGESTIONS = [
  'How do I join a classroom?',
  'How do I upload a resource?',
  'What are karma points?',
  'How do heatmaps work?',
  'What is the Bounty Board?',
]

// ─── Main widget ──────────────────────────────────────────────────────────────
export default function ChatWidget() {
  const [open, setOpen]           = useState(false)
  const [messages, setMessages]   = useState([])
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [histLoaded, setHistLoaded] = useState(false)
  const [unread, setUnread]       = useState(false)
  const [copying, setCopying]     = useState(null)
  const [clearing, setClearing]   = useState(false)

  const bottomRef  = useRef(null)
  const inputRef   = useRef(null)
  const location   = useLocation()

  // Extract classroom_id from URL if on a classroom page
  const classroomId = location.pathname.match(/\/classrooms\/([^/]+)/)?.[1] || null

  // ── Load history on first open ──────────────────────────────────────────────
  useEffect(() => {
    if (!open || histLoaded) return
    ;(async () => {
      try {
        const { data } = await api.get('/api/chat/history?limit=30')
        setMessages(data.messages.map(m => ({
          id: m.id, role: m.role, content: m.content, rating: m.rating, ts: m.created_at,
        })))
      } catch {
        // Non-fatal — start fresh
      } finally {
        setHistLoaded(true)
      }
    })()
  }, [open, histLoaded])

  // ── Scroll to bottom on new messages ───────────────────────────────────────
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, open])

  // ── Focus input when opening ────────────────────────────────────────────────
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150)
    else if (!open && messages.length > 0) setUnread(false)
  }, [open])

  // ── Send message ────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text) => {
    const trimmed = (text || input).trim()
    if (!trimmed || loading) return

    setInput('')
    const userMsg = { role: 'user', content: trimmed, id: `u-${Date.now()}`, ts: new Date().toISOString() }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const { data } = await api.post('/api/chat', { message: trimmed, classroom_id: classroomId })
      const botMsg = { role: 'assistant', content: data.reply, id: data.message_id, ts: data.created_at, rating: null }
      setMessages(prev => [...prev, botMsg])
      if (!open) setUnread(true)
    } catch (err) {
      const errMsg = err?.response?.data?.error || 'Something went wrong. Please try again.'
      setMessages(prev => [...prev, { role: 'assistant', content: errMsg, id: `e-${Date.now()}`, ts: new Date().toISOString(), error: true }])
    } finally {
      setLoading(false)
    }
  }, [input, loading, classroomId, open])

  // ── Handle Enter key ────────────────────────────────────────────────────────
  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  // ── Rate message ────────────────────────────────────────────────────────────
  const rateMessage = async (id, rating) => {
    try {
      await api.patch(`/api/chat/${id}/rate`, { rating })
      setMessages(prev => prev.map(m => m.id === id ? { ...m, rating } : m))
    } catch { /* silently fail */ }
  }

  // ── Copy message ────────────────────────────────────────────────────────────
  const copyMessage = async (id, text) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopying(id)
      setTimeout(() => setCopying(null), 1500)
    } catch { /* clipboard unavailable */ }
  }

  // ── Clear history ────────────────────────────────────────────────────────────
  const clearHistory = async () => {
    if (!window.confirm('Clear all chat history?')) return
    setClearing(true)
    try {
      await api.delete('/api/chat/history')
      setMessages([])
    } catch { /* ignore */ } finally {
      setClearing(false)
    }
  }

  // ── Styles (inline to work with any CSS setup) ───────────────────────────────
  const styles = {
    // Floating button
    fab: {
      position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999,
      width: '56px', height: '56px', borderRadius: '50%',
      background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
      border: 'none', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 4px 24px rgba(99,102,241,0.5)',
      transition: 'transform 0.2s, box-shadow 0.2s',
      color: 'white', fontSize: '24px',
    },
    // Unread dot
    dot: {
      position: 'absolute', top: '6px', right: '6px',
      width: '10px', height: '10px', borderRadius: '50%',
      background: '#f43f5e', border: '2px solid white',
    },
    // Chat window
    window: {
      position: 'fixed', bottom: '90px', right: '24px', zIndex: 9998,
      width: '380px', maxWidth: 'calc(100vw - 48px)',
      height: '520px', maxHeight: 'calc(100vh - 110px)',
      borderRadius: '20px', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      background: 'rgba(15, 15, 30, 0.97)',
      border: '1px solid rgba(99,102,241,0.3)',
      boxShadow: '0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)',
      backdropFilter: 'blur(20px)',
      animation: 'chatSlideIn 0.25s ease',
    },
    // Header
    header: {
      padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '10px',
      background: 'linear-gradient(135deg, rgba(99,102,241,0.25) 0%, rgba(139,92,246,0.15) 100%)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      flexShrink: 0,
    },
    headerAvatar: {
      width: '34px', height: '34px', borderRadius: '50%',
      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '16px', flexShrink: 0,
    },
    headerText: { flex: 1, minWidth: 0 },
    headerTitle: { margin: 0, fontSize: '14px', fontWeight: 700, color: '#fff' },
    headerSub: { margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.5)' },
    // Messages area
    messages: {
      flex: 1, overflowY: 'auto', padding: '12px 14px',
      display: 'flex', flexDirection: 'column', gap: '10px',
      scrollbarWidth: 'thin', scrollbarColor: 'rgba(99,102,241,0.3) transparent',
    },
    // Bubble
    bubble: (role) => ({
      maxWidth: '88%', padding: '10px 13px', borderRadius: role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
      background: role === 'user'
        ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
        : 'rgba(255,255,255,0.07)',
      color: '#fff', fontSize: '13px', lineHeight: '1.5',
      alignSelf: role === 'user' ? 'flex-end' : 'flex-start',
      border: role === 'user' ? 'none' : '1px solid rgba(255,255,255,0.07)',
      wordBreak: 'break-word',
    }),
    // Typing indicator
    typingDot: (delay) => ({
      width: '6px', height: '6px', borderRadius: '50%', background: 'rgba(255,255,255,0.5)',
      animation: 'typingBounce 1.2s infinite', animationDelay: delay,
    }),
    // Suggestions
    suggRow: { display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '4px 14px 8px' },
    suggChip: {
      padding: '4px 10px', borderRadius: '20px', fontSize: '11px',
      background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
      color: 'rgba(255,255,255,0.75)', cursor: 'pointer', transition: 'all 0.15s',
    },
    // Input area
    inputRow: {
      padding: '10px 12px', display: 'flex', gap: '8px', alignItems: 'flex-end',
      borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0,
    },
    textarea: {
      flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(99,102,241,0.2)',
      borderRadius: '12px', padding: '8px 12px', color: '#fff', fontSize: '13px',
      resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: '1.4',
      maxHeight: '80px', overflow: 'auto',
      transition: 'border-color 0.15s',
    },
    sendBtn: {
      width: '36px', height: '36px', borderRadius: '10px', border: 'none', cursor: 'pointer',
      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, fontSize: '16px', transition: 'opacity 0.15s',
    },
    // Action buttons under bot messages
    msgActions: {
      display: 'flex', gap: '4px', marginTop: '4px',
      alignItems: 'center',
    },
    actionBtn: (active) => ({
      background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
      borderRadius: '4px', fontSize: '12px', color: active ? '#6366f1' : 'rgba(255,255,255,0.3)',
      transition: 'color 0.15s',
    }),
  }

  return (
    <>
      <style>{`
        @keyframes chatSlideIn {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-5px); }
        }
        .nf-chat-fab:hover { transform: scale(1.08) !important; box-shadow: 0 6px 30px rgba(99,102,241,0.7) !important; }
        .nf-chat-send:hover { opacity: 0.85; }
        .nf-chat-chip:hover { background: rgba(99,102,241,0.3) !important; color: white !important; }
        .nf-chat-action:hover { color: rgba(255,255,255,0.7) !important; }
        .nf-chat-textarea:focus { border-color: rgba(99,102,241,0.5) !important; }
        .nf-chat-messages::-webkit-scrollbar { width: 4px; }
        .nf-chat-messages::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.3); border-radius: 2px; }
      `}</style>

      {/* Floating action button */}
      <button
        className="nf-chat-fab"
        style={styles.fab}
        onClick={() => { setOpen(o => !o); setUnread(false) }}
        aria-label={open ? 'Close chat' : 'Open NoteFlow AI chat'}
        title="NoteFlow AI Assistant"
      >
        {open ? '✕' : '🤖'}
        {unread && !open && <span style={styles.dot} />}
      </button>

      {/* Chat window */}
      {open && (
        <div style={styles.window} role="dialog" aria-label="NoteFlow AI Chat">
          {/* Header */}
          <div style={styles.header}>
            <div style={styles.headerAvatar}>🤖</div>
            <div style={styles.headerText}>
              <p style={styles.headerTitle}>NoteFlow AI</p>
              <p style={styles.headerSub}>
                {loading ? '⚡ Typing…' : '● Online — ask me anything'}
              </p>
            </div>
            {messages.length > 0 && (
              <button
                onClick={clearHistory}
                disabled={clearing}
                title="Clear chat history"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: '16px', padding: '2px' }}
              >
                🗑
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="nf-chat-messages" style={styles.messages}>
            {/* Welcome message */}
            {messages.length === 0 && !loading && (
              <div style={{ textAlign: 'center', padding: '20px 10px', color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>
                <div style={{ fontSize: '36px', marginBottom: '10px' }}>👋</div>
                <p style={{ margin: 0, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>Hi! I'm NoteFlow AI</p>
                <p style={{ margin: '6px 0 0', fontSize: '12px' }}>Ask me about classrooms, resources, karma, bounties — or anything about NoteFlow!</p>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={styles.bubble(msg.role)}>
                  {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
                </div>
                {/* Actions for bot messages */}
                {msg.role === 'assistant' && !msg.error && (
                  <div style={styles.msgActions}>
                    <button
                      className="nf-chat-action"
                      style={styles.actionBtn(msg.rating === true)}
                      onClick={() => rateMessage(msg.id, true)}
                      title="Helpful"
                    >👍</button>
                    <button
                      className="nf-chat-action"
                      style={styles.actionBtn(msg.rating === false)}
                      onClick={() => rateMessage(msg.id, false)}
                      title="Not helpful"
                    >👎</button>
                    <button
                      className="nf-chat-action"
                      style={{ ...styles.actionBtn(false), fontSize: '11px' }}
                      onClick={() => copyMessage(msg.id, msg.content)}
                      title="Copy"
                    >{copying === msg.id ? '✓' : '📋'}</button>
                  </div>
                )}
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                <div style={{ ...styles.bubble('assistant'), display: 'flex', gap: '4px', alignItems: 'center', padding: '12px 16px' }}>
                  <span style={styles.typingDot('0s')} />
                  <span style={styles.typingDot('0.2s')} />
                  <span style={styles.typingDot('0.4s')} />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick suggestions (only when no messages yet) */}
          {messages.length === 0 && (
            <div style={styles.suggRow}>
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  className="nf-chat-chip"
                  style={styles.suggChip}
                  onClick={() => sendMessage(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={styles.inputRow}>
            <textarea
              ref={inputRef}
              className="nf-chat-textarea"
              style={styles.textarea}
              rows={1}
              placeholder="Ask NoteFlow AI…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              disabled={loading}
              aria-label="Chat message input"
              id="chat-input"
              maxLength={1000}
            />
            <button
              className="nf-chat-send"
              style={{ ...styles.sendBtn, opacity: (!input.trim() || loading) ? 0.4 : 1 }}
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              aria-label="Send message"
            >
              ➤
            </button>
          </div>
        </div>
      )}
    </>
  )
}
