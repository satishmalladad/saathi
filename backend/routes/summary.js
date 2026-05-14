const router  = require('express').Router();
const { summarize, compare } = require('../services/groq');
const { extractText } = require('../services/docService');
const store   = require('../utils/store');

async function getText(docId) {
  const doc = store.getDoc(docId);
  if (!doc) throw new Error('Document not found');
  const { text } = await extractText(doc.filePath, doc.originalName);
  return { text, doc };
}

router.post('/', async (req, res) => {
  const { docId, type = 'short' } = req.body;
  if (!docId) return res.status(400).json({ error: 'docId required' });
  try {
    const { text, doc } = await getText(docId);
    const summary = await summarize(text, type);
    res.json({ summary, type, docName: doc.originalName });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/compare', async (req, res) => {
  const { docIds } = req.body;
  if (!docIds || docIds.length < 2) return res.status(400).json({ error: 'At least 2 docIds required' });
  try {
    const texts = [], names = [];
    for (const id of docIds) {
      const { text, doc } = await getText(id);
      texts.push(text); names.push(doc.originalName);
    }
    const result = await compare(texts, names);
    res.json({ comparison: result, documents: names });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
