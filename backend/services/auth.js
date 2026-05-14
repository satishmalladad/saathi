const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');

const SECRET  = () => process.env.JWT_SECRET || 'saathi-default-secret';
const EXPIRES = '7d';
const ROUNDS  = 10;

async function hash(pw)          { return bcrypt.hash(pw, ROUNDS); }
async function verify(pw, h)     { return bcrypt.compare(pw, h); }
function sign(user)              { return jwt.sign({ sub: user.id, email: user.email, firstName: user.firstName }, SECRET(), { expiresIn: EXPIRES }); }
function decode(token)           {
  try { return jwt.verify(token, SECRET()); }
  catch (e) {
    if (e.name === 'TokenExpiredError') throw new Error('Session expired — please sign in again');
    throw new Error('Invalid token');
  }
}
function extractToken(header)    { return header?.startsWith('Bearer ') ? header.slice(7).trim() : header?.trim() || null; }
function validEmail(e)           { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
function validPass(p)            {
  if (!p || p.length < 8)       return { ok: false, msg: 'Password must be at least 8 characters' };
  if (!/[0-9]/.test(p))         return { ok: false, msg: 'Password must contain at least one number' };
  return { ok: true };
}

module.exports = { hash, verify, sign, decode, extractToken, validEmail, validPass };
