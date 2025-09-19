
import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import { Queue } from "bullmq";
import axios from "axios";

import { OllamaEmbeddings } from "@langchain/community/embeddings/ollama";
import { QdrantVectorStore } from "@langchain/qdrant";

const PORT = process.env.SERVER_PORT || 8000;
const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = process.env.REDIS_PORT || 6379;
const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6333";
const QDRANT_COLLECTION = process.env.QDRANT_COLLECTION || "langchain-ollama-docs";
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text";

const app = express();
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || "http://localhost:3000" }));
app.use(express.json());

// uploads dir
const UPLOAD_DIR = process.env.UPLOAD_DIR || "uploads";
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

// BullMQ queue
const fileQueue = new Queue("file-upload-queue", { connection: { host: REDIS_HOST, port: Number(REDIS_PORT) } });

// LangChain vector store (embeddings)
const embeddings = new OllamaEmbeddings({ model: OLLAMA_EMBED_MODEL, baseUrl: OLLAMA_BASE_URL });
const vectorStore = new QdrantVectorStore(embeddings, { url: QDRANT_URL, collectionName: QDRANT_COLLECTION });

// Simple system prompt (kept from you)
const STRUCTURED_QA_SYSTEM_PROMPT = `
You are a strict assistant for question-answering tasks.
Use ONLY the information inside CONTEXT to answer the QUESTION.

Return your answer as a valid JSON object matching this schema:
{ "headings": [...], "summary": "string", "keywords": ["string"] }

If any part cannot be answered from CONTEXT, return:
{ "error": "I cannot find the answer in the document." }
`;

// upload endpoint
app.post("/upload/pdf", upload.single("pdf"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file provided." });
  const absolutePath = path.resolve(req.file.path);
  try {
    const job = await fileQueue.add("process-pdf", { path: absolutePath });
    return res.json({ message: "File uploaded and queued.", jobId: job.id });
  } catch (err) {
    console.error("enqueue error:", err);
    return res.status(500).json({ error: "Failed to enqueue job." });
  }
});

// chat endpoint (GET)
app.get("/chat", async (req, res) => {
  const userQuery = req.query.message;
  if (!userQuery) return res.status(400).json({ error: "Message query is required." });

  try {
    const contextDocs = (await vectorStore.similaritySearch(String(userQuery), 1)) || [];
    const topicDocs = (await vectorStore.similaritySearch(String(userQuery), 3)) || [];

    const context = contextDocs.map(d => d.pageContent).join("\n---\n");
    const topics = topicDocs.map(d => d.pageContent).join("\n---\n");

    const prompt = `CONTEXT:\n${context}\n\nTOPIC DOCS:\n${topics}\n\nQUESTION: ${userQuery}\n\nANSWER JSON:`;

    const url = `${OLLAMA_BASE_URL.replace(/\/$/, "")}/api/generate`;
    const resp = await axios.post(url, { model: "llama3", system: STRUCTURED_QA_SYSTEM_PROMPT, prompt, stream: false }, { timeout: 60000  });

    // try best-effort parse
    let modelText = "";
    if (resp?.data) {
      modelText = typeof resp.data === "string" ? resp.data : (resp.data.response || JSON.stringify(resp.data));
    }

    let answer;
    try {
      answer = JSON.parse(modelText);
    } catch (e) {
      answer = { error: "Model did not return valid JSON.", raw: modelText };
    }

    res.json({ answer, context: contextDocs, topics: topicDocs });
  } catch (err) {
    console.error("chat error:", err);
    res.status(500).json({ error: "Chat failed", detail: String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
