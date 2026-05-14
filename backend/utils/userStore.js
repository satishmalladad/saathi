/**
 * Saathi AI - User Store
 * Persists user accounts to data/users.json
 */
const fs   = require('fs');
const path = require('path');

const DATA_DIR  = path.join(__dirname, '../data');
const USER_FILE = path.join(DATA_DIR, 'users.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function load() {
  try {
    if (fs.existsSync(USER_FILE)) return JSON.parse(fs.readFileSync(USER_FILE, 'utf8'));
  } catch {}
  return { users: [] };
}

let db = load();
let t  = null;

function save() {
  clearTimeout(t);
  t = setTimeout(() => fs.writeFileSync(USER_FILE, JSON.stringify(db, null, 2)), 300);
}

function findByEmail(email) {
  return db.users.find(u => u.email === email.toLowerCase().trim()) || null;
}
function findById(id) {
  return db.users.find(u => u.id === id) || null;
}
function findRaw(email) {
  return db.users.find(u => u.email === email.toLowerCase().trim()) || null;
}
function create(data) {
  if (findByEmail(data.email)) throw new Error('An account with this email already exists');
  const now  = new Date().toISOString();
  const user = {
    id:           data.id,
    firstName:    (data.firstName || '').trim(),
    lastName:     (data.lastName  || '').trim(),
    email:        data.email.toLowerCase().trim(),
    passwordHash: data.passwordHash || null,
    provider:     data.provider || 'email',
    createdAt:    now,
    lastLoginAt:  now,
  };
  db.users.push(user);
  save();
  const { passwordHash, ...safe } = user;
  return safe;
}
function touch(id)      { const u = db.users.find(u=>u.id===id); if(u) { u.lastLoginAt=new Date().toISOString(); save(); } }
function safe(u)        { const { passwordHash, ...s } = u; return s; }
function count()        { return db.users.length; }

module.exports = { findByEmail, findById, findRaw, create, touch, safe, count };
