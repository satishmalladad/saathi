# 🧠 Saathi AI — Document Intelligence Platform

> Upload any document. Chat, summarize, study, and listen — all powered by AI.

![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.18-000000?style=flat&logo=express)
![Groq](https://img.shields.io/badge/Groq-LLaMA3-FF6B35?style=flat)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat)

---

## What is Saathi?

Saathi is an AI-powered document intelligence platform that transforms how you interact with your documents. Upload any PDF or text file and instantly chat with it using RAG (Retrieval-Augmented Generation) technology — every answer comes with exact page citations so you always know where the information came from.

---

## Features

| Feature | Description |
|---|---|
| 💬 **Chat with Citations** | Ask anything, get answers with exact page references |
| 📝 **Smart Summary** | Short, detailed, or bullet point summaries |
| 🃏 **Flashcards** | Auto-generated study cards with difficulty ratings |
| 🎙️ **Podcast Mode** | Convert your document into a 2-host audio conversation |
| 🎓 **Exam Mode** | MCQ and short answer questions with AI evaluation |
| ⚡ **Multi-Doc Chat** | Chat across multiple documents simultaneously |
| 📊 **Compare Docs** | AI-powered side-by-side document comparison |
| 🌙 **Dark / Light Mode** | Full theme switching |

---

## Tech Stack

**Frontend**
- Vanilla HTML, CSS, JavaScript
- No frameworks — pure and fast

**Backend**
- Node.js + Express
- Groq API (LLaMA3-70B)
- pdf-parse for PDF extraction
- bcryptjs + JWT for authentication
- In-memory vector store for RAG

---

## Getting Started

### Prerequisites
- Node.js 18+
- Groq API key → [console.groq.com](https://console.groq.com) (free)

### Installation

```bash
# 1. Clone the repo
git clone https://github.com/satishnm0204/saathi.git
cd saathi/backend

# 2. Install dependencies
npm install

# 3. Create your .env file
cp .env.example .env
```

### Configure .env

```env
GROQ_API_KEY=gsk_your_key_here
JWT_SECRET=your_random_secret_here
PORT=3001
NODE_ENV=development
```

### Run

```bash
npm run dev
```

Open → `http://localhost:3001`

---

## Project Structure

```
saathi/
├── frontend/
│   ├── index.html        # Main app
│   ├── login.html        # Auth page
│   ├── style.css         # Design system
│   └── app.js            # App logic
│
└── backend/
    ├── server.js         # Entry point
    ├── routes/           # API endpoints
    ├── services/         # Groq AI + document processing
    ├── middleware/       # JWT auth guard
    ├── utils/            # Chunker, store, user store
    └── vectorStore/      # In-memory RAG store
```

---

## How RAG Works in Saathi

```
Upload PDF
    ↓
Extract text (pdf-parse)
    ↓
Split into chunks (13 chunks for a 5-page doc)
    ↓
Generate embeddings (TF-IDF + FNV-1a hash)
    ↓
Store in memory

User asks a question
    ↓
Embed the query
    ↓
Find top matching chunks (cosine similarity)
    ↓
Send chunks + question to LLaMA3-70B
    ↓
Answer with page citations
```

---

## Security

- Passwords hashed with **bcrypt** (10 rounds)
- **JWT tokens** — 7 day expiry, verified on every request
- Rate limiting on login — 10 attempts per 15 minutes
- All routes protected except `/api/auth/*`
- `.env` keys never exposed to frontend

---

## Screenshots

> Chat with citations, flashcards with difficulty ratings, smart summaries, podcast mode

---


*Saathi means "companion" in Hindi.*
