const fs = require('fs');
const path = require('path');
const express = require('express');
const { optionalAuth } = require('../middleware/auth');
const { presentationUpload } = require('../middleware/upload');
const { asyncHandler } = require('../middleware/errors');
const { convertPresentation } = require('../services/conversionService');
const { getDb } = require('../db');
const { config } = require('../config');

const router = express.Router();

// LAN controllers are not admin-authenticated; conversion is open on the local network.
router.post(
  '/',
  optionalAuth,
  presentationUpload.single('file'),
  asyncHandler(async (req, res) => {
    let sourcePath = null;
    let originalName = null;
    let sourceId = null;

    if (req.file) {
      sourcePath = req.file.path;
      originalName = req.file.originalname;
      const id = `${Date.now().toString(36)}-${require('crypto').randomBytes(4).toString('hex')}`;
      sourceId = id;
      getDb()
        .prepare(
          `INSERT INTO uploaded_files
             (id, filename, file_type, file_path, public_url, size, status, uploaded_by, uploaded_at)
           VALUES (?, ?, ?, ?, ?, ?, 'uploaded', ?, datetime('now'))`
        )
        .run(
          id,
          req.file.originalname || req.file.filename,
          path.extname(req.file.originalname || '').slice(1).toLowerCase() || 'pptx',
          req.file.path,
          `/presentation_uploads/${req.file.filename}`,
          req.file.size || 0,
          req.user?.username || null
        );
    } else if (req.body?.fileId) {
      const row = getDb().prepare(`SELECT * FROM uploaded_files WHERE id = ?`).get(req.body.fileId);
      if (!row) return res.status(404).json({ ok: false, error: 'source file not found' });
      sourcePath = row.file_path;
      originalName = row.filename;
      sourceId = row.id;
    } else if (req.body?.url) {
      const urlPath = String(req.body.url).replace(/^https?:\/\/[^/]+/, '');
      if (urlPath.startsWith('/presentation_uploads/')) {
        sourcePath = path.join(config.presentationsDir, path.basename(urlPath));
        originalName = path.basename(urlPath);
        const row = getDb().prepare(`SELECT * FROM uploaded_files WHERE public_url = ?`).get(urlPath);
        sourceId = row ? row.id : null;
      } else {
        return res.status(400).json({ ok: false, error: 'unsupported url' });
      }
    } else {
      return res.status(400).json({ ok: false, error: 'file, fileId, or url is required' });
    }

    const ext = path.extname(originalName || '').toLowerCase();
    if (!['.ppt', '.pptx'].includes(ext)) {
      return res.status(400).json({ ok: false, error: 'only .ppt and .pptx can be converted' });
    }

    if (sourceId) {
      const existing = getDb()
        .prepare(
          `SELECT * FROM uploaded_files
           WHERE converted_from_id = ?
             AND lower(file_type) = 'pdf'
             AND coalesce(status, '') IN ('ready', 'uploaded', 'converted')
           ORDER BY datetime(uploaded_at) DESC
           LIMIT 1`
        )
        .get(sourceId);
      if (existing && existing.file_path && fs.existsSync(existing.file_path)) {
        return res.json({
          ok: true,
          id: existing.id,
          source_name: originalName,
          converted_type: 'pdf',
          url: existing.public_url,
          name: existing.filename,
          type: 'pdf',
          size: existing.size || 0,
          status: existing.status || 'ready',
          reused: true,
        });
      }
    }

    try {
      const result = await convertPresentation({
        sourcePath,
        originalName,
        sourceId,
        uploadedBy: req.user?.username || 'controller',
      });
      res.status(201).json({ ok: true, ...result });
    } catch (err) {
      const status = /LibreOffice failed to start/i.test(err.message) ? 503 : 500;
      res.status(status).json({
        ok: false,
        error: err.message,
        hint: 'Install LibreOffice and set LIBREOFFICE_BIN in .env',
      });
    }
  })
);

module.exports = router;
