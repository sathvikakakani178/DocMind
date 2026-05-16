import { Link, useLocation } from 'react-router-dom'
import { FileText, MessageSquare, History, Upload } from 'lucide-react'

export default function Navbar() {
  const { pathname } = useLocation()

  const links = [
    { to: '/', label: 'Upload', icon: Upload },
    { to: '/chat', label: 'Chat', icon: MessageSquare },
    { to: '/history', label: 'History', icon: History },
  ]

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-100 shadow-sm">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <FileText className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-slate-900 text-sm">DocMind</span>
          <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">RAG</span>
        </Link>

        <div className="flex items-center gap-1">
          {links.map(l => (
            <Link key={l.to} to={l.to}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                pathname === l.to ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}>
              <l.icon className="w-3.5 h-3.5" />
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
}
