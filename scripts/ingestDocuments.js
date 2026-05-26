// scripts/ingestDocuments.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Robust PDF extractor — zero ESM issues
import pdf from 'pdf-extraction';

import { storeChunk } from '../server/services/vectorStore.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = path.join(__dirname, '../documents');

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

// -------------------------------
// PDF TEXT EXTRACTION
// -------------------------------
async function extractTextFromPDF(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const result = await pdf(dataBuffer);
  return result.text;
}

// -------------------------------
// TEXT CHUNKING
// -------------------------------
function chunkText(text, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length);
    let chunk = text.slice(start, end);

    if (end < text.length) {
      const lastPeriod = chunk.lastIndexOf('.');
      const lastNL = chunk.lastIndexOf('\n');
      const breakPoint = Math.max(lastPeriod, lastNL);

      if (breakPoint > chunkSize * 0.5) {
        chunk = chunk.slice(0, breakPoint + 1);
      }
    }

    chunks.push(chunk.trim());
    start += chunk.length - overlap;
  }

  return chunks.filter(c => c.length > 50);
}

// -------------------------------
// SECTION LABEL DETECTION
// -------------------------------
function extractSectionFromChunk(chunk) {
  const match = chunk.match(/(?:Section|s\.?)\s*(\d+(?:\([^)]+\))*)/i);
  return match ? `Section ${match[1]}` : null;
}

// -------------------------------
// INGEST A SINGLE PDF FILE
// -------------------------------
async function ingestPDF(filePath) {
  console.log(`Processing: ${path.basename(filePath)}`);

  const text = await extractTextFromPDF(filePath);
  const chunks = chunkText(text);
  const fileName = path.basename(filePath);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const section = extractSectionFromChunk(chunk);

    await storeChunk(chunk, fileName, section, Math.floor(i / 3) + 1);

    if ((i + 1) % 10 === 0) {
      console.log(`  Processed ${i + 1}/${chunks.length} chunks`);
    }
  }

  console.log(`  Completed: ${chunks.length} chunks stored`);
}

// -------------------------------
// INGEST TEXT FILES (TXT, MD)
// -------------------------------
async function ingestTextFile(filePath) {
  console.log(`Processing: ${path.basename(filePath)}`);

  const text = fs.readFileSync(filePath, 'utf-8');
  const chunks = chunkText(text);
  const fileName = path.basename(filePath);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const section = extractSectionFromChunk(chunk);

    await storeChunk(chunk, fileName, section);
  }

  console.log(`  Completed: ${chunks.length} chunks stored`);
}

// -------------------------------
// MAIN SCRIPT
// -------------------------------
async function main() {
  if (!fs.existsSync(DOCS_DIR)) {
    fs.mkdirSync(DOCS_DIR, { recursive: true });
    console.log(`Created documents folder at: ${DOCS_DIR}`);
    console.log('Place PDFs in this folder and run again.');
    return;
  }

  const files = fs.readdirSync(DOCS_DIR);
  const docs = files.filter(f =>
    f.endsWith('.pdf') || f.endsWith('.txt') || f.endsWith('.md')
  );

  if (docs.length === 0) {
    console.log('No documents found in /documents.');
    return;
  }

  console.log(`Found ${docs.length} files to process\n`);

  for (const file of docs) {
    const full = path.join(DOCS_DIR, file);

    if (file.endsWith('.pdf')) {
      await ingestPDF(full);
    } else {
      await ingestTextFile(full);
    }
  }

  console.log('\nIngestion complete!');
}

main().catch(err => console.error(err));

