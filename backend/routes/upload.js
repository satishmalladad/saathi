const router  = require('express').Router();
const multer  = require('multer');
const path    = require('path');
const { v4: uuid } = require('uuid');
const docSvc  = require('../services/docService');
const store   = require('../utils/store');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename:    (req, file, cb) => cb(null, uuid() + path.extname(file.originalname)),
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['.pdf', '.txt', '.md'].includes(path.extname(file.originalname).toLowerCase());
    ok ? cb(null, true) : cb(new Error(`File type not supported. Use PDF, TXT, or MD.`));
  },
});

router.post('/', (req, res, next) => {
  upload.array('files', 10)(req, res, err => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, async (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: 'No files received' });

  const uploaded = [], errors = [];

  for (const file of req.files) {
    const docId = path.basename(file.filename, path.extname(file.filename));
    try {
      const result = await docSvc.ingest(file.path, docId, file.originalname);
      const doc = store.addDoc({
        id: docId, name: file.filename, originalName: file.originalname,
        size: file.size, filePath: file.path,
        pageCount: result.pageCount, chunkCount: result.chunkCount,
        preview: result.preview, status: 'ready',
      });
      uploaded.push({ id: docId, name: file.originalname, pageCount: result.pageCount, chunkCount: result.chunkCount });
    } catch (e) {
      console.error('Upload error:', e.message);
      errors.push({ file: file.originalname, error: e.message });
    }
  }

  res.json({ uploaded, errors, message: `${uploaded.length}/${req.files.length} files processed` });
});

module.exports = router;
