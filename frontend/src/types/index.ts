export interface Document {
  id: string
  filename: string
  page_count: number
  chunk_count: number
  uploaded_at: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
  timestamp: string
  loading?: boolean
}

export interface Source {
  page: number
  content: string
  score: number
}

export interface ChatSession {
  id: string
  document_id: string
  document_name: string
  messages: ChatMessage[]
  created_at: string
  updated_at: string
}
