# PDF-RAG-OLLAMA

> **PDF Retrieval-Augmented Generation (RAG)** using Ollama embeddings + Qdrant + BullMQ. An Express backend (file upload + chat API) and a Worker that ingests PDFs, splits them, generates embeddings with Ollama, stores vectors in Qdrant, and serves a small Next.js frontend for chat.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Key Features](#key-features)
3. [Architecture & Workflow](#architecture--workflow)
4. [Prerequisites](#prerequisites)
5. [Environment Variables](#environment-variables)
6. [Local Setup (Quickstart)](#local-setup-quickstart)
7. [Docker Compose (optional)](#docker-compose-optional)
8. [API Endpoints](#api-endpoints)
9. [How the RAG Pipeline Works (step-by-step)](#how-the-rag-pipeline-works-step-by-step)


---

## Project Overview

This repository implements a simple, production-friendly pipeline to turn PDFs into a searchable vector DB and answer questions against the content using an LLM (via Ollama). The system is split into:

* **Express Backend** — file upload endpoint and chat endpoint.
* **BullMQ Worker** — background job that processes uploaded PDFs, creates embeddings, and stores them in Qdrant.
* **Qdrant** — vector store for similarity search.
* **Ollama** — generates embeddings (embed model) and performs generation (LLM model).
* **Next.js Frontend** — (you mentioned you use it) to upload files and chat.

## Key Features

* Asynchronous PDF ingestion using Redis + BullMQ
* PDF text extraction and chunking with `PDFLoader` and `RecursiveCharacterTextSplitter`
* Embeddings with Ollama (`nomic-embed-text` by default)
* Vector storage and similarity search in Qdrant
* A simple chat endpoint that constructs a structured prompt and expects JSON output from the model

## Architecture & Workflow

High-level components:

```
User (browser)  ->  Next.js frontend
   |                    |
   |  upload PDF         |  chat messages
   V                    V
Express Backend  <---->  Worker (BullMQ)  <--> Ollama (embeddings)
   |                          |
   | chat query               V
   V                     Qdrant (vector DB)
Ollama (LLM generate)
```

See the **How the RAG Pipeline Works** section below for a precise, ordered workflow.

## Prerequisites

* Node.js (>= 18 recommended)
* npm or yarn
* Docker (recommended for Qdrant / Redis / Ollama if not running locally)
* Qdrant instance
* Redis instance (BullMQ requires Redis)
* Ollama running locally (or remote endpoint)

## Environment Variables

Create a `.env` file in the root of the `backend` (or where you run the server and worker). These are the main variables used by the example code:

```
# Server
SERVER_PORT=8000
FRONTEND_ORIGIN=http://localhost:3000
UPLOAD_DIR=uploads

# Redis / BullMQ
REDIS_HOST=localhost
REDIS_PORT=6379

# Qdrant
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=langchain-ollama-docs

# Ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_EMBED_MODEL=nomic-embed-text

# Worker
BATCH_SIZE=100
```

Adjust values if you run services inside Docker or on separate hosts.

## Local Setup (Quickstart)

1. Clone the repo

```bash
git clone https://github.com/PiyushXTZ/PDF-RAG-OLLAMA.git
cd PDF-RAG-OLLAMA
```

2. Install dependencies for backend & worker (assumes same package.json or separate packages — adapt to your repo layout):

```bash
npm install
# or
yarn
```

3. Start Redis, Qdrant and Ollama. Use Docker Compose below or run each as you prefer.

4. Start the Express server:

```bash
# from backend folder
NODE_ENV=development node server.js
# or if using npm scripts
npm run dev
```

5. Start the Worker (same machine or separate process):

```bash
node worker.js
# or
npm run worker
```

6. Start your Next.js frontend (if you have one):

```bash
cd frontend
npm run dev
```

## Docker Compose (optional)

A simple `docker-compose.yml` you can adapt to run Qdrant and Redis quickly:

```yaml
version: '3.8'
services:
  qdrant:
    image: qdrant/qdrant:latest
    restart: unless-stopped
    ports:
      - "6333:6333"
    volumes:
      - ./qdrant_storage:/qdrant/storage

  redis:
    image: redis:7
    ports:
      - "6379:6379"
    command: ["redis-server", "--save", "", "--appendonly", "no"]

  # Optional: run Ollama in Docker if you have an image or use local install
  # ollama:
  #   image: <ollama-image>
  #   ports:
  #     - "11434:11434"
```

> NOTE: Ollama commonly runs as a local binary; see Ollama docs for the exact method you use.

## API Endpoints

### `POST /upload/pdf`

* Form-data: `pdf` — file to upload.
* Returns queue jobId and confirmation.

Example (curl):

```bash
curl -X POST http://localhost:8000/upload/pdf \
  -F "pdf=@/path/to/file.pdf"
```

### `GET /chat?message=...`

* Query param `message` — user question
* Server searches Qdrant for similar documents, builds a prompt and calls Ollama generate API, expecting a JSON output (see the system prompt in code).

Example:

```bash
curl "http://localhost:8000/chat?message=What%20does%20the%20doc%20say%20about%20X"
```

Response shape (example):

```json
{
  "answer": { "headings": ["..."], "summary": "...", "keywords": ["..."] },
  "context": [ ...similar doc objects... ],
  "topics": [ ...]
}
```

## How the RAG Pipeline Works (step-by-step)

This is the core workflow you asked for — keep this section in the README so contributors and maintainers can quickly understand and reproduce the pipeline.

1. **User upload via frontend**: The Next.js frontend sends the PDF via `multipart/form-data` to `POST /upload/pdf`.
2. **Express receives and stores**: `multer` stores the file in the `UPLOAD_DIR`. The server enqueues a job to BullMQ with the file path.
3. **Job enters Redis queue**: BullMQ stores the job in Redis, making it available to workers.
4. **Worker picks up job**: The `Worker` (separate process) receives the job and reads the file path.
5. **PDF extraction**: Worker uses `PDFLoader` from LangChain to extract text from the PDF into `rawDocs`.
6. **Chunking**: Text is split with `RecursiveCharacterTextSplitter` into manageable chunks (default chunkSize 1000, overlap 200).
7. **Embeddings**: Each chunk gets an embedding using `OllamaEmbeddings` (model: `nomic-embed-text`).
8. **Upsert to Qdrant**: Embeddings (with metadata including original page, source) are uploaded to Qdrant, usually in batches controlled by `BATCH_SIZE`.
9. **Cleanup**: After successful vectorization, the uploaded PDF file is deleted from disk.
10. **Chat flow**: When a user asks a question, the server queries Qdrant (`similaritySearch`) for top-k matching chunks to build `CONTEXT` and `TOPIC DOCS`.
11. **Model generation**: The server calls the Ollama `generate` endpoint, providing the system prompt and the constructed prompt. The server expects a JSON response per your `STRUCTURED_QA_SYSTEM_PROMPT`.
12. **Return structured answer**: The server parses the model output into JSON and returns it along with the retrieved contexts.
