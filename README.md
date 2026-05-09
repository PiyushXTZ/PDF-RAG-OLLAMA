# PDF-RAG-OLLAMA

> **PDF Retrieval-Augmented Generation (RAG)** using Ollama embeddings + Qdrant + BullMQ.  
> An Express backend (file upload + chat API) and a Worker that ingests PDFs, splits them, generates embeddings with Ollama, stores vectors in Qdrant, and serves a Next.js frontend for chat.

---

# Table of Contents

1. [Project Overview](#project-overview)
2. [Key Features](#key-features)
3. [Architecture & Workflow](#architecture--workflow)
4. [Updated Containerized Architecture](#updated-containerized-architecture)
5. [Prerequisites](#prerequisites)
6. [Additional Requirements for Docker Setup](#additional-requirements-for-docker-setup)
7. [Environment Variables](#environment-variables)
8. [Local Setup (Quickstart)](#local-setup-quickstart)
9. [Docker Compose Setup](#docker-compose-setup)
10. [DevOps Features](#devops-features)
11. [Ollama Configuration](#ollama-configuration)
12. [API Endpoints](#api-endpoints)
13. [How the RAG Pipeline Works](#how-the-rag-pipeline-works-step-by-step)

---

# Project Overview

This repository implements a production-friendly pipeline to turn PDFs into a searchable vector database and answer questions against the content using a local LLM via Ollama.

The system is split into:

- **Next.js Frontend** — upload PDFs and chat with documents
- **Express Backend** — upload + chat API
- **BullMQ Worker** — background PDF ingestion + embedding generation
- **Redis** — queue broker for asynchronous jobs
- **Qdrant** — vector database for similarity search
- **Ollama** — local embedding + generation models

---

# Key Features

- Asynchronous PDF ingestion using Redis + BullMQ
- PDF text extraction and chunking
- Embeddings using Ollama (`nomic-embed-text`)
- Vector similarity search using Qdrant
- Local LLM responses using `llama3.2`
- Structured JSON responses
- Dockerized multi-container architecture
- CI/CD pipeline using GitHub Actions

---

# Architecture & Workflow

```text
User Uploads PDF
        ↓
Frontend (Next.js)
        ↓
Backend API (Express.js)
        ↓
Redis Queue (BullMQ)
        ↓
Worker Service
        ↓
PDF Extraction + Chunking
        ↓
Ollama Embeddings
        ↓
Qdrant Vector DB
```

---

# Updated Containerized Architecture

```text
Browser
   ↓
Frontend Container (Next.js)
   ↓
Backend Container (Express API)
   ↓
Redis Container (BullMQ Queue)
   ↓
Worker Container (PDF Processing)
   ↓
Qdrant Container (Vector Database)
   ↓
Ollama Running on Host Machine
```

## Internal Communication

- Frontend communicates with Backend
- Backend pushes jobs to Redis queue
- Worker consumes jobs from Redis
- Worker generates embeddings using Ollama
- Worker stores vectors inside Qdrant
- Backend retrieves relevant vectors during chat queries

---

# Prerequisites

- Node.js >= 18
- npm or pnpm
- Docker Desktop
- Docker Compose
- Ollama installed locally
- Redis
- Qdrant

---

# Additional Requirements for Docker Setup

- Docker Desktop running
- Ollama installed on host machine
- NVIDIA GPU optional (recommended for faster inference)

---

# Environment Variables

## Backend / Worker

```env
SERVER_PORT=8000

REDIS_HOST=redis
REDIS_PORT=6379

QDRANT_URL=http://qdrant:6333
QDRANT_COLLECTION=langchain-ollama-docs

OLLAMA_BASE_URL=http://host.docker.internal:11434
OLLAMA_EMBED_MODEL=nomic-embed-text
```

---

# Local Setup (Quickstart)

## Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/PDF-RAG-OLLAMA.git

cd PDF-RAG-OLLAMA
```

---

## Install Backend Dependencies

```bash
cd server
npm install --legacy-peer-deps
```

---

## Install Frontend Dependencies

```bash
cd pdfrag
npm install --legacy-peer-deps
```

---

## Start Ollama

```bash
ollama run llama3.2
```

---

## Start Backend

```bash
cd server
npm run dev
```

---

## Start Worker

```bash
cd server
npm run dev:worker
```

---

## Start Frontend

```bash
cd pdfrag
npm run dev
```

---

# Docker Compose Setup

## Run Entire Stack

```bash
docker compose up --build
```

---

## Stop Stack

```bash
docker compose down
```

---

# Dockerized Services

| Service | Purpose |
|---|---|
| frontend | Next.js frontend |
| backend | Express API |
| worker | PDF processing worker |
| redis | Queue broker |
| qdrant | Vector database |

---

# Docker Features Implemented

- Multi-container orchestration
- Shared Docker volumes
- Persistent vector database storage
- Internal container networking
- Optimized Docker images using Alpine Linux
- `.dockerignore` optimization
- Shared image layers
- Queue-based async architecture

---

# DevOps Features

## CI/CD Pipeline

GitHub Actions is used for Continuous Integration.

Pipeline tasks:
- Install dependencies
- Validate builds
- Build frontend
- Build Docker containers

Workflow location:

```text
.github/workflows/ci.yml
```

---

## Docker Optimizations

Implemented optimizations:

- `node:20-alpine`
- Docker layer caching
- `.dockerignore`
- Shared volumes
- Shared image layers

---

## Queue-Based Architecture

BullMQ + Redis enable asynchronous PDF processing.

Benefits:
- responsive uploads
- scalable workers
- background embedding generation
- improved reliability

---

## Scalability

Architecture supports:
- multiple workers
- container scaling
- distributed services
- persistent vector storage

---

# Ollama Configuration

Ollama runs on the host machine and is accessed from Docker containers using:

```text
http://host.docker.internal:11434
```

## Recommended Models

### Generation Model

```bash
llama3.2
```

### Embedding Model

```bash
nomic-embed-text
```

---

# API Endpoints

# Upload PDF

## POST `/upload/pdf`

Upload PDF using multipart form-data.

### Example

```bash
curl -X POST http://localhost:8000/upload/pdf \
  -F "pdf=@/path/to/file.pdf"
```

---

# Chat Endpoint

## GET `/chat?message=...`

Query uploaded documents.

### Example

```bash
curl "http://localhost:8000/chat?message=Explain HTTP protocol"
```

---

# Example Response

```json
{
  "success": true,
  "answer": {
    "overview": "...",
    "explanation": "...",
    "characteristics": [],
    "examples": [],
    "summary": "..."
  }
}
```

---

# How the RAG Pipeline Works (step-by-step)

1. User uploads PDF from frontend
2. Backend receives file using Multer
3. Backend pushes job into BullMQ queue
4. Redis stores queued job
5. Worker consumes job
6. PDFLoader extracts text
7. Text is chunked using RecursiveCharacterTextSplitter
8. Ollama generates embeddings
9. Embeddings are stored inside Qdrant
10. User sends chat query
11. Backend performs similarity search
12. Relevant chunks are added to prompt
13. Ollama generates structured JSON response
14. Backend returns answer to frontend

---

# Technologies Used

## Frontend

- Next.js
- React
- TailwindCSS

## Backend

- Express.js
- BullMQ
- Multer
- Axios

## AI / RAG

- Ollama
- LangChain
- Qdrant
- PDFLoader

## DevOps

- Docker
- Docker Compose
- GitHub Actions

---

# Future Improvements

- OCR support for image-based PDFs
- Authentication system
- Streaming responses
- Kubernetes deployment
- Monitoring with Prometheus + Grafana
- Nginx reverse proxy

---

# License

MIT License
