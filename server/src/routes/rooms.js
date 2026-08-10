const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errors');
const {
  createRoom,
  getRoomStatus,
  handlePresence,
  disconnectRoom,
  ensureRoom,
} = require('../services/roomManager');

const router = express.Router();

router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const room = createRoom(req.user.username);
    res.status(201).json({ ok: true, ...room });
  })
);

router.get(
  '/:code',
  asyncHandler(async (req, res) => {
    const status = getRoomStatus(req.params.code);
    res.json({ ok: true, ...status });
  })
);

router.post(
  '/:code/join',
  asyncHandler(async (req, res) => {
    try {
      ensureRoom(req.params.code);
      const result = handlePresence({
        room: req.params.code,
        role: req.body?.role,
        action: 'join',
        clientId: req.body?.clientId,
        userAgent: req.body?.userAgent || req.headers['user-agent'],
      });
      res.json(result);
    } catch (err) {
      res.status(err.status || 400).json({ ok: false, error: err.message });
    }
  })
);

router.post(
  '/:code/leave',
  asyncHandler(async (req, res) => {
    try {
      const result = handlePresence({
        room: req.params.code,
        role: req.body?.role,
        action: 'leave',
        clientId: req.body?.clientId,
        userAgent: req.body?.userAgent || req.headers['user-agent'],
      });
      res.json(result);
    } catch (err) {
      res.status(err.status || 400).json({ ok: false, error: err.message });
    }
  })
);

router.post(
  '/:code/disconnect',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = disconnectRoom(req.params.code);
    res.json(result);
  })
);

module.exports = router;
