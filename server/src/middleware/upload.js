const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { config } = require('../config');

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);
const PRESENTATION_EXTS = new Set(['.pdf', '.ppt', '.pptx']);

function safeBase(name) {
  return path.basename(name || 'file').replace(/[^a-zA-Z0-9._-]+/g, '_');
}

const idleImageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, config.uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.img';
    cb(null, `${Date.now().toString(36)}-${uuidv4().slice(0, 8)}${ext}`);
  },
});

const presentationStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, config.presentationsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const id = `${Date.now().toString(36)}-${uuidv4().slice(0, 8)}`;
    cb(null, `${id}-${safeBase(file.originalname || `presentation${ext}`)}`);
  },
});

const limits = { fileSize: config.maxUploadMb * 1024 * 1024 };

const idleImageUpload = multer({
  storage: idleImageStorage,
  limits,
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!IMAGE_EXTS.has(ext) && !(file.mimetype || '').startsWith('image/')) {
      return cb(new Error('Please upload an image file.'));
    }
    cb(null, true);
  },
});

const presentationUpload = multer({
  storage: presentationStorage,
  limits,
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!PRESENTATION_EXTS.has(ext)) {
      return cb(new Error('Only PDF, PPT, and PPTX files are supported.'));
    }
    cb(null, true);
  },
});

module.exports = {
  idleImageUpload,
  presentationUpload,
  IMAGE_EXTS,
  PRESENTATION_EXTS,
  safeBase,
};
