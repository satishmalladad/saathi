const router = require('express').Router();
const { podcast } = require('../services/groq');
const { extractText } = require('../services/docService');
const store  = require('../utils/store');

router.post('/', async (req, res) => {
  const { docId } = req.body;
  if (!docId) return res.status(400).json({ error: 'docId required' });
  const doc = store.getDoc(docId);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  try {
    const { text } = await extractText(doc.filePath, doc.originalName);
    const script   = await podcast(text, doc.originalName);
    const segments = parseScript(script);
    const duration = Math.ceil(script.split(' ').length / 140);
    res.json({ script, segments, docName: doc.originalName, estimatedDuration: duration });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

function parseScript(script) {
  return script.split('\n')
    .filter(l => l.trim())
    .map(l => {
      const m = l.match(/^(Alex|Sam|Host|Guest):\s*(.+)/i);
      if (!m) return null;
      return {
        speaker: m[1],
        text: m[2].replace(/\[PAUSE\]/g,'... ').replace(/\[EMPHASIS\]/g,'').trim(),
        voice: m[1].toLowerCase() === 'sam' ? 'female' : 'male',
      };
    })
    .filter(Boolean);
}

module.exports = router;
