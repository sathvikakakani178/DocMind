from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import uvicorn
import os

from rag_engine import RAGEngine

app = FastAPI(title="RAG Document Analyzer API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

rag = RAGEngine()

# ── Models ────────────────────────────────────────────────────────────────────

class QuestionRequest(BaseModel):
    document_id: str
    question: str
    chat_history: Optional[list] = []

class SummarizeRequest(BaseModel):
    document_id: str

# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "ok", "message": "RAG Document Analyzer API v1.0"}

@app.get("/health")
def health():
    return {"status": "healthy", "groq_configured": bool(os.getenv("GROQ_API_KEY"))}

@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    """Upload and process a PDF document."""
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    contents = await file.read()
    if len(contents) > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 50MB.")

    result = rag.process_document(contents, file.filename)
    return result

@app.post("/ask")
def ask_question(req: QuestionRequest):
    """Ask a question about a processed document."""
    result = rag.answer_question(req.document_id, req.question, req.chat_history)
    return result

@app.post("/summarize")
def summarize(req: SummarizeRequest):
    """Generate a summary of a processed document."""
    result = rag.summarize_document(req.document_id)
    return result

@app.get("/documents/{document_id}")
def get_document(document_id: str):
    """Get document metadata."""
    doc = rag.get_document(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    return doc

@app.delete("/documents/{document_id}")
def delete_document(document_id: str):
    """Delete a document and its vector store."""
    rag.delete_document(document_id)
    return {"message": "Document deleted successfully."}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
