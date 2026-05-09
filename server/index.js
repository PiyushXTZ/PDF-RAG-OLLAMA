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

const REDIS_HOST = process.env.REDIS_HOST || "redis";
const REDIS_PORT = process.env.REDIS_PORT || 6379;

const QDRANT_URL = process.env.QDRANT_URL || "http://qdrant:6333";

const QDRANT_COLLECTION =
  process.env.QDRANT_COLLECTION || "langchain-ollama-docs";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://host.docker.internal:11434";

const OLLAMA_EMBED_MODEL =
  process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text";

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || "http://localhost:3000",
  })
);

app.use(express.json());

/* =========================================
   Uploads Directory
========================================= */

const UPLOAD_DIR = process.env.UPLOAD_DIR || "uploads";

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/* =========================================
   Multer Setup
========================================= */

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

/* =========================================
   BullMQ Queue
========================================= */

const fileQueue = new Queue("file-upload-queue", {
  connection: {
    host: REDIS_HOST,
    port: Number(REDIS_PORT),
  },
});

/* =========================================
   Embeddings + Vector Store
========================================= */

const embeddings = new OllamaEmbeddings({
  model: OLLAMA_EMBED_MODEL,
  baseUrl: OLLAMA_BASE_URL,
});

const vectorStore = new QdrantVectorStore(embeddings, {
  url: QDRANT_URL,
  collectionName: QDRANT_COLLECTION,
  checkCompatibility: false,
});

/* =========================================
   System Prompt
========================================= */

const STRUCTURED_QA_SYSTEM_PROMPT = `
You are an expert teaching assistant that answers questions using ONLY the provided context from documents.

Your goal is to give thorough, well-structured, and educational answers — like a professor explaining to a student.

Rules:
- Use ONLY information from the CONTEXT provided. Do not hallucinate or add outside knowledge.
- If the answer cannot be found in the context, return: { "error": "I cannot find the answer in the provided document." }
- You MUST return ONLY valid JSON. No markdown, no backticks, no extra text before or after the JSON.
- All string values must be properly escaped. Use \\n to represent newlines inside strings.

Return exactly this JSON structure:

{
  "overview": "A clear 2-4 sentence introduction explaining the topic at a high level.",
  "explanation": "A detailed multi-paragraph explanation. Separate paragraphs with \\n\\n.",
  "characteristics": [
    { "title": "Characteristic name", "detail": "Detailed explanation of this characteristic." }
  ],
  "howItWorks": "Step-by-step or conceptual explanation of how it works. Separate paragraphs with \\n\\n.",
  "examples": [
    { "name": "Example name", "description": "How this example illustrates the concept." }
  ],
  "keyTerms": [
    { "term": "Term", "definition": "Definition from the context." }
  ],
  "limitations": "Any limitations, trade-offs, or caveats mentioned in the document. Empty string if none.",
  "summary": "A concise 1-2 sentence takeaway."
}

If a field has no relevant information in the context, use an empty string "" or empty array [].
Do NOT include any text outside the JSON object.
`;

/* =========================================
   JSON Parser Helper
========================================= */

// Tries to close a truncated JSON string by counting open braces/brackets
function repairTruncatedJSON(str) {
  const stack = [];
  let inString = false;
  let escape = false;

  for (const ch of str) {
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{' || ch === '[') stack.push(ch === '{' ? '}' : ']');
    if (ch === '}' || ch === ']') stack.pop();
  }

  // Close any unclosed string first
  let repaired = str;
  if (inString) repaired += '"';

  // Remove trailing comma before we close
  repaired = repaired.replace(/,\s*$/, '');

  // Close all open structures in reverse
  return repaired + stack.reverse().join('');
}

// After parsing, normalize fields the model sometimes gets wrong
function normalizeAnswer(obj) {
  // keyTerms: model sometimes returns {} instead of []
  if (obj.keyTerms && !Array.isArray(obj.keyTerms)) {
    obj.keyTerms = Object.entries(obj.keyTerms).map(([term, definition]) => ({
      term,
      definition: String(definition),
    }));
  }

  // characteristics: ensure array of {title, detail}
  if (obj.characteristics && !Array.isArray(obj.characteristics)) {
    obj.characteristics = [];
  }

  // examples: ensure array of {name, description}
  if (obj.examples && !Array.isArray(obj.examples)) {
    obj.examples = [];
  }

  // ensure string fields are strings
  ['overview', 'explanation', 'howItWorks', 'limitations', 'summary'].forEach((key) => {
    if (obj[key] && typeof obj[key] !== 'string') {
      obj[key] = String(obj[key]);
    }
  });

  return obj;
}

function safeParseJSON(raw) {
  const base = raw
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "") // bad control chars
    .trim();

  // Attempt 1: slice from first { to last } and parse directly
  try {
    const start = base.indexOf("{");
    const end = base.lastIndexOf("}");
    if (start !== -1 && end !== -1) {
      const sliced = base.slice(start, end + 1)
        .replace(/,\s*}/g, "}")
        .replace(/,\s*]/g, "]");
      return normalizeAnswer(JSON.parse(sliced));
    }
  } catch (err1) {
    console.warn("Attempt 1 failed:", err1.message);
  }

  // Attempt 2: JSON is truncated — repair by closing open structures
  try {
    const start = base.indexOf("{");
    if (start !== -1) {
      const partial = base.slice(start)
        .replace(/,\s*}/g, "}")
        .replace(/,\s*]/g, "]");
      const repaired = repairTruncatedJSON(partial);
      console.log("Repaired JSON attempt:", repaired.slice(-100)); // log tail
      return normalizeAnswer(JSON.parse(repaired));
    }
  } catch (err2) {
    console.warn("Attempt 2 (repair) failed:", err2.message);
  }

  // Attempt 3: fix bare unescaped newlines inside strings then repair
  try {
    let fixed = "";
    let inStr = false;
    let esc = false;
    for (const ch of base) {
      if (esc) { fixed += ch; esc = false; continue; }
      if (ch === '\\') { fixed += ch; esc = true; continue; }
      if (ch === '"') { inStr = !inStr; fixed += ch; continue; }
      if (inStr && ch === '\n') { fixed += '\\n'; continue; }
      if (inStr && ch === '\r') { fixed += '\\r'; continue; }
      fixed += ch;
    }
    const start = fixed.indexOf("{");
    if (start !== -1) {
      const partial = fixed.slice(start)
        .replace(/,\s*}/g, "}")
        .replace(/,\s*]/g, "]");
      const repaired = repairTruncatedJSON(partial);
      return normalizeAnswer(JSON.parse(repaired));
    }
  } catch (err3) {
    console.warn("Attempt 3 (escape+repair) failed:", err3.message);
    }
    return null;}
