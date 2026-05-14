/**
 * Saathi AI - Chunker v3
 * Completely rewritten based on actual PDF extraction output.
 * 
 * Key insight: pdf-parse gives us 131 newlines and 3038 chars for the ML PDF.
 * We chunk by grouping lines into sections, not by character count.
 */

// ── Stop words ────────────────────────────────────────────────
const STOP = new Set([
  'the','a','an','and','or','but','in','on','at','to','for','of','with',
  'by','from','is','are','was','were','be','been','have','has','had',
  'do','does','did','will','would','could','should','this','that','it',
  'its','not','so','if','as','up','out','into','we','you','they','he','she'
]);

// ── Abbreviation expansion (critical for short queries like "ml", "ai") ──
const ABBR = {
  'ml':  'machine learning',
  'ai':  'artificial intelligence',
  'dl':  'deep learning',
  'nlp': 'natural language processing',
  'cv':  'computer vision',
  'knn': 'k nearest neighbors',
  'svm': 'support vector machine',
  'pca': 'principal component analysis',
  'llm': 'large language model',
  'rag': 'retrieval augmented generation',
  'nn':  'neural network',
  'rf':  'random forest',
  'dt':  'decision tree',
  'lr':  'linear regression',
  'mse': 'mean squared error',
  'mae': 'mean absolute error',
  'api': 'application programming interface',
};

function expandText(text) {
  let t = text.toLowerCase();
  for (const [abbr, full] of Object.entries(ABBR)) {
    t = t.replace(new RegExp(`\\b${abbr}\\b`, 'g'), `${full} ${abbr}`);
  }
  return t;
}

// ── FNV-1a hash (better than bitshift) ────────────────────────
function fnv1a(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

// ── Embedding: 512-dim, bigrams, abbr expansion ───────────────
function generateSimpleEmbedding(text) {
  const SIZE = 512;
  const vec  = new Float32Array(SIZE);
  const expanded = expandText(text);

  const words = expanded
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 2 && !STOP.has(w));

  // Unigrams + bigrams
  const tokens = [...words];
  for (let i = 0; i < words.length - 1; i++) {
    tokens.push(words[i] + '_' + words[i+1]);
  }

  const freq = {};
  for (const t of tokens) freq[t] = (freq[t] || 0) + 1;

  for (const [token, count] of Object.entries(freq)) {
    const i1 = fnv1a(token) % SIZE;
    const i2 = fnv1a(token + '~') % SIZE;
    vec[i1] += count;
    vec[i2] += count * 0.6;
  }

  // L2 normalize
  let mag = 0;
  for (let i = 0; i < SIZE; i++) mag += vec[i] * vec[i];
  mag = Math.sqrt(mag) || 1;
  for (let i = 0; i < SIZE; i++) vec[i] /= mag;

  return Array.from(vec);
}

function cosineSimilarity(a, b) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return Math.max(0, Math.min(1, dot));
}

// ── Main chunking function ─────────────────────────────────────
/**
 * Chunks extracted PDF text into meaningful sections.
 * Works with the actual output of pdf-parse (line-based text).
 * 
 * Strategy:
 * 1. Split into lines (pdf-parse preserves newlines)
 * 2. Group lines into sections of ~300-500 chars
 * 3. Estimate page number from position in document
 */
function chunkText(rawText, chunkSize = 350, overlap = 60) {
  if (!rawText || !rawText.trim()) return [];

  // Clean the text
  const cleaned = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')         // collapse spaces/tabs
    .replace(/\n{3,}/g, '\n\n')      // max 2 consecutive newlines
    .trim();

  // Split into lines, filter empty
  const lines = cleaned
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 1);

  if (lines.length === 0) return [];

  // Estimate total chars for page calculation
  const totalChars = cleaned.length;
  const nPages     = Math.max(1, Math.ceil(totalChars / 600));

  const chunks = [];
  let current  = [];
  let currentLen = 0;
  let idx = 0;
  let charsSoFar = 0;

  const flush = () => {
    if (current.length === 0) return;
    const text = current.join('\n').trim();
    if (text.length < 15) return;
    const page = Math.max(1, Math.ceil((charsSoFar / totalChars) * nPages));
    chunks.push({ index: idx++, text, page, docId: '' });
    current = [];
    currentLen = 0;
  };

  for (const line of lines) {
    charsSoFar += line.length + 1;

    // Start new chunk if adding this line would exceed chunkSize
    if (currentLen + line.length > chunkSize && currentLen > 50) {
      flush();
      // Overlap: keep last line of previous chunk
      if (chunks.length > 0) {
        const prev = chunks[chunks.length - 1].text.split('\n');
        const overlapLines = prev.slice(-2);
        current = [...overlapLines];
        currentLen = overlapLines.join('\n').length;
      }
    }

    current.push(line);
    currentLen += line.length + 1;
  }

  flush(); // flush remaining

  return chunks;
}

module.exports = {
  chunkText,
  generateSimpleEmbedding,
  cosineSimilarity,
  expandText,
};
