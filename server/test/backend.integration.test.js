const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const bcrypt = require('bcryptjs');

// Add an isolated temporary storage folder so tests remains outside
const TEST_DATA_DIR = fs.mkdtempSync(
  path.join(os.tmpdir(), 'events-room-health-test-')
);

process.env.NODE_ENV = 'test';
process.env.DATA_DIR = TEST_DATA_DIR;
process.env.CORS_ORIGINS = '*';

const { ensureDirs } = require('../src/config');
const { migrate, getDb, closeDb } = require('../src/db');
const { createApp } = require('../src/app');

let server;
let baseUrl;

function seedAdmin(username = 'admin', password = 'cbrin123') {
  const hash = bcrypt.hashSync(password, 10);
  const db = getDb();

  const existing = db
    .prepare('SELECT id FROM users WHERE username = ?')
    .get(username);

  if (existing) {
    db.prepare(
      'UPDATE users SET password_hash = ? WHERE id = ?'
    ).run(hash, existing.id);
  } else {
    db.prepare(
      'INSERT INTO users (username, password_hash) VALUES (?, ?)'
    ).run(username, hash);
  }
}

// upload demo pdf for test
async function uploadPdf(filename = 'demo.pdf') {
  const form = new FormData();

  form.append(
    'file',
    new Blob(
      [Buffer.from('%PDF-1.4\nmock test pdf\n')],
      { type: 'application/pdf' }
    ),
    filename
  );

  const response = await fetch(
    `${baseUrl}/api/presentation-files`,
    {
      method: 'POST',
      body: form,
    }
  );

  const body = await response.json();

  return {
    response,
    body,
  };
}

async function loginAdmin() {
  seedAdmin();

  const response = await fetch(
    `${baseUrl}/api/auth/login`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'admin',
        password: 'cbrin123',
      }),
    }
  );

  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.ok(body.token);

  return body.token;
}

before(async () => {
  ensureDirs();
  migrate();

  const app = createApp();

  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });

  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }

  closeDb();

  fs.rmSync(TEST_DATA_DIR, {
    recursive: true,
    force: true,
  });
});

// Test 1 - Healthy API
test('health: database and storage are ready', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.service, 'events-room-server');
  assert.equal(body.db, 'up');
  assert.equal(body.storage, 'writable');
});

// Test 2 - Invalid Login
test('auth: incorrect password is rejected', async () => {
  seedAdmin();

  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username: 'admin',
      password: 'wrong-password',
    }),
  });

  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.ok, false);
  assert.equal(body.error, 'invalid credentials');

  const sessionCount = getDb()
    .prepare('SELECT COUNT(*) AS count FROM sessions')
    .get()
    .count;

  assert.equal(sessionCount, 0);
});

//Test 3 - Authentication
test('auth: uploaded-files requires admin authentication', async () => {
  const response = await fetch(`${baseUrl}/api/uploaded-files`);
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.ok, false);
  assert.equal(body.error, 'unauthorized');
});

//Test 4 - Pdf upload
test('upload: PDF is written to SQLite and disk', async () => {
  const { response, body } = await uploadPdf('team-demo.pdf');

  assert.equal(response.status, 201);
  assert.equal(body.name, 'team-demo.pdf');
  assert.equal(body.type, 'pdf');
  assert.ok(body.id);
  assert.match(body.url, /^\/presentation_uploads\//);

  const row = getDb()
    .prepare('SELECT * FROM uploaded_files WHERE id = ?')
    .get(body.id);

  assert.ok(row);
  assert.equal(row.filename, 'team-demo.pdf');
  assert.equal(row.file_type, 'pdf');
  assert.equal(row.status, 'uploaded');
  assert.equal(fs.existsSync(row.file_path), true);
  assert.equal(row.file_path.startsWith(TEST_DATA_DIR), true);
});

//Test 5 - Pre list
test('upload: uploaded presentation appears in list', async () => {
  const upload = await uploadPdf('weekly-presentation.pdf');

  assert.equal(upload.response.status, 201);

  const response = await fetch(`${baseUrl}/api/presentation-files`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.ok(Array.isArray(body.files));

  const listedFile = body.files.find(
    (file) => file.id === upload.body.id
  );

  assert.ok(listedFile);
  assert.equal(listedFile.name, 'weekly-presentation.pdf');
  assert.equal(listedFile.type, 'pdf');
  assert.equal(listedFile.url, upload.body.url);
});

//Test 6 - Delete file
test('delete: admin deletion removes DB row and physical file', async () => {
  const upload = await uploadPdf('delete-me.pdf');

  assert.equal(upload.response.status, 201);

  const id = upload.body.id;

  const row = getDb()
    .prepare('SELECT * FROM uploaded_files WHERE id = ?')
    .get(id);

  assert.ok(row);
  assert.equal(fs.existsSync(row.file_path), true);

  const token = await loginAdmin();

  const response = await fetch(
    `${baseUrl}/api/uploaded-files/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.deleted, id);

  const deletedRow = getDb()
    .prepare('SELECT * FROM uploaded_files WHERE id = ?')
    .get(id);

  assert.equal(deletedRow, undefined);
  assert.equal(fs.existsSync(row.file_path), false);
});