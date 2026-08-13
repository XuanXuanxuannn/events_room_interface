const { getDb } = require('../db');

function generateRoomCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function setScreenMode(mode, sessionId = null) {
  const db = getDb();
  db.prepare(
    `INSERT INTO screen_state (id, mode, current_session_id, last_changed_at)
     VALUES (1, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       mode = excluded.mode,
       current_session_id = excluded.current_session_id,
       last_changed_at = datetime('now')`
  ).run(mode, sessionId);
}

function createSession() {
  const db = getDb();
  let roomCode = generateRoomCode();
  // avoid collisions
  for (let i = 0; i < 5; i++) {
    const exists = db.prepare(`SELECT id FROM screen_share_sessions WHERE room_code = ?`).get(roomCode);
    if (!exists) break;
    roomCode = generateRoomCode();
  }
  const info = db
    .prepare(
      `INSERT INTO screen_share_sessions (room_code, status, started_at)
       VALUES (?, 'waiting', datetime('now'))`
    )
    .run(roomCode);
  setScreenMode('screen_share_waiting', info.lastInsertRowid);
  return {
    session_id: info.lastInsertRowid,
    room_code: roomCode,
    status: 'waiting',
    mode: 'screen_share_waiting',
  };
}

function getSessionByRoom(roomCode) {
  const row = getDb()
    .prepare(`SELECT * FROM screen_share_sessions WHERE room_code = ?`)
    .get(String(roomCode));
  if (!row) return null;
  return {
    session_id: row.id,
    room_code: row.room_code,
    session_type: 'screen_share',
    status: row.status,
    started_at: row.started_at,
    ended_at: row.ended_at,
  };
}

function endSession(roomCode) {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM screen_share_sessions WHERE room_code = ?`).get(String(roomCode));
  if (!row) return null;
  const alreadyEnded = row.status === 'ended';
  if (!alreadyEnded) {
    db.prepare(
      `UPDATE screen_share_sessions SET status = 'ended', ended_at = datetime('now') WHERE id = ?`
    ).run(row.id);
  }
  setScreenMode('billboard', null);
  const updated = db.prepare(`SELECT * FROM screen_share_sessions WHERE id = ?`).get(row.id);
  return {
    session_id: updated.id,
    room_code: updated.room_code,
    status: updated.status,
    already_ended: alreadyEnded,
    mode: 'billboard',
    ended_at: updated.ended_at,
  };
}

function getScreenState() {
  const row = getDb().prepare(`SELECT * FROM screen_state WHERE id = 1`).get();
  if (!row) return null;
  return {
    id: row.id,
    mode: row.mode,
    current_session_id: row.current_session_id,
    last_changed_at: row.last_changed_at,
  };
}

function pruneEndedSessions(maxAgeHours = 72) {
  const cutoff = new Date(Date.now() - maxAgeHours * 3600 * 1000).toISOString();
  const result = getDb()
    .prepare(
      `DELETE FROM screen_share_sessions
       WHERE status = 'ended' AND ended_at IS NOT NULL AND ended_at < ?`
    )
    .run(cutoff);
  return result.changes;
}

module.exports = {
  createSession,
  getSessionByRoom,
  endSession,
  getScreenState,
  pruneEndedSessions,
  setScreenMode,
};
