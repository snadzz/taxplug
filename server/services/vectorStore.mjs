import { createClient } from '@libsql/client';
import path from 'path';
import { fileURLToPath } from 'url';
import { pipeline } from '@xenova/transformers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '../../public/data/vectors.db');

const db = createClient({
  url: `file:${dbPath}`
});

// Create table if needed (Async via LibSQL)
await db.execute(`
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

  await db.execute({
    sql: `
      INSERT INTO document_chunks (content, embedding, source_file, section, page_number)
      VALUES (?, ?, ?, ?, ?)
    `,
    args: [
      content,
      JSON.stringify(embedding),
      sourceFile,
      section,
      pageNumber
    ]
  });
}

function cosineSimilarity(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export async function searchSimilarChunks(query, topK = 5) {
  const queryEmbedding = await generateEmbedding(query);
  
  const result = await db.execute('SELECT * FROM document_chunks');
  const rows = result.rows;

  const scored = rows.map(row => ({
    ...row,
    similarity: cosineSimilarity(queryEmbedding, JSON.parse(row.embedding))
  }));

  scored.sort((a, b) => b.similarity - a.similarity);

  return scored.slice(0, topK);
}

export async function getChunkCount() {
  const result = await db.execute('SELECT COUNT(*) AS c FROM document_chunks');
  return result.rows[0]?.c || 0;
}

export default db;
