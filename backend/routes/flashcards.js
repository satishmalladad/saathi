const router = require('express').Router();
const groq   = require('../services/groq');
const { extractText } = require('../services/docService');
const store  = require('../utils/store');

async function getText(docId) {
  const doc = store.getDoc(docId);
  if (!doc) throw new Error('Document not found');
  const { text } = await extractText(doc.filePath, doc.originalName);
  return { text, doc };
}

router.post('/', async (req, res) => {
  const { docId, count = 10 } = req.body;
  if (!docId) return res.status(400).json({ error: 'docId required' });
  try {
    const { text, doc } = await getText(docId);
    const cards = await groq.flashcards(text, Math.min(+count, 20));
    res.json({ flashcards: cards, count: cards.length, docName: doc.originalName });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/exam', async (req, res) => {
  const { docId, count = 5 } = req.body;
  if (!docId) return res.status(400).json({ error: 'docId required' });
  try {
    const { text, doc } = await getText(docId);
    const questions = await groq.exam(text, Math.min(+count, 10));
    res.json({ questions, count: questions.length, docName: doc.originalName });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/evaluate', async (req, res) => {
  const { question, userAnswer, modelAnswer } = req.body;
  if (!question || !userAnswer) return res.status(400).json({ error: 'question and userAnswer required' });
  try {
    const result = await groq.evalAnswer(question, userAnswer, modelAnswer || '');
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
