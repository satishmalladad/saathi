/**
 * Saathi AI - In-Memory Vector Store
 * No external dependencies. Fast, reliable, resets on restart (re-upload to rebuild).
 */
const { generateSimpleEmbedding, cosineSimilarity } = require('../utils/chunker');

// collections[name] = { chunks: [], embeddings: [] }
const collections = {};

function getOrCreate(name) {
  if (!collections[name]) collections[name] = { chunks: [], embeddings: [] };
  return collections[name];
}

async function addChunks(collectionName, chunks) {
  const col = getOrCreate(collectionName);
  // Clear old data for this collection (re-upload rebuilds)
  col.chunks     = [];
  col.embeddings = [];

  for (const chunk of chunks) {
    col.chunks.push(chunk);
    col.embeddings.push(generateSimpleEmbedding(chunk.text));
  }
  console.log(`✅ Stored ${chunks.length} chunks in "${collectionName}"`);
  return true;
}

async function query(collectionName, queryText, nResults = 6) {
  const col = collections[collectionName];
  if (!col || col.chunks.length === 0) {
    console.warn(`⚠️  Collection "${collectionName}" empty or not found`);
    return [];
  }

  const qv = generateSimpleEmbedding(queryText);

  const scored = col.chunks.map((chunk, i) => ({
    chunk,
    score: cosineSimilarity(qv, col.embeddings[i])
  }));

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, nResults);

  console.log(`🔍 "${queryText}" → top score: ${top[0]?.score?.toFixed(4)} (${col.chunks.length} chunks searched)`);

  return top.map(item => ({
    text:  item.chunk.text,
    page:  item.chunk.page,
    score: item.score,
    docId: item.chunk.docId || collectionName,
  }));
}

async function queryMultiple(collectionNames, queryText, nResults = 6) {
  const all = [];
  for (const name of collectionNames) {
    const results = await query(name, queryText, nResults);
    all.push(...results);
  }
  all.sort((a, b) => b.score - a.score);
  return all.slice(0, nResults);
}

async function deleteCollection(name) {
  delete collections[name];
}

module.exports = { addChunks, query, queryMultiple, deleteCollection };
