const fs = require('fs');
const path = require('path');
const { getDb } = require('../db');
const { config } = require('../config');
const { expireOldRooms } = require('./roomManager');
const { pruneEndedSessions } = require('./screenShareService');

function pruneExpiredSessions() {
  const db = getDb();
  const now = new Date().toISOString();
  return db.prepare(`DELETE FROM sessions WHERE expires_at < ?`).run(now).changes;
}

function pruneOrphanUploads() {
  const db = getDb();
  const known = new Set(
    db.prepare(`SELECT file_path FROM uploaded_files`).all().map((r) => path.resolve(r.file_path))
  );
  let removed = 0;
  for (const dir of [config.presentationsDir, config.convertedDir]) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (name.startsWith('.')) continue;
      const full = path.resolve(dir, name);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) continue;
      if (!known.has(full)) {
        // only remove files older than 24h to avoid racing active uploads
        if (Date.now() - stat.mtimeMs > 24 * 3600 * 1000) {
          try {
            fs.unlinkSync(full);
            removed += 1;
          } catch (_e) {
            /* ignore */
          }
        }
      }
    }
  }
  return removed;
}

function runCleanup() {
  const summary = {
    expiredRooms: 0,
    endedScreenShares: 0,
    expiredSessions: 0,
    orphanFiles: 0,
    at: new Date().toISOString(),
  };
  try {
    summary.expiredRooms = expireOldRooms();
  } catch (err) {
    console.warn('expireOldRooms failed:', err.message);
  }
  try {
    summary.endedScreenShares = pruneEndedSessions();
  } catch (err) {
    console.warn('pruneEndedSessions failed:', err.message);
  }
  try {
    summary.expiredSessions = pruneExpiredSessions();
  } catch (err) {
    console.warn('pruneExpiredSessions failed:', err.message);
  }
  try {
    summary.orphanFiles = pruneOrphanUploads();
  } catch (err) {
    console.warn('pruneOrphanUploads failed:', err.message);
  }
  console.log('[cleanup]', summary);
  return summary;
}

function startCleanupScheduler() {
  const timer = setInterval(runCleanup, config.cleanupIntervalMs);
  if (typeof timer.unref === 'function') timer.unref();
  // initial delayed run
  setTimeout(runCleanup, 15000).unref?.();
  return timer;
}

module.exports = { runCleanup, startCleanupScheduler };
