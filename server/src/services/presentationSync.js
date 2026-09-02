const { getDb } = require('../db');
const { broadcast, addClient, roomKey } = require('../realtime/sse');
const { ensureRoom, handlePresence, touchRoom } = require('./roomManager');

function loadState(room) {
  const key = roomKey(room);
  const row = getDb().prepare('SELECT * FROM presentation_state WHERE room_code = ?').get(key);
  if (!row) return null;
  return {
    active: !!row.active,
    seq: row.seq,
    presentation: row.presentation_json ? JSON.parse(row.presentation_json) : null,
    presentationId: row.presentation_id,
    page: row.page,
    zoom: row.zoom,
    panX: row.pan_x,
    panY: row.pan_y,
    panRatioX: row.pan_ratio_x,
    panRatioY: row.pan_ratio_y,
    panUnitX: row.pan_unit_x,
    panUnitY: row.pan_unit_y,
  };
}

function saveState(room, state) {
  const key = roomKey(room);
  ensureRoom(key);
  getDb()
    .prepare(
      `INSERT INTO presentation_state (
         room_code, active, seq, presentation_json, presentation_id,
         page, zoom, pan_x, pan_y, pan_ratio_x, pan_ratio_y, pan_unit_x, pan_unit_y, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(room_code) DO UPDATE SET
         active = excluded.active,
         seq = excluded.seq,
         presentation_json = excluded.presentation_json,
         presentation_id = excluded.presentation_id,
         page = excluded.page,
         zoom = excluded.zoom,
         pan_x = excluded.pan_x,
         pan_y = excluded.pan_y,
         pan_ratio_x = excluded.pan_ratio_x,
         pan_ratio_y = excluded.pan_ratio_y,
         pan_unit_x = excluded.pan_unit_x,
         pan_unit_y = excluded.pan_unit_y,
         updated_at = datetime('now')`
    )
    .run(
      key,
      state.active ? 1 : 0,
      state.seq || null,
      state.presentation ? JSON.stringify(state.presentation) : null,
      state.presentationId || null,
      state.page || null,
      state.zoom || null,
      state.panX ?? null,
      state.panY ?? null,
      state.panRatioX ?? null,
      state.panRatioY ?? null,
      state.panUnitX ?? null,
      state.panUnitY ?? null
    );
  touchRoom(key);
}

function attachEvents(res, room) {
  const key = addClient(room, res);
  const state = loadState(key);
  if (state && state.active && state.presentation) {
    res.write(
      `data: ${JSON.stringify({
        command: 'start',
        room: key,
        seq: state.seq || Date.now(),
        presentation: state.presentation,
        at: Date.now(),
        sender: 'server',
      })}\n\n`
    );
    if (state.page || state.zoom) {
      res.write(
        `data: ${JSON.stringify({
          command: 'sync',
          room: key,
          seq: (state.seq || Date.now()) + 1,
          page: state.page || 1,
          zoom: state.zoom || 1,
          panX: state.panX || 0,
          panY: state.panY || 0,
          panRatioX: state.panRatioX,
          panRatioY: state.panRatioY,
          panUnitX: state.panUnitX,
          panUnitY: state.panUnitY,
          presentationId: state.presentationId || state.presentation.id || null,
          sender: 'server',
          at: Date.now(),
        })}\n\n`
      );
    }
  }
}

function handleCommand(payload) {
  const room = roomKey(payload.room);
  ensureRoom(room);
  const eventPayload = {
    command: payload.command || 'unknown',
    room,
    seq: payload.seq || Date.now(),
    presentation: payload.presentation || null,
    presentationId: payload.presentationId || null,
    page: payload.page || null,
    zoom: payload.zoom || null,
    panX: payload.panX || 0,
    panY: payload.panY || 0,
    panRatioX: Number.isFinite(Number(payload.panRatioX)) ? Number(payload.panRatioX) : null,
    panRatioY: Number.isFinite(Number(payload.panRatioY)) ? Number(payload.panRatioY) : null,
    panUnitX: Number.isFinite(Number(payload.panUnitX)) ? Number(payload.panUnitX) : null,
    panUnitY: Number.isFinite(Number(payload.panUnitY)) ? Number(payload.panUnitY) : null,
    viewportW: Number(payload.viewportW) || null,
    viewportH: Number(payload.viewportH) || null,
    orientation: payload.orientation || null,
    sender: payload.sender || null,
    source: payload.source || null,
    clientId: String(payload.clientId || ''),
    direction: Number.isFinite(Number(payload.direction)) ? Number(payload.direction) : null,
    action: payload.action || null,
    fileIndex: Number.isFinite(Number(payload.fileIndex)) ? Number(payload.fileIndex) : null,
    screenRoom: payload.screenRoom || null,
    requestId: payload.requestId || null,
    presentationName: payload.presentationName || null,
    at: Date.now(),
  };

  const existing = loadState(room) || {};
  if ((eventPayload.command === 'start' || eventPayload.command === 'screen-share-start') && eventPayload.presentation) {
    saveState(room, { active: true, ...existing, ...eventPayload });
    getDb().prepare(`UPDATE rooms SET status = 'live', last_activity_at = datetime('now') WHERE code = ?`).run(room);
  } else if (eventPayload.command === 'sync') {
    saveState(room, {
      ...existing,
      active: existing.active !== false,
      ...eventPayload,
      presentation: existing.presentation || eventPayload.presentation || null,
    });
  } else if (eventPayload.command === 'exit') {
    saveState(room, { active: false, seq: eventPayload.seq });
    getDb().prepare(`UPDATE rooms SET status = 'waiting', last_activity_at = datetime('now') WHERE code = ?`).run(room);
    // Always free the display slot on exit so a later Start / rejoin does not hit 409.
    try {
      handlePresence({ room, action: 'clear-display' });
    } catch (_e) {
      /* ignore */
    }
  }

  broadcast(room, eventPayload);
  return { ok: true, room };
}

module.exports = { attachEvents, handleCommand, loadState, saveState };
