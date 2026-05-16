import os
import uuid
import pickle
import numpy as np
from typing import Optional
from datetime import datetime

from dotenv import load_dotenv
load_dotenv()

import fitz  # PyMuPDF
from groq import Groq
from sentence_transformers import SentenceTransformer
import faiss

DOCUMENTS_DIR = "documents"
os.makedirs(DOCUMENTS_DIR, exist_ok=True)

# Load embedding model once
print("[RAGEngine] Loading embedding model...")
EMBED_MODEL = SentenceTransformer("all-MiniLM-L6-v2")
print("[RAGEngine] Embedding model loaded.")

GROQ_CLIENT = Groq(api_key=os.getenv("GROQ_API_KEY", ""))


class RAGEngine:
    def __init__(self):
        self.documents = {}  # In-memory store of document metadata + chunks
        self._load_existing()

    def _doc_path(self, doc_id: str) -> str:
        return os.path.join(DOCUMENTS_DIR, doc_id)

    def _load_existing(self):
        """Load existing documents from disk on startup."""
        if not os.path.exists(DOCUMENTS_DIR):
            return
        for doc_id in os.listdir(DOCUMENTS_DIR):
            meta_path = os.path.join(DOCUMENTS_DIR, doc_id, "meta.pkl")
            if os.path.exists(meta_path):
                with open(meta_path, "rb") as f:
                    self.documents[doc_id] = pickle.load(f)
        print(f"[RAGEngine] Loaded {len(self.documents)} existing documents.")

    def _save_meta(self, doc_id: str):
        path = os.path.join(self._doc_path(doc_id), "meta.pkl")
        with open(path, "wb") as f:
            pickle.dump(self.documents[doc_id], f)

    # ── PDF Extraction ────────────────────────────────────────────────────────

    def _extract_text(self, pdf_bytes: bytes) -> tuple[list[str], int]:
        """Extract text chunks from PDF bytes. Returns (chunks, page_count)."""
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        page_count = len(doc)
        chunks = []

        for page_num, page in enumerate(doc):
            text = page.get_text("text").strip()
            if not text:
                continue

            # Split into ~500 char chunks with 50 char overlap
            chunk_size = 500
            overlap = 50
            start = 0
            while start < len(text):
                end = start + chunk_size
                chunk = text[start:end].strip()
                if chunk:
                    chunks.append({
                        "content": chunk,
                        "page": page_num + 1,
                        "index": len(chunks),
                    })
                start = end - overlap if end < len(text) else end

        doc.close()
        return chunks, page_count

    # ── Vector Store ──────────────────────────────────────────────────────────

    def _build_index(self, chunks: list[dict]) -> tuple:
        """Build FAISS index from chunks."""
        texts = [c["content"] for c in chunks]
        embeddings = EMBED_MODEL.encode(texts, show_progress_bar=False)
        embeddings = np.array(embeddings).astype("float32")

        # Normalize for cosine similarity
        faiss.normalize_L2(embeddings)

        index = faiss.IndexFlatIP(embeddings.shape[1])
        index.add(embeddings)
        return index, embeddings

    def _search(self, doc_id: str, query: str, top_k: int = 5) -> list[dict]:
        """Search for relevant chunks."""
        doc = self.documents.get(doc_id)
        if not doc:
            return []

        index_path = os.path.join(self._doc_path(doc_id), "index.faiss")
        if not os.path.exists(index_path):
            return []

        index = faiss.read_index(index_path)
        query_emb = EMBED_MODEL.encode([query]).astype("float32")
        faiss.normalize_L2(query_emb)

        scores, indices = index.search(query_emb, top_k)
        chunks = doc["chunks"]

        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx < len(chunks) and score > 0.1:
                results.append({**chunks[idx], "score": float(score)})

        return results

    # ── Process Document ──────────────────────────────────────────────────────

    def process_document(self, pdf_bytes: bytes, filename: str) -> dict:
        """Process a PDF and build its vector index."""
        doc_id = uuid.uuid4().hex[:12]
        doc_dir = self._doc_path(doc_id)
        os.makedirs(doc_dir, exist_ok=True)

        print(f"[RAGEngine] Processing {filename}...")

        chunks, page_count = self._extract_text(pdf_bytes)

        if not chunks:
            return {"error": "No text could be extracted from this PDF."}

        index, _ = self._build_index(chunks)
        faiss.write_index(index, os.path.join(doc_dir, "index.faiss"))

        meta = {
            "id": doc_id,
            "filename": filename,
            "page_count": page_count,
            "chunk_count": len(chunks),
            "total_chars": sum(len(c["content"]) for c in chunks),
            "uploaded_at": datetime.utcnow().isoformat(),
            "chunks": chunks,
        }

        self.documents[doc_id] = meta
        self._save_meta(doc_id)

        print(f"[RAGEngine] Processed {filename}: {len(chunks)} chunks, {page_count} pages.")

        return {
            "document_id": doc_id,
            "filename": filename,
            "page_count": page_count,
            "chunk_count": len(chunks),
            "message": "Document processed successfully.",
        }

    # ── Answer Question ───────────────────────────────────────────────────────

    def answer_question(self, doc_id: str, question: str, chat_history: list = []) -> dict:
        """Answer a question using RAG."""
        if doc_id not in self.documents:
            return {"error": "Document not found. Please re-upload."}

        relevant_chunks = self._search(doc_id, question, top_k=5)

        if not relevant_chunks:
            context = "No relevant content found in the document."
        else:
            context = "\n\n---\n\n".join([
                f"[Page {c['page']}] {c['content']}"
                for c in relevant_chunks
            ])

        # Build messages
        messages = [
            {
                "role": "system",
                "content": (
                    "You are an expert document analyst. Answer questions based ONLY on the provided document context. "
                    "If the answer is not in the context, say so clearly. "
                    "Always cite the page number when possible. Be concise and accurate."
                )
            }
        ]

        # Add last 3 conversation turns for context
        for turn in chat_history[-6:]:
            messages.append(turn)

        messages.append({
            "role": "user",
            "content": f"Document Context:\n{context}\n\nQuestion: {question}"
        })

        try:
            response = GROQ_CLIENT.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=messages,
                temperature=0.2,
                max_tokens=1024,
            )
            answer = response.choices[0].message.content

            sources = [
                {"page": c["page"], "content": c["content"][:200] + "...", "score": round(c["score"], 3)}
                for c in relevant_chunks[:3]
            ]

            return {
                "answer": answer,
                "sources": sources,
                "chunks_used": len(relevant_chunks),
            }

        except Exception as e:
            return {"error": f"LLM error: {str(e)}"}

    # ── Summarize ─────────────────────────────────────────────────────────────

    def summarize_document(self, doc_id: str) -> dict:
        """Generate a comprehensive summary of the document."""
        if doc_id not in self.documents:
            return {"error": "Document not found."}

        doc = self.documents[doc_id]
        chunks = doc["chunks"]

        # Take evenly distributed chunks for summary
        sample_size = min(20, len(chunks))
        step = max(1, len(chunks) // sample_size)
        sample_chunks = [chunks[i]["content"] for i in range(0, len(chunks), step)][:sample_size]
        combined = "\n\n".join(sample_chunks)

        try:
            response = GROQ_CLIENT.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert document summarizer. Create a comprehensive, well-structured summary."
                    },
                    {
                        "role": "user",
                        "content": (
                            f"Summarize this document titled '{doc['filename']}'.\n\n"
                            f"Document content:\n{combined}\n\n"
                            "Provide:\n"
                            "1. Executive Summary (2-3 sentences)\n"
                            "2. Key Points (bullet points)\n"
                            "3. Main Topics Covered\n"
                            "4. Important Findings or Conclusions"
                        )
                    }
                ],
                temperature=0.3,
                max_tokens=1500,
            )
            summary = response.choices[0].message.content

            return {
                "summary": summary,
                "filename": doc["filename"],
                "page_count": doc["page_count"],
                "chunk_count": doc["chunk_count"],
            }

        except Exception as e:
            return {"error": f"Summary error: {str(e)}"}

    # ── Utilities ─────────────────────────────────────────────────────────────

    def get_document(self, doc_id: str) -> Optional[dict]:
        doc = self.documents.get(doc_id)
        if not doc:
            return None
        return {
            "id": doc["id"],
            "filename": doc["filename"],
            "page_count": doc["page_count"],
            "chunk_count": doc["chunk_count"],
            "uploaded_at": doc["uploaded_at"],
        }

    def delete_document(self, doc_id: str):
        import shutil
        if doc_id in self.documents:
            del self.documents[doc_id]
        doc_dir = self._doc_path(doc_id)
        if os.path.exists(doc_dir):
            shutil.rmtree(doc_dir)
