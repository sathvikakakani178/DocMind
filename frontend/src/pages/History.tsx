import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MessageSquare, FileText, Trash2, ArrowRight, Clock } from 'lucide-react'
import { getSessions, deleteSession } from '../lib/api'
import { ChatSession } from '../types'
import { format } from 'date-fns'

export default function HistoryPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const navigate = useNavigate()

  useEffect(() => { setSessions(getSessions()) }, [])

  const handleDelete = (id: string) => {
    deleteSession(id)
    setSessions(getSessions())
  }

  if (!sessions.length) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center px-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-8 h-8 text-slate-300" />
          </div>
          <h2 className="font-semibold text-slate-700 mb-2">No chat history yet</h2>
          <p className="text-sm text-slate-400 mb-6">Upload a document and start chatting to see your history here.</p>
          <Link to="/" className="btn-primary">Upload a Document</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-20 pb-16 px-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Chat History</h1>
          <p className="text-sm text-slate-500">{sessions.length} conversation{sessions.length > 1 ? 's' : ''}</p>
        </div>

        <div className="space-y-3">
          {sessions.map(s => (
            <div key={s.id} className="card p-4 hover:shadow-md transition-shadow group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 cursor-pointer flex-1"
                  onClick={() => navigate(`/chat?doc=${s.document_id}&name=${encodeURIComponent(s.document_name)}`)}>
                  <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-900 text-sm truncate">{s.document_name}</div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        {s.messages.filter(m => m.role === 'user').length} questions
                      </span>
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(s.updated_at), 'MMM d, h:mm a')}
                      </span>
                    </div>
                    {/* Last message preview */}
                    {s.messages.length > 0 && (
                      <div className="text-xs text-slate-400 mt-1 truncate">
                        {s.messages[s.messages.length - 1].content.slice(0, 80)}...
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
                  <button onClick={e => { e.stopPropagation(); handleDelete(s.id) }}
                    className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
