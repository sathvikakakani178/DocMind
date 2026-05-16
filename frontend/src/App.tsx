import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import UploadPage from './pages/Upload'
import ChatPage from './pages/Chat'
import HistoryPage from './pages/History'

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<UploadPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/history" element={<HistoryPage />} />
      </Routes>
    </BrowserRouter>
  )
}
