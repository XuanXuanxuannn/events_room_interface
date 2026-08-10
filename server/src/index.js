const http = require('http');
const https = require('https');
const os = require('os');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const { config, ensureDirs } = require('./config');
const { migrate, getDb, closeDb } = require('./db');
const { createApp } = require('./app');
const { attachSocketHandlers } = require('./realtime/socket');
const { startCleanupScheduler } = require('./services/cleanupService');

function seedAdminIfNeeded() {
  const db = getDb();
  const count = db.prepare(`SELECT COUNT(*) AS c FROM users`).get().c;
  if (count > 0) return;
  const hash = bcrypt.hashSync(config.adminPassword, 10);
  db.prepare(`INSERT INTO users (username, password_hash) VALUES (?, ?)`).run(
    config.adminUsername,
    hash
  );
  console.log(`Seeded admin user: ${config.adminUsername}`);
}

function seedIdleSlidesIfNeeded() {
  const db = getDb();
  const count = db.prepare(`SELECT COUNT(*) AS c FROM idle_slides`).get().c;
  if (count > 0) return;

  const seedPath = path.join(config.dataDir, 'idle-slides-seed.json');
  let slides = [];
  if (fs.existsSync(seedPath)) {
    try {
      slides = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
    } catch (_e) {
      slides = [];
    }
  }
  if (!Array.isArray(slides) || !slides.length) {
    slides = [
      {
        id: 'demo-1',
        type: 'event',
        title: 'Design Futures Meetup',
        description: 'Default backend demo slide. Upload real images from the admin page.',
        src: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80',
        fileName: 'remote-demo-1.jpg',
        uploadedAt: new Date().toISOString(),
      },
      {
        id: 'demo-2',
        type: 'partner',
        title: 'Canberra Innovation Network',
        description: 'Default backend demo slide stored in SQLite.',
        src: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80',
        fileName: 'remote-demo-2.jpg',
        uploadedAt: new Date().toISOString(),
      },
    ];
  }

  const insert = db.prepare(
    `INSERT INTO idle_slides (id, type, title, description, src, file_name, uploaded_at, display_order, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`
  );
  const tx = db.transaction((rows) => {
    rows.forEach((s, i) => {
      insert.run(
        String(s.id),
        s.type || 'event',
        s.title || 'Untitled',
        s.description || '',
        s.src,
        s.fileName || s.file_name || null,
        s.uploadedAt || s.uploaded_at || new Date().toISOString(),
        i
      );
    });
  });
  tx(slides);
  console.log(`Seeded ${slides.length} idle slides`);
}

function loadTlsOptions() {
  if (!config.enableHttps) return null;
  if (!fs.existsSync(config.certKeyPath) || !fs.existsSync(config.certPath)) {
    console.warn('ENABLE_HTTPS=true but certs are missing.');
    console.warn('Run: npm run generate-certs');
    return null;
  }
  return {
    key: fs.readFileSync(config.certKeyPath),
    cert: fs.readFileSync(config.certPath),
  };
}

function printListenInfo(protocol, port) {
  console.log(`Events Room server listening on ${protocol}://${config.host}:${port}`);
  console.log(`Admin: ${protocol}://localhost:${port}/admin`);
  console.log(`Idle:  ${protocol}://localhost:${port}/idle`);
  console.log(`Presentation: ${protocol}://localhost:${port}/presentation`);
  console.log(`Health: ${protocol}://localhost:${port}/api/health`);
  const nets = Object.values(os.networkInterfaces())
    .flat()
    .filter((x) => x && (x.family === 'IPv4' || x.family === 4) && !x.internal);
  nets.forEach((x) => console.log(`LAN: ${protocol}://${x.address}:${port}/admin`));
  if (protocol === 'https') {
    console.log('Note: accept the self-signed certificate warning once in each browser for screen sharing.');
  }
  console.log(`SQLite: ${config.dbPath}`);
}

function main() {
  ensureDirs();
  migrate();
  seedAdminIfNeeded();
  seedIdleSlidesIfNeeded();

  const app = createApp();
  // Express behind HTTPS needs correct protocol for redirects / URL builders
  app.enable('trust proxy');

  const tls = loadTlsOptions();
  const useHttps = !!tls;
  const server = useHttps ? https.createServer(tls, app) : http.createServer(app);
  const listenPort = useHttps ? config.httpsPort : config.port;

  const io = new Server(server, {
    cors: {
      origin: config.corsOrigins.includes('*') ? '*' : config.corsOrigins,
      methods: ['GET', 'POST'],
    },
  });
  app.set('io', io);
  app.set('secure', useHttps);
  attachSocketHandlers(io);
  startCleanupScheduler();

  server.listen(listenPort, config.host, () => {
    printListenInfo(useHttps ? 'https' : 'http', listenPort);
    if (!useHttps) {
      console.log('Screen sharing tip: set ENABLE_HTTPS=true and run npm run generate-certs for LAN IP access.');
    }
  });

  const shutdown = () => {
    console.log('Shutting down...');
    server.close(() => {
      closeDb();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main();
