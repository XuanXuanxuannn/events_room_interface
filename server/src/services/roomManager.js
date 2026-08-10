const { getDb } = require('../db');
const { config } = require('../config');
const { broadcast, roomKey } = require('../realtime/sse');

function ensureRoom(code, createdBy = null) {
  const key = roomKey(code);
  const db = getDb();
  const existing = db.prepare('SELECT * FROM rooms WHERE code = ?').get(key);
  if (existing) return existing;
  const expiresAt = new Date(Date.now() + config.roomExpireHours * 3600 * 1000).toISOString();
  db.prepare(
    `INSERT INTO rooms (code, status, created_by, expires_at, last_activity_at)
     VALUES (?, 'waiting', ?, ?, datetime('now'))`
  ).run(key, createdBy, expiresAt);
  return db.prepare('SELECT * FROM rooms WHERE code = ?').get(key);
}

function touchRoom(code) {
  const key = roomKey(code);
  getDb()
    .prepare(`UPDATE rooms SET last_activity_at = datetime('now') WHERE code = ?`)
    .run(key);
}

function cleanStalePresence(code) {
  const key = roomKey(code);
  const db = getDb();
  // Compare using unix seconds so SQLite datetime('now') and ISO strings both work.
  const cutoffSec = Math.floor((Date.now() - config.presenceTtlMs) / 1000);
  const stale = db
    .prepare(
      `SELECT role, client_id FROM room_presence
       WHERE room_code = ?
         AND COALESCE(strftime('%s', last_seen), 0) < ?`
    )
    .all(key, cutoffSec);
  for (const row of stale) {
    db.prepare(`DELETE FROM room_presence WHERE room_code = ? AND role = ?`).run(key, row.role);
    broadcast(key, {
      command: 'presence',
      room: key,
      role: row.role,
      status: 'left',
      at: Date.now(),
      reason: 'ttl',
    });
  }
}

function getPresenceMap(code) {
  const key = roomKey(code);
  cleanStalePresence(key);
  const rows = getDb()
    .prepare(`SELECT role, client_id AS clientId, user_agent AS userAgent, last_seen AS lastSeen
              FROM room_presence WHERE room_code = ?`)
    .all(key);
  const state = {};
  for (const row of rows) {
    state[row.role] = {
      clientId: row.clientId,
      role: row.role,
      lastSeen: new Date(row.lastSeen).getTime(),
      userAgent: row.userAgent || '',
    };
  }
  return state;
}

function getRoomStatus(code) {
  const key = roomKey(code);
  ensureRoom(key);
  const room = getDb().prepare('SELECT * FROM rooms WHERE code = ?').get(key);
  const presence = getPresenceMap(key);
  const state = getDb().prepare('SELECT * FROM presentation_state WHERE room_code = ?').get(key);
  let status = 'waiting';
  if (presence.controller && presence.display && state && state.active) status = 'live';
  else if (presence.controller) status = 'controller_connected';
  else if (room.status === 'ended') status = 'ended';
  return { room: key, status, presence, active: !!(state && state.active), expiresAt: room.expires_at };
}

function handlePresence({ room, role, action, clientId, userAgent }) {
  const key = roomKey(room);
  const r = role === 'display' ? 'display' : 'controller';
  ensureRoom(key);
  const db = getDb();

  if (action === 'clear-display') {
    db.prepare(`DELETE FROM room_presence WHERE room_code = ? AND role = 'display'`).run(key);
    broadcast(key, { command: 'presence', room: key, role: 'display', status: 'left', at: Date.now() });
    return { ok: true, room: key, role: 'display', active: getPresenceMap(key) };
  }

  if (action === 'clear-room') {
    db.prepare(`DELETE FROM room_presence WHERE room_code = ?`).run(key);
    db.prepare(
      `INSERT INTO presentation_state (room_code, active, seq, updated_at)
       VALUES (?, 0, ?, datetime('now'))
       ON CONFLICT(room_code) DO UPDATE SET active = 0, seq = excluded.seq, updated_at = datetime('now')`
    ).run(key, Date.now());
    db.prepare(`UPDATE rooms SET status = 'ended', last_activity_at = datetime('now') WHERE code = ?`).run(key);
    broadcast(key, { command: 'exit', room: key, seq: Date.now(), sender: 'server-clear', at: Date.now() });
    return { ok: true, room: key, role: 'all', active: {} };
  }

  if (!clientId) {
    const err = new Error('Missing client id.');
    err.status = 400;
    throw err;
  }

  if (action === 'leave') {
    const existing = db
      .prepare(`SELECT client_id FROM room_presence WHERE room_code = ? AND role = ?`)
      .get(key, r);
    if (existing && existing.client_id === clientId) {
      db.prepare(`DELETE FROM room_presence WHERE room_code = ? AND role = ?`).run(key, r);
      broadcast(key, { command: 'presence', room: key, role: r, status: 'left', at: Date.now() });
    }
    touchRoom(key);
    return { ok: true, room: key, role: r, active: getPresenceMap(key) };
  }

  // join or heartbeat
  cleanStalePresence(key);
  const existing = db
    .prepare(`SELECT client_id FROM room_presence WHERE room_code = ? AND role = ?`)
    .get(key, r);
  if (existing && existing.client_id !== clientId) {
    const err = new Error(
      r === 'controller'
        ? 'Another controller is already connected to this room. Please disconnect it before joining.'
        : 'Another display screen is already connected to this room. Please close it before joining.'
    );
    err.status = 409;
    throw err;
  }

  db.prepare(
    `INSERT INTO room_presence (room_code, role, client_id, user_agent, last_seen)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(room_code, role) DO UPDATE SET
       client_id = excluded.client_id,
       user_agent = excluded.user_agent,
       last_seen = datetime('now')`
  ).run(key, r, clientId, userAgent || '');

  touchRoom(key);
  if (action !== 'heartbeat') {
    broadcast(key, {
      command: 'presence',
      room: key,
      role: r,
      status: 'joined',
      active: getPresenceMap(key),
      at: Date.now(),
    });
  }
  return { ok: true, room: key, role: r, active: getPresenceMap(key) };
}

function createRoom(createdBy = 'admin') {
  const code = String(Math.floor(10000000 + Math.random() * 90000000));
  ensureRoom(code, createdBy);
  return getRoomStatus(code);
}

function disconnectRoom(code) {
  return handlePresence({ room: code, action: 'clear-room' });
}

function expireOldRooms() {
  const db = getDb();
  const now = new Date().toISOString();
  const expired = db.prepare(`SELECT code FROM rooms WHERE expires_at IS NOT NULL AND expires_at < ?`).all(now);
  for (const row of expired) {
    try {
      disconnectRoom(row.code);
      db.prepare(`DELETE FROM rooms WHERE code = ?`).run(row.code);
    } catch (err) {
      console.warn('Expire room failed:', row.code, err.message);
    }
  }
  return expired.length;
}

module.exports = {
  ensureRoom,
  getPresenceMap,
  getRoomStatus,
  handlePresence,
  createRoom,
  disconnectRoom,
  expireOldRooms,
  touchRoom,
  roomKey,
};
