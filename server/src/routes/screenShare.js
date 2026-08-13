const express = require('express');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errors');
const {
  createSession,
  getSessionByRoom,
  endSession,
  getScreenState,
} = require('../services/screenShareService');

const router = express.Router();

// Controllers on LAN are not always admin-authenticated; allow create for presentation flow.
router.post(
  '/session',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const session = createSession();
    const protocol = req.secure || req.app.get('secure') ? 'https' : req.protocol;
    const baseUrl = `${protocol}://${req.get('host')}`;
    res.status(201).json({
      ...session,
      socket_url: baseUrl,
      message: 'screen share session created',
      display_instruction: `Display should join room ${session.room_code}`,
      presenter_instruction: `Presenter should join room ${session.room_code}`,
    });
  })
);

router.get(
  '/session/:roomCode',
  asyncHandler(async (req, res) => {
    const session = getSessionByRoom(req.params.roomCode);
    if (!session) return res.status(404).json({ error: 'screen share session not found' });
    res.json(session);
  })
);

router.post(
  '/session/:roomCode/end',
  requireAuth,
  asyncHandler(async (req, res) => {
    const session = endSession(req.params.roomCode);
    if (!session) return res.status(404).json({ error: 'screen share session not found' });

    const io = req.app.get('io');
    if (io && !session.already_ended) {
      io.to(req.params.roomCode).emit('stop-screen-share', {
        room: req.params.roomCode,
        reason: 'session ended by backend',
      });
    }

    res.json({
      ...session,
      message: session.already_ended
        ? 'screen share session was already ended'
        : 'screen share session ended',
    });
  })
);

module.exports = router;
