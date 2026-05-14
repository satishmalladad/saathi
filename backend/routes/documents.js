const router = require('express').Router();
const fs     = require('fs');
const store  = require('../utils/store');
const docSvc = require('../services/docService');

router.get('/',        (req, res) => res.json({ documents: store.getAllDocs() }));
router.get('/:id',     (req, res) => { const d = store.getDoc(req.params.id); d ? res.json({ document: d }) : res.status(404).json({ error: 'Not found' }); });
router.get('/:id/history', (req, res) => res.json({ history: store.getMsgs(req.params.id) }));
router.delete('/:id/history', (req, res) => { store.clearMsgs(req.params.id); res.json({ ok: true }); });
router.delete('/:id',  async (req, res) => {
  const doc = store.getDoc(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Not found' });
  try {
    await docSvc.deleteDoc(req.params.id);
    if (doc.filePath && fs.existsSync(doc.filePath)) fs.unlinkSync(doc.filePath);
    store.delDoc(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
