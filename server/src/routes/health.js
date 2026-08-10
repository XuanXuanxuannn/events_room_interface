const fs = require('fs');
const express = require('express');
const { getDb } = require('../db');
const { config } = require('../config');
const { asyncHandler } = require('../middleware/errors');

const router = express.Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    let dbOk = false;
    try {
      getDb().prepare('SELECT 1').get();
      dbOk = true;
    } catch (_e) {
      dbOk = false;
    }

    let storageWritable = false;
    try {
      const probe = `${config.dataDir}/.health-write`;
      fs.writeFileSync(probe, String(Date.now()));
      fs.unlinkSync(probe);
      storageWritable = true;
    } catch (_e) {
      storageWritable = false;
    }

    const ok = dbOk && storageWritable;
    res.status(ok ? 200 : 503).json({
      ok,
      service: 'events-room-server',
      db: dbOk ? 'up' : 'down',
      storage: storageWritable ? 'writable' : 'error',
      uptimeSec: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  })
);

module.exports = router;
