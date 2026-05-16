import { ChatSession, Document } from '../types'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const SESSIONS_KEY = 'docmind_sessions'
const DOCS_KEY = 'docmind_documents'

// ── API ───────────────────────────────────────────────────────────────────────

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(5000) })
    return res.ok
  } catch { return false }
}

export async function uploadDocument(file: File): Promise<any> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${API_BASE}/upload`, { method: 'POST', body: form })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Upload failed' }))
    throw new Error(err.detail || 'Upload failed')
  }
  return res.json()
}

export async function askQuestion(document_id: string, question: string, chat_history: any[]): Promise<any> {
  const res = await fetch(`${API_BASE}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ document_id, question, chat_history }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to get answer' }))
    throw new Error(err.detail || 'Failed to get answer')
  }
  return res.json()
}

export async function summarizeDocument(document_id: string): Promise<any> {
  const res = await fetch(`${API_BASE}/summarize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ document_id }),
  })
  if (!res.ok) throw new Error('Failed to generate summary')
  return res.json()
}

export async function deleteDocumentAPI(document_id: string): Promise<void> {
  await fetch(`${API_BASE}/documents/${document_id}`, { method: 'DELETE' })
}

// ── Local Storage ─────────────────────────────────────────────────────────────

export function getSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function saveSession(session: ChatSession): void {
  const sessions = getSessions().filter(s => s.id !== session.id)
  localStorage.setItem(SESSIONS_KEY, JSON.stringify([session, ...sessions]))
}

export function deleteSession(session_id: string): void {
  const sessions = getSessions().filter(s => s.id !== session_id)
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions))
}

export function getLocalDocuments(): Document[] {
  try {
    const raw = localStorage.getItem(DOCS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function saveLocalDocument(doc: Document): void {
  const docs = getLocalDocuments().filter(d => d.id !== doc.id)
  localStorage.setItem(DOCS_KEY, JSON.stringify([doc, ...docs]))
}

export function removeLocalDocument(doc_id: string): void {
  const docs = getLocalDocuments().filter(d => d.id !== doc_id)
  localStorage.setItem(DOCS_KEY, JSON.stringify(docs))
}
