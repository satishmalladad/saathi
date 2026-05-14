const router = require('express').Router();
const { retrieve } = require('../services/docService');
const { ragChat }  = require('../services/groq');
const store        = require('../utils/store');

router.post('/', async (req, res) => {
  const { query, docIds } = req.body;
  if (!query?.trim()) return res.status(400).json({ error: 'Query required' });
  if (!docIds?.length) return res.status(400).json({ error: 'docIds required' });

  try {
    // Retrieve relevant chunks
    const chunks = await retrieve(docIds, query, 6);

    // Always answer — even if chunks have low scores, pass them to LLM
    const histKey = docIds.length === 1 ? docIds[0] : store.multiKey(docIds);
    const history = store.getMsgs(histKey);

    const raw = await ragChat(query, chunks, history);

    // Parse answer + sources
    let answer = raw, sources = [];
    const split = raw.split(/\*?\*?Sources:\*?\*?/i);
    if (split.length >= 2) {
      answer = split[0].replace(/\*?\*?Answer:\*?\*?\s*/i, '').trim();
      sources = split[1].split('\n')
        .filter(l => l.trim().startsWith('-'))
        .map(l => {
          const pg = l.match(/Page\s*(\d+)/i);
          const qt = l.match(/"([^"]+)"/);
          return { page: pg ? +pg[1] : null, quote: qt ? qt[1] : l.replace(/^-\s*/,'').trim() };
        })
        .filter(s => s.page || s.quote);
    }

    // Fallback sources from chunks
    if (!sources.length && chunks.length) {
      sources = chunks.slice(0,3).map(c => ({ page: c.page, quote: c.text.slice(0,120)+'...' }));
    }

    // Save to history
    store.addMsg(histKey, { role: 'user', content: query });
    store.addMsg(histKey, { role: 'assistant', content: raw, sources });

    res.json({ answer, sources, raw });
  } catch (e) {
    console.error('Chat error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