/* =========================================
   Upload Endpoint
========================================= */

app.post("/upload/pdf", upload.single("pdf"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No PDF uploaded" });
  }

  try {
    const absolutePath = path.resolve(req.file.path);

    const job = await fileQueue.add("process-pdf", {
      path: absolutePath,
    });

    return res.json({
      success: true,
      message: "PDF uploaded successfully",
      jobId: job.id,
    });
  } catch (err) {
    console.error("Queue Error:", err);
    return res.status(500).json({ error: "Failed to enqueue PDF" });
  }
});

/* =========================================
   Chat Endpoint
========================================= */

app.get("/chat", async (req, res) => {
  try {
    const userQuery = req.query.message;

    if (!userQuery) {
      return res.status(400).json({ error: "message query required" });
    }

    console.log("=================================");
    console.log("User Query:", userQuery);

    /* ================================
       Similarity Search
    ================================= */

    const contextDocs =
      (await vectorStore.similaritySearch(String(userQuery), 3)) || [];

    const topicDocs =
      (await vectorStore.similaritySearch(String(userQuery), 6)) || [];

    console.log("Context Docs:", contextDocs.length);
    console.log("Topic Docs:", topicDocs.length);

    // Deduplicate by id
    const allDocsMap = new Map();
    [...contextDocs, ...topicDocs].forEach((doc) => {
      if (doc.id) allDocsMap.set(doc.id, doc);
    });
    const allDocs = [...allDocsMap.values()];

    const context = contextDocs.map((doc) => doc.pageContent).join("\n---\n");
    const topics = topicDocs.map((doc) => doc.pageContent).join("\n---\n");

    /* ================================
       Prompt
    ================================= */

    const prompt = `
CONTEXT FROM DOCUMENT:
${context}

ADDITIONAL RELATED PASSAGES:
${topics}

STUDENT'S QUESTION:
${userQuery}

Instructions:
- Answer the question thoroughly using ONLY the context above.
- The "explanation" field should be detailed and multi-paragraph for questions asking for depth.
- The "characteristics" array should list every distinct property or feature mentioned in the context.
- Extract real examples from the context for the "examples" array (e.g. HTTP, RPC, UDP, CORBA, XML).
- Define all technical terms found in the context in "keyTerms".
- Use \\n\\n to separate paragraphs inside string values.
- Return ONLY the JSON object. No extra text, no markdown, no backticks.

ANSWER:
`;

    /* ================================
       Ollama Request
    ================================= */

    const url = `${OLLAMA_BASE_URL.replace(/\/$/, "")}/api/generate`;

    console.log("Sending request to Ollama...");

    const resp = await axios.post(
      url,
      {
        model: "llama3.2",
        system: STRUCTURED_QA_SYSTEM_PROMPT,
        prompt,
        stream: false,
        options: {
          temperature: 0.1,  // low temp = more consistent JSON output
          num_predict: 4096, // llama3.2 can handle more tokens cleanly
        },
      },
      { timeout: 120000 }
    );

    /* ================================
       Extract Model Response
    ================================= */

    let modelText = "";

    if (resp?.data) {
      modelText =
        typeof resp.data === "string"
          ? resp.data
          : resp.data.response || JSON.stringify(resp.data);
    }

    console.log("RAW MODEL RESPONSE:");
    console.log(modelText);
    console.log("=================================");

    /* ================================
       Parse JSON with Fallbacks
    ================================= */

    const answer = safeParseJSON(modelText);

    if (!answer) {
      console.error("All JSON parse attempts failed. Raw:", modelText);
      return res.json({
        success: true,
        answer: {
          error: "Model did not return valid JSON.",
          raw: modelText,
        },
        context: allDocs,
      });
    }

    return res.json({
      success: true,
      answer,
      context: allDocs,
    });

  } catch (err) {
    console.error("=================================");
    console.error("Chat Error:", err);
    console.error("=================================");

    return res.status(500).json({
      error: "Chat failed",
      detail: String(err),
    });
  }
});

/* =========================================
   Start Server
========================================= */

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});