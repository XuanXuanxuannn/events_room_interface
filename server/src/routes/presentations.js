const path = require('path');
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const { presentationUpload } = require('../middleware/upload');
const { asyncHandler } = require('../middleware/errors');
const { getValidSession, extractToken } = require('../middleware/auth');
const { attachEvents, handleCommand, loadState } = require('../services/presentationSync');
const { handlePresence } = require('../services/roomManager');
const { convertPresentation } = require('../services/conversionService');

const router = express.Router();

function serializePresentationFile(row) {
  return {
    id: row.id,
    name: row.filename,
    type: String(row.file_type || '').toLowerCase(),
    url: row.public_url,
    size: row.size || 0,
    status: row.status,
    uploadedAt: row.uploaded_at,
  };
}

// Controllers are not admin-authenticated; list is open on the LAN for room presenters.
router.get(
  '/presentation-files',
  asyncHandler(async (_req, res) => {
    const rows = getDb()
      .prepare(
        `SELECT * FROM uploaded_files
         WHERE lower(file_type) IN ('pdf', 'ppt', 'pptx')
           AND converted_from_id IS NULL
           AND coalesce(status, '') NOT IN ('converting')
         ORDER BY datetime(replace(replace(uploaded_at, 'T', ' '), 'Z', '')) DESC, uploaded_at DESC, id DESC`
      )
      .all();
    res.json({ ok: true, files: rows.map(serializePresentationFile) });
  })
);

router.get(
  '/presentation-events',
  asyncHandler(async (req, res) => {
    const room = req.query.room || '12345678';
    // SSE takes over the response; do not call res.json
    attachEvents(res, room);
  })
);

router.get(
  '/presentation-state',
  asyncHandler(async (req, res) => {
    const room = req.query.room || '12345678';
    const state = loadState(room);
    res.json({
      ok: true,
      room,
      active: !!(state && state.active && state.presentation),
      seq: state && state.seq,
      presentation: state && state.active ? state.presentation : null,
      page: state && state.page,
      zoom: state && state.zoom,
    });
  })
);

router.post(
  '/presentation-presence',
  asyncHandler(async (req, res) => {
    try {
      const action = req.body?.action || 'join';
      if (action === 'clear-room') {
        const session = getValidSession(extractToken(req));
        if (!session) {
          return res.status(401).json({ ok: false, error: 'unauthorized' });
        }
      }
      const result = handlePresence({
        room: req.body?.room,
        role: req.body?.role,
        action,
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
  '/presentation-command',
  asyncHandler(async (req, res) => {
    try {
      const result = handleCommand(req.body || {});
      res.json(result);
    } catch (err) {
      res.status(400).json({ ok: false, error: 'Bad presentation command: ' + err.message });
    }
  })
);

router.post(
  '/presentation-files',
  presentationUpload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'presentation', maxCount: 1 },
  ]),
  asyncHandler(async (req, res) => {
    const file =
      (req.files && req.files.file && req.files.file[0]) ||
      (req.files && req.files.presentation && req.files.presentation[0]) ||
      null;
    if (!file) {
      return res.status(400).send('Please upload a PDF, PPT, or PPTX file.');
    }
    const ext = path.extname(file.originalname || '').toLowerCase().replace('.', '') || 'pdf';
    const id = `${Date.now().toString(36)}-${uuidv4().slice(0, 8)}`;
    const url = `/presentation_uploads/${file.filename}`;
    const originalName = file.originalname || file.filename;
    getDb()
      .prepare(
        `INSERT INTO uploaded_files
           (id, filename, file_type, file_path, public_url, size, status, uploaded_by, uploaded_at)
         VALUES (?, ?, ?, ?, ?, ?, 'uploaded', ?, datetime('now'))`
      )
      .run(id, originalName, ext, file.path, url, file.size || 0, null);

    // PDF uploads are ready immediately.
    if (ext === 'pdf') {
      return res.status(201).json({
        id,
        name: originalName,
        type: 'pdf',
        size: file.size || 0,
        url,
        converted: false,
      });
    }

    // PPT/PPTX: convert to PDF on upload so Start Presentation can use PDF.js directly.
    if (ext === 'ppt' || ext === 'pptx') {
      try {
        const converted = await convertPresentation({
          sourcePath: file.path,
          originalName,
          sourceId: id,
          uploadedBy: 'controller',
        });
        return res.status(201).json({
          id: converted.id,
          name: converted.name || converted.filename || originalName.replace(/\.(ppt|pptx)$/i, '.pdf'),
          type: 'pdf',
          size: converted.size || 0,
          url: converted.url,
          sourceName: originalName,
          converted: true,
          status: converted.status || 'ready',
        });
      } catch (err) {
        const status = /LibreOffice failed to start/i.test(err.message) ? 503 : 500;
        return res.status(status).json({
          ok: false,
          error: err.message,
          hint: 'Install LibreOffice and set LIBREOFFICE_BIN in .env',
          sourceId: id,
        });
      }
    }

    res.status(201).json({
      id,
      name: originalName,
      type: ext,
      size: file.size || 0,
      url,
      converted: false,
    });
  })
);

module.exports = router;
