/**
 * Saathi AI - Data Store
 * Persists documents + chat history to data/store.json
 */
const fs   = require('fs');
const path = require('path');

const DATA_DIR  = path.join(__dirname, '../data');
const STOR_FILE = path.join(DATA_DIR, 'store.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function load() {
  try {
    if (fs.existsSync(STOR_FILE)) return JSON.parse(fs.readFileSync(STOR_FILE, 'utf8'));
  } catch {}
  return { documents: {}, chats: {} };
}

let db = load();
let saveTimer = null;

function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.writeFileSync(STOR_FILE, JSON.stringify(db, null, 2));
  }, 400);
}

// Documents
function addDoc(doc) {
  db.documents[doc.id] = { ...doc, uploadedAt: new Date().toISOString() };
  db.chats[doc.id] = [];
  save();
  return db.documents[doc.id];
}
function getDoc(id)    { return db.documents[id] || null; }
function getAllDocs()   { return Object.values(db.documents).sort((a,b) => new Date(b.uploadedAt)-new Date(a.uploadedAt)); }
function delDoc(id)    { delete db.documents[id]; delete db.chats[id]; save(); }
function updateDoc(id, upd) {
  if (db.documents[id]) { db.documents[id] = { ...db.documents[id], ...upd }; save(); }
  return db.documents[id];
}

// Chat history
function addMsg(docId, msg) {
  if (!db.chats[docId]) db.chats[docId] = [];
  const m = { id: Date.now().toString(), ...msg, ts: new Date().toISOString() };
  db.chats[docId].push(m);
  if (db.chats[docId].length > 100) db.chats[docId] = db.chats[docId].slice(-100);
  save();
  return m;
}
function getMsgs(docId)   { return db.chats[docId] || []; }
function clearMsgs(docId) { db.chats[docId] = []; save(); }
function multiKey(ids)    { return 'multi_' + [...ids].sort().join('_'); }

module.exports = { addDoc, getDoc, getAllDocs, delDoc, updateDoc, addMsg, getMsgs, clearMsgs, multiKey };
