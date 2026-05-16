import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { Send, FileText, Loader2, BookOpen, ChevronDown, ChevronUp, ArrowLeft, Sparkles, AlertCircle } from 'lucide-react'
import { askQuestion, summarizeDocument, saveSession, getSessions } from '../lib/api'
import { ChatMessage, ChatSession, Source } from '../types'
import { format } from 'date-fns'

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 animate-fadeIn">
      <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
        <Sparkles className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="chat-ai flex items-center gap-1 py-3">
        <div className="typing-dot w-2 h-2 bg-slate-400 rounded-full" />
        <div className="typing-dot w-2 h-2 bg-slate-400 rounded-full" />
        <div className="typing-dot w-2 h-2 bg-slate-400 rounded-full" />
      </div>
    </div>
  )
}

function SourceCard({ sources }: { sources: Source[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-2 border border-slate-100 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 transition-colors text-xs text-slate-600 font-medium">
        <span>📎 {sources.length} source{sources.length > 1 ? 's' : ''}</span>
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {open && (
        <div className="p-3 space-y-2">
          {sources.map((s, i) => (
            <div key={i} className="text-xs bg-blue-50 rounded-lg p-2 border border-blue-100">
              <div className="font-semibold text-blue-600 mb-1">Page {s.page} — Score: {s.score}</div>
              <div className="text-slate-600 line-clamp-3">{s.content}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const SUGGESTED_QUESTIONS = [
  "What is the main topic of this document?",
  "Summarize the key findings",
  "What are the main conclusions?",
  "List the important points",
]

export default function ChatPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const docId = searchParams.get('doc')
  const docName = searchParams.get('name') || 'Document'

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [session, setSession] = useState<ChatSession | null>(null)
  const [summarizing, setSummarizing] = useState(false)
  const [summary, setSummary] = useState('')
  const [showSummary, setShowSummary] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!docId) {
      navigate('/')
      return
    }

    // Load or create session
    const sessions = getSessions()
    const existing = sessions.find(s => s.document_id === docId)
    if (existing) {
      setSession(existing)
      setMessages(existing.messages)
    } else {
      const newSession: ChatSession = {
        id: `session_${Date.now()}`,
        document_id: docId,
        document_name: decodeURIComponent(docName),
        messages: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      setSession(newSession)
      saveSession(newSession)
    }
  }, [docId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = async (text: string) => {
    if (!text.trim() || !docId || loading) return

    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    }

    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setInput('')
    setLoading(true)
    setError('')

    try {
      // Build chat history for context
      const chatHistory = updatedMessages.slice(-6).map(m => ({
        role: m.role,
        content: m.content,
      }))

      const result = await askQuestion(docId, text, chatHistory)

      const aiMsg: ChatMessage = {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content: result.answer || result.error || 'No answer returned.',
        sources: result.sources,
        timestamp: new Date().toISOString(),
      }

      const finalMessages = [...updatedMessages, aiMsg]
      setMessages(finalMessages)

      if (session) {
        const updatedSession = { ...session, messages: finalMessages, updated_at: new Date().toISOString() }
        setSession(updatedSession)
        saveSession(updatedSession)
      }
    } catch (e: any) {
      setError(e.message || 'Failed to get answer.')
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleSummarize = async () => {
    if (!docId) return
    setSummarizing(true)
    setShowSummary(true)
    try {
      const result = await summarizeDocument(docId)
      setSummary(result.summary || result.error || 'Failed to generate summary.')
    } catch (e: any) {
      setSummary('Error generating summary.')
    } finally {
      setSummarizing(false)
    }
  }

  if (!docId) return null

  return (
    <div className="flex flex-col h-screen pt-14">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-slate-400 hover:text-slate-700 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="w-7 h-7 bg-red-50 rounded-lg flex items-center justify-center">
            <FileText className="w-3.5 h-3.5 text-red-500" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900 max-w-xs truncate">{decodeURIComponent(docName)}</div>
            <div className="text-xs text-slate-400">{messages.filter(m => m.role === 'user').length} questions asked</div>
          </div>
        </div>
        <button onClick={handleSummarize}
          className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors">
          <BookOpen className="w-3.5 h-3.5" />
          Summarize
        </button>
      </div>

      {/* Summary panel */}
      {showSummary && (
        <div className="bg-blue-50 border-b border-blue-100 px-4 py-3 flex-shrink-0 max-h-64 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-blue-700">📋 Document Summary</span>
            <button onClick={() => setShowSummary(false)} className="text-blue-400 hover:text-blue-700 text-xs">Close</button>
          </div>
          {summarizing ? (
            <div className="flex items-center gap-2 text-sm text-blue-600">
              <Loader2 className="w-4 h-4 animate-spin" />Generating summary...
            </div>
          ) : (
            <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{summary}</div>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center animate-fadeUp">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
              <Sparkles className="w-7 h-7 text-blue-400" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-2">Ask anything about your document</h3>
            <p className="text-sm text-slate-400 mb-6 max-w-sm">AI will search through the document and provide answers with source citations.</p>
            <div className="grid grid-cols-2 gap-2 max-w-sm w-full">
              {SUGGESTED_QUESTIONS.map(q => (
                <button key={q} onClick={() => sendMessage(q)}
                  className="text-xs text-left bg-white border border-slate-200 rounded-xl p-3 hover:border-blue-300 hover:bg-blue-50 transition-colors text-slate-600">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`flex items-end gap-2 animate-fadeIn ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
            )}
            <div className={msg.role === 'user' ? 'chat-user' : ''}>
              {msg.role === 'assistant' ? (
                <div className="chat-ai">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                  {msg.sources && msg.sources.length > 0 && <SourceCard sources={msg.sources} />}
                  <div className="text-xs text-slate-300 mt-2">{format(new Date(msg.timestamp), 'h:mm a')}</div>
                </div>
              ) : (
                <>
                  {msg.content}
                  <div className="text-xs text-blue-200 mt-1 text-right">{format(new Date(msg.timestamp), 'h:mm a')}</div>
                </>
              )}
            </div>
          </div>
        ))}

        {loading && <TypingIndicator />}

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
            <AlertCircle className="w-4 h-4" />{error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-slate-100 px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-2 max-w-4xl mx-auto">
          <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
            placeholder="Ask a question about your document..."
            disabled={loading}
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-400 disabled:opacity-60" />
          <button onClick={() => sendMessage(input)} disabled={!input.trim() || loading}
            className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0">
            {loading ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Send className="w-4 h-4 text-white" />}
          </button>
        </div>
      </div>
    </div>
  )
}
