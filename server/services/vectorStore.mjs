// server/services/vectorStore.mjs

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { pipeline } from '@xenova/transformers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dbPath = path.join(__dirname, '../../data/vectors.db');
const db = new Database(dbPath);

// Create table if needed
db.exec(`
  CREATE TABLE IF NOT EXISTS document_chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    embedding TEXT NOT NULL,
    source_file TEXT,
    section TEXT,
    page_number INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

let embeddingPipeline = null;

export async function generateEmbedding(text) {
  if (!embeddingPipeline) {
    embeddingPipeline = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2'
    );
  }

  const output = await embeddingPipeline(text, {
    pooling: 'mean',
    normalize: true
  });

  return Array.from(output.data);
}

export async function storeChunk(content, sourceFile, section = null, pageNumber = null) {
  const embedding = await generateEmbedding(content);

  const stmt = db.prepare(`
    INSERT INTO document_chunks (content, embedding, source_file, section, page_number)
    VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run(
    content,
    JSON.stringify(embedding),
    sourceFile,
    section,
    pageNumber
  );
}

function cosineSimilarity(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export async function searchSimilarChunks(query, topK = 5) {
  const queryEmbedding = await generateEmbedding(query);
  const rows = db.prepare('SELECT * FROM document_chunks').all();

  const scored = rows.map(row => ({
    ...row,
    similarity: cosineSimilarity(queryEmbedding, JSON.parse(row.embedding))
  }));

  scored.sort((a, b) => b.similarity - a.similarity);

  return scored.slice(0, topK);
}

export function getChunkCount() {
  const row = db.prepare('SELECT COUNT(*) AS c FROM document_chunks').get();
  return row.c;
}
