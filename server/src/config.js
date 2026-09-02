const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'storage'));

function resolveLibreOfficeBin() {
  const configured = process.env.LIBREOFFICE_BIN;
  const candidates = [
    configured,
    '/Applications/LibreOffice.app/Contents/MacOS/soffice',
    '/opt/homebrew/bin/soffice',
    '/usr/local/bin/soffice',
    'soffice',
  ].filter(Boolean);
  for (const bin of candidates) {
    if (bin.includes('/') && fs.existsSync(bin)) return bin;
  }
  return configured || 'soffice';
}

const config = {
  port: Number(process.env.PORT || 3000),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  root: ROOT,
  dataDir: DATA_DIR,
  dbPath: path.join(DATA_DIR, 'app.db'),
  uploadsDir: path.join(DATA_DIR, 'uploads'),
  presentationsDir: path.join(DATA_DIR, 'presentations'),
  convertedDir: path.join(DATA_DIR, 'converted'),
  publicDir: path.join(ROOT, 'public'),
  corsOrigins: (process.env.CORS_ORIGINS || '*').split(',').map((s) => s.trim()).filter(Boolean),
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || 'cbrin123',
  sessionTtlHours: Number(process.env.SESSION_TTL_HOURS || 12),
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB || 100),
  presenceTtlMs: Number(process.env.PRESENCE_TTL_MS || 30000),
  roomExpireHours: Number(process.env.ROOM_EXPIRE_HOURS || 12),
  cleanupIntervalMs: Number(process.env.CLEANUP_INTERVAL_MS || 900000),
  libreOfficeBin: resolveLibreOfficeBin(),
  sessionSecret: process.env.SESSION_SECRET || 'dev-only-change-me',
  enableHttps: String(process.env.ENABLE_HTTPS || '').toLowerCase() === 'true',
  httpsPort: Number(process.env.HTTPS_PORT || process.env.PORT || 3000),
  certDir: path.resolve(process.env.CERT_DIR || path.join(DATA_DIR, 'certs')),
  certKeyPath: process.env.TLS_KEY_PATH || path.join(DATA_DIR, 'certs', 'key.pem'),
  certPath: process.env.TLS_CERT_PATH || path.join(DATA_DIR, 'certs', 'cert.pem'),
};

function ensureDirs() {
  for (const dir of [
    config.dataDir,
    config.uploadsDir,
    config.presentationsDir,
    config.convertedDir,
    config.certDir,
  ]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

module.exports = { config, ensureDirs };
