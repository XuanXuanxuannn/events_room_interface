const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { getDb } = require('../db');
const { config } = require('../config');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errors');

const router = express.Router();

function issueSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + config.sessionTtlHours * 3600 * 1000).toISOString();
  getDb()
    .prepare(`INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`)
    .run(token, userId, expiresAt);
  return { token, expiresAt };
}

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '').trim();
    if (!username || !password) {
      return res.status(400).json({ ok: false, error: 'username and password are required' });
    }
    const user = getDb().prepare(`SELECT * FROM users WHERE username = ?`).get(username);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ ok: false, error: 'invalid credentials' });
    }
    const { token, expiresAt } = issueSession(user.id);
    res.cookie('session', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: !!(req.secure || req.app.get('secure') || config.enableHttps),
      maxAge: config.sessionTtlHours * 3600 * 1000,
    });
    getDb()
      .prepare(`INSERT INTO audit_logs (actor, action, detail) VALUES (?, 'login', ?)`)
      .run(username, 'admin login');
    res.json({ ok: true, token, expiresAt, username: user.username });
  })
);

router.post(
  '/logout',
  requireAuth,
  asyncHandler(async (req, res) => {
    getDb().prepare(`DELETE FROM sessions WHERE token = ?`).run(req.authToken);
    res.clearCookie('session');
    res.json({ ok: true });
  })
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ ok: true, user: req.user });
  })
);

module.exports = router;
