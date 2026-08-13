const fs = require('fs');
const path = require('path');
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const { config } = require('../config');
const { requireAuth } = require('../middleware/auth');
const { idleImageUpload } = require('../middleware/upload');
const { asyncHandler } = require('../middleware/errors');

const router = express.Router();

function serialize(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    description: row.description || '',
    src: row.src,
    fileName: row.file_name,
    uploadedAt: row.uploaded_at,
    displayOrder: row.display_order,
    isActive: !!row.is_active,
  };
}

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const rows = getDb()
      .prepare(
        `SELECT * FROM idle_slides WHERE is_active = 1
         ORDER BY display_order ASC, uploaded_at ASC`
      )
      .all();
    res.json(rows.map(serialize));
  })
);

router.post(
  '/',
  requireAuth,
  idleImageUpload.single('image'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'Please upload an image file.' });
    }
    const id = `${Date.now().toString(36)}-${uuidv4().slice(0, 8)}`;
    const storedName = req.file.filename;
    const src = `/uploads/${storedName}`;
    const title =
      String(req.body.title || path.basename(req.file.originalname, path.extname(req.file.originalname)) || 'Untitled Slide').trim();
    const description = String(req.body.description || 'A backend stored idle slide.').trim();
    const type = String(req.body.type || 'event').trim().toLowerCase();
    const uploadedAt = new Date().toISOString();

    getDb()
      .prepare(
        `INSERT INTO idle_slides (id, type, title, description, src, file_name, uploaded_at, display_order, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1)`
      )
      .run(id, type, title, description, src, req.file.originalname, uploadedAt);

    getDb()
      .prepare(`INSERT INTO audit_logs (actor, action, detail) VALUES (?, 'idle_slide_create', ?)`)
      .run(req.user.username, id);

    res.status(201).json({
      id,
      type,
      title,
      description,
      src,
      fileName: req.file.originalname,
      uploadedAt,
    });
  })
);

router.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = decodeURIComponent(req.params.id);
    const db = getDb();
    const target = db.prepare(`SELECT * FROM idle_slides WHERE id = ?`).get(id);
    if (target && target.src && target.src.startsWith('/uploads/')) {
      const filePath = path.join(config.uploadsDir, path.basename(target.src));
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          console.warn('Could not delete image file:', err.message);
        }
      }
    }
    db.prepare(`DELETE FROM idle_slides WHERE id = ?`).run(id);
    db.prepare(`INSERT INTO audit_logs (actor, action, detail) VALUES (?, 'idle_slide_delete', ?)`).run(
      req.user.username,
      id
    );
    res.json({ ok: true, deleted: id });
  })
);

module.exports = router;
