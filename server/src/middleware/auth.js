const { getDb } = require('../db');

function extractToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    return header.slice('Bearer '.length).trim();
  }
  if (req.cookies && req.cookies.session) {
    return req.cookies.session;
  }
  return null;
}

function getValidSession(token) {
  if (!token) return null;
  const db = getDb();
  const row = db
    .prepare(
      `SELECT s.token, s.expires_at, u.id AS user_id, u.username
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`
    )
    .get(token);
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  return row;
}

function requireAuth(req, res, next) {
  const token = extractToken(req);
  const session = getValidSession(token);
  if (!session) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  req.user = { id: session.user_id, username: session.username };
  req.authToken = token;
  next();
}

function optionalAuth(req, res, next) {
  const token = extractToken(req);
  const session = getValidSession(token);
  if (session) {
    req.user = { id: session.user_id, username: session.username };
    req.authToken = token;
  }
  next();
}

module.exports = { extractToken, getValidSession, requireAuth, optionalAuth };
