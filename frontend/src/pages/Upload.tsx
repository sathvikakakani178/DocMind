import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, FileText, CheckCircle, Loader2, AlertCircle, Zap, Brain, Search, Wifi, WifiOff, X } from 'lucide-react'
import { uploadDocument, checkHealth, saveLocalDocument, getLocalDocuments, removeLocalDocument, deleteDocumentAPI } from '../lib/api'
import { Document } from '../types'
import { format } from 'date-fns'

export default function UploadPage() {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    checkHealth().then(setBackendOnline)
    setDocuments(getLocalDocuments())
  }, [])

  const handleFile = async (file: File) => {
    if (!file.name.endsWith('.pdf')) {
      setError('Only PDF files are supported.')
      return
    }
    if (file.size > 50 * 1024 * 1024) {
      setError('File too large. Maximum size is 50MB.')
      return
    }

    setUploading(true)
    setError('')

    try {
      const result = await uploadDocument(file)
      const doc: Document = {
        id: result.document_id,
        filename: result.filename,
        page_count: result.page_count,
        chunk_count: result.chunk_count,
        uploaded_at: new Date().toISOString(),
      }
      saveLocalDocument(doc)
      setDocuments(getLocalDocuments())
      navigate(`/chat?doc=${result.document_id}&name=${encodeURIComponent(result.filename)}`)
    } catch (e: any) {
      setError(e.message || 'Upload failed. Check backend connection.')
    } finally {
      setUploading(false)
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [])

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const handleDelete = async (doc: Document) => {
    await deleteDocumentAPI(doc.id)
    removeLocalDocument(doc.id)
    setDocuments(getLocalDocuments())
  }

  return (
    <div className="min-h-screen pt-20 pb-16 px-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10 animate-fadeUp">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Chat with your <span className="text-blue-600">Documents</span>
          </h1>
          <p className="text-slate-500 text-sm">Upload a PDF and ask questions using AI-powered RAG</p>
        </div>

        {/* Backend status */}
        {backendOnline !== null && (
          <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-full border w-fit mx-auto mb-6 ${
            backendOnline ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'
          }`}>
            {backendOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {backendOnline ? 'AI Backend Online' : 'Backend Offline'}
          </div>
        )}

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-200 mb-6 ${
            dragging ? 'border-blue-400 bg-blue-50' :
            uploading ? 'border-blue-300 bg-blue-50' :
            'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/30'
          }`}>
          <input type="file" accept=".pdf" onChange={onFileInput} className="absolute inset-0 opacity-0 cursor-pointer" disabled={uploading} />

          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
              <p className="font-semibold text-slate-700">Processing your document...</p>
              <p className="text-sm text-slate-400">Extracting text, building vector index</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${dragging ? 'bg-blue-100' : 'bg-slate-100'}`}>
                <Upload className={`w-7 h-7 ${dragging ? 'text-blue-500' : 'text-slate-400'}`} />
              </div>
              <div>
                <p className="font-semibold text-slate-700 mb-1">
                  {dragging ? 'Drop your PDF here' : 'Drag & drop your PDF'}
                </p>
                <p className="text-sm text-slate-400">or click to browse — max 50MB</p>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-6">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Features */}
        <div className="grid grid-cols-3 gap-3 mb-10">
          {[
            { icon: Search, label: 'Semantic Search', desc: 'FAISS vector store', color: 'text-blue-500 bg-blue-50' },
            { icon: Brain, label: 'Llama3-70b', desc: 'Groq-powered answers', color: 'text-purple-500 bg-purple-50' },
            { icon: Zap, label: 'Instant Results', desc: 'RAG pipeline', color: 'text-amber-500 bg-amber-50' },
          ].map(f => (
            <div key={f.label} className="card p-4 text-center">
              <div className={`w-8 h-8 ${f.color} rounded-lg flex items-center justify-center mx-auto mb-2`}>
                <f.icon className="w-4 h-4" />
              </div>
              <div className="text-xs font-semibold text-slate-900">{f.label}</div>
              <div className="text-xs text-slate-400">{f.desc}</div>
            </div>
          ))}
        </div>

        {/* Recent documents */}
        {documents.length > 0 && (
          <div className="card p-5">
            <h3 className="font-semibold text-slate-900 text-sm mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-500" />
              Recent Documents
            </h3>
            <div className="space-y-2">
              {documents.map(doc => (
                <div key={doc.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors group">
                  <div className="flex items-center gap-3 cursor-pointer flex-1"
                    onClick={() => navigate(`/chat?doc=${doc.id}&name=${encodeURIComponent(doc.filename)}`)}>
                    <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-red-500" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-900 truncate max-w-xs">{doc.filename}</div>
                      <div className="text-xs text-slate-400">
                        {doc.page_count} pages · {doc.chunk_count} chunks · {format(new Date(doc.uploaded_at), 'MMM d, h:mm a')}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    <button onClick={() => handleDelete(doc)}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
