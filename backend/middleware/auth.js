const { decode, extractToken } = require('../services/auth');
const users = require('../utils/userStore');

function requireAuth(req, res, next) {
  const token = extractToken(req.headers['authorization']);
  if (!token) return res.status(401).json({ error: 'Sign in required', code: 'NO_TOKEN' });
  try {
    const decoded = decode(token);
    const user    = users.findById(decoded.sub);
    if (!user) return res.status(401).json({ error: 'Account not found', code: 'NOT_FOUND' });
    req.user = { id: user.id, email: user.email, firstName: user.firstName };
    next();
  } catch (e) {
    res.status(401).json({ error: e.message, code: 'BAD_TOKEN' });
  }
}

module.exports = { requireAuth };
