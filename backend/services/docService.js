/**
 * Saathi AI - Document Service
 * Extracts text from PDF/TXT and ingests into vector store.
 */
const fs      = require('fs');
const path    = require('path');
const { chunkText } = require('../utils/chunker');
const store   = require('../vectorStore/memoryStore');

let pdfParse;
try {
  pdfParse = require('pdf-parse');
  console.log('✅ pdf-parse ready');
} catch (e) {
  console.error('❌ pdf-parse not found — run npm install');
}

// ── Extract text ───────────────────────────────────────────────
async function extractText(filePath, originalName) {
  const ext = path.extname(originalName).toLowerCase();

  if (ext === '.pdf') {
    if (!pdfParse) throw new Error('pdf-parse not installed. Run: npm install');
    const buf  = fs.readFileSync(filePath);
    const data = await pdfParse(buf);
    return { text: data.text, pageCount: data.numpages || 1 };
  }

  if (ext === '.txt' || ext === '.md') {
    const text = fs.readFileSync(filePath, 'utf8');
    return { text, pageCount: Math.max(1, Math.ceil(text.length / 2000)) };
  }

  throw new Error(`Unsupported file type: ${ext}. Use PDF, TXT or MD.`);
}

// ── Main ingestion pipeline ────────────────────────────────────
async function ingest(filePath, docId, originalName) {
  console.log(`📄 Ingesting: ${originalName}`);

  const { text, pageCount } = await extractText(filePath, originalName);

  if (!text || text.trim().length < 20) {
    throw new Error(
      'Document has no readable text. It may be a scanned/image PDF. ' +
      'Only text-based PDFs are supported.'
    );
  }

  console.log(`   Extracted: ${text.length} chars, ${pageCount} pages`);

  // Chunk — use smaller size for short documents
  const chunkSize = text.length < 5000 ? 300 : 500;
  const chunks    = chunkText(text, chunkSize, 60);

  if (chunks.length === 0) throw new Error('Could not create chunks from document');

  // Tag each chunk with docId
  const tagged = chunks.map(c => ({ ...c, docId }));

  // Store in vector DB
  await store.addChunks(`doc_${docId}`, tagged);

  console.log(`✅ Ingested ${chunks.length} chunks from "${originalName}"`);

  return {
    chunkCount: chunks.length,
    pageCount,
    preview: text.slice(0, 200).replace(/\s+/g, ' ').trim(),
    fullText: text,
  };
}

// ── Retrieve relevant chunks ───────────────────────────────────
async function retrieve(docIds, query, n = 6) {
  if (docIds.length === 1) {
    return store.query(`doc_${docIds[0]}`, query, n);
  }
  return store.queryMultiple(docIds.map(id => `doc_${id}`), query, n);
}

async function deleteDoc(docId) {
  await store.deleteCollection(`doc_${docId}`);
}

// Re-ingest all documents from disk on server restart
async function rehydrate(documents) {
  if (!documents || documents.length === 0) return;
  console.log(`🔄 Rehydrating ${documents.length} document(s) from disk...`);
  for (const doc of documents) {
    if (!doc.filePath || !fs.existsSync(doc.filePath)) continue;
    try {
      await ingest(doc.filePath, doc.id, doc.originalName);
    } catch (e) {
      console.warn(`⚠️  Could not rehydrate ${doc.originalName}:`, e.message);
    }
  }
  console.log('✅ Rehydration complete');
}

module.exports = { ingest, retrieve, deleteDoc, extractText, rehydrate };
