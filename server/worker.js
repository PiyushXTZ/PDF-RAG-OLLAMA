import { Worker } from "bullmq";
import fs from "fs";

import { OllamaEmbeddings } from "@langchain/community/embeddings/ollama";
import { QdrantVectorStore } from "@langchain/qdrant";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = process.env.REDIS_PORT || 6379;

const OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL || "http://localhost:11434";

const OLLAMA_EMBED_MODEL =
  process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text";

const QDRANT_URL =
  process.env.QDRANT_URL || "http://localhost:6333";

const QDRANT_COLLECTION =
  process.env.QDRANT_COLLECTION || "langchain-ollama-docs";

const worker = new Worker(
  "file-upload-queue",
  async (job) => {
    console.log("=================================");
    console.log("Worker: processing", job.data.path);

    try {
      // Load PDF
      const loader = new PDFLoader(job.data.path);
      const rawDocs = await loader.load();

      console.log("PDF pages loaded:", rawDocs.length);

      // Split into chunks
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
      });

      const docs = await splitter.splitDocuments(rawDocs);

      console.log("Chunks created:", docs.length);

      // Embedding model
      const embeddings = new OllamaEmbeddings({
        model: OLLAMA_EMBED_MODEL,
        baseUrl: OLLAMA_BASE_URL,
      });

      console.log("Creating embeddings + uploading to Qdrant...");

      // Upload to Qdrant
      await QdrantVectorStore.fromDocuments(
        docs,
        embeddings,
        {
          url: QDRANT_URL,
          collectionName: QDRANT_COLLECTION,
        }
      );

      console.log("Upload successful");

      // Delete uploaded PDF
      try {
        fs.unlinkSync(job.data.path);
        console.log("Uploaded file deleted");
      } catch (e) {
        console.log("Could not delete uploaded file");
      }

      console.log("Worker: done");
      console.log("=================================");
    } catch (err) {
      console.error("=================================");
      console.error("Worker error:", err);
      console.error("=================================");
      throw err;
    }
  },
  {
    concurrency: 3,
    connection: {
      host: REDIS_HOST,
      port: Number(REDIS_PORT),
    },
  }
);

console.log("Worker started");