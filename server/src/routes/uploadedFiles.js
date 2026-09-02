const fs = require('fs');
const express = require('express');
const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errors');

const router = express.Router();

function serialize(row) {
  return {
    id: row.id,
    name: row.filename,
    type: row.file_type,
    url: row.public_url,
    size: row.size || 0,
    status: row.status,
    uploadedBy: row.uploaded_by,
    uploadedAt: row.uploaded_at,
  };
}

router.get(
  '/',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const rows = getDb()
      .prepare(
        `SELECT * FROM uploaded_files
         ORDER BY datetime(replace(replace(uploaded_at, 'T', ' '), 'Z', '')) DESC, uploaded_at DESC, id DESC`
      )
      .all();
    res.json({ ok: true, files: rows.map(serialize) });
  })
);

router.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = decodeURIComponent(req.params.id);
    const db = getDb();
    const row = db.prepare(`SELECT * FROM uploaded_files WHERE id = ?`).get(id);
    if (!row) {
      return res.status(404).json({ ok: false, error: 'File not found' });
    }

    if (row.file_path && fs.existsSync(row.file_path)) {
      try {
        fs.unlinkSync(row.file_path);
      } catch (err) {
        console.warn('Could not delete file from disk:', err.message);
      }
    }

    // Also remove converted outputs that point at this source, if any.
    const converted = db
      .prepare(`SELECT * FROM uploaded_files WHERE converted_from_id = ?`)
      .all(id);
    for (const child of converted) {
      if (child.file_path && fs.existsSync(child.file_path)) {
        try {
          fs.unlinkSync(child.file_path);
        } catch (_e) {
          /* ignore */
        }
      }
      db.prepare(`DELETE FROM uploaded_files WHERE id = ?`).run(child.id);
    }

    db.prepare(`DELETE FROM uploaded_files WHERE id = ?`).run(id);
    db.prepare(`INSERT INTO audit_logs (actor, action, detail) VALUES (?, 'uploaded_file_delete', ?)`).run(
      req.user.username,
      id
    );

    res.json({ ok: true, deleted: id });
  })
);

module.exports = router;
