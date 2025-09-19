
import { Worker } from "bullmq";
import fs from "fs";

import { OllamaEmbeddings } from "@langchain/community/embeddings/ollama";
import { QdrantVectorStore } from "@langchain/qdrant";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = process.env.REDIS_PORT || 6379;
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text";
const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6333";
const QDRANT_COLLECTION = process.env.QDRANT_COLLECTION || "langchain-ollama-docs";

const BATCH_SIZE = Number(process.env.BATCH_SIZE || 100);

const worker = new Worker(
  "file-upload-queue",
  async (job) => {
    console.log("Worker: processing", job.data.path);
    try {
      const loader = new PDFLoader(job.data.path);
      const rawDocs = await loader.load();
      const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 200 });
      const docs = await splitter.splitDocuments(rawDocs);

      const embeddings = new OllamaEmbeddings({ model: OLLAMA_EMBED_MODEL, baseUrl: OLLAMA_BASE_URL });

      for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const batch = docs.slice(i, i + BATCH_SIZE);
        await QdrantVectorStore.fromDocuments(batch, embeddings, { url: QDRANT_URL, collectionName: QDRANT_COLLECTION });
      }

      // remove file
      try { fs.unlinkSync(job.data.path); } catch (e) { /* ignore */ }
      console.log("Worker: done");
    } catch (err) {
      console.error("Worker error:", err);
      throw err;
    }
  },
  {
    concurrency: 3,
    connection: { host: REDIS_HOST, port: Number(REDIS_PORT) },
  }
);

console.log("Worker started");
