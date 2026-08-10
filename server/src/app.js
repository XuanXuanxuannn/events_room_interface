const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const multer = require('multer');

const { config } = require('./config');
const { notFound, errorHandler } = require('./middleware/errors');

const authRoutes = require('./routes/auth');
const healthRoutes = require('./routes/health');
const serverInfoRoutes = require('./routes/serverInfo');
const idleSlidesRoutes = require('./routes/idleSlides');
const presentationsRoutes = require('./routes/presentations');
const roomsRoutes = require('./routes/rooms');
const screenShareRoutes = require('./routes/screenShare');
const screenRoutes = require('./routes/screen');
const convertRoutes = require('./routes/convert');
const uploadedFilesRoutes = require('./routes/uploadedFiles');

function createApp() {
  const app = express();

  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    })
  );

  const corsOrigin =
    config.corsOrigins.includes('*')
      ? true
      : (origin, cb) => {
          if (!origin || config.corsOrigins.includes(origin)) return cb(null, true);
          return cb(new Error('Not allowed by CORS'));
        };

  app.use(
    cors({
      origin: corsOrigin,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  app.use(cookieParser());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
    message: { ok: false, error: 'Too many login attempts. Try again later.' },
  });
  const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use('/api/auth/login', loginLimiter);
  app.use('/api/idle-slides', uploadLimiter);
  app.use('/api/presentation-files', uploadLimiter);
  app.use('/api/convert-presentation', uploadLimiter);

  app.use('/api/auth', authRoutes);
  app.use('/api/health', healthRoutes);
  app.use('/api/server-info', serverInfoRoutes);
  app.use('/api/idle-slides', idleSlidesRoutes);
  app.use('/api', presentationsRoutes);
  app.use('/api/rooms', roomsRoutes);
  app.use('/api/screen-share', screenShareRoutes);
  app.use('/api/screen', screenRoutes);
  app.use('/api/convert-presentation', convertRoutes);
  app.use('/api/uploaded-files', uploadedFilesRoutes);

  app.use('/uploads', express.static(config.uploadsDir, { fallthrough: false }));
  app.use('/presentation_uploads', express.static(config.presentationsDir, { fallthrough: false }));
  app.use('/converted', express.static(config.convertedDir, { fallthrough: false }));

  // Demo HTML pages (same contracts as v3.9)
  const sendHtml = (name) => (req, res) => {
    const filePath = path.join(config.publicDir, name);
    if (!fs.existsSync(filePath)) return res.status(404).send('UI file missing');
    res.sendFile(filePath);
  };

  app.get('/', sendHtml('Admin_cbrin_backend_storage.html'));
  app.get('/admin', sendHtml('Admin_cbrin_backend_storage.html'));
  app.get('/idle', sendHtml('idle_display_cbrin.html'));
  app.get('/presentation', sendHtml('presentation_cbrin_mobile_display.html'));
  app.get('/display', sendHtml('presentation_cbrin_mobile_display.html'));
  app.get('/p/:room', (req, res) => {
    const room = String(req.params.room || '12345678').replace(/\s/g, '') || '12345678';
    res.redirect(`/presentation?room=${encodeURIComponent(room)}`);
  });

  // Avoid noisy JSON 404s for browser icon requests.
  app.get('/favicon.ico', (_req, res) => res.status(204).end());

  app.use(express.static(config.publicDir));

  app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
      err.status = 400;
      err.message = err.code === 'LIMIT_FILE_SIZE'
        ? `File is too large. Limit is ${config.maxUploadMb}MB.`
        : err.message;
    }
    return errorHandler(err, req, res, next);
  });

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
