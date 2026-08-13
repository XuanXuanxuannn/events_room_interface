const express = require('express');
const { asyncHandler } = require('../middleware/errors');
const { getScreenState } = require('../services/screenShareService');

const router = express.Router();

router.get(
  '/state',
  asyncHandler(async (_req, res) => {
    const state = getScreenState();
    if (!state) return res.status(404).json({ error: 'screen state not initialized' });
    res.json(state);
  })
);

module.exports = router;
