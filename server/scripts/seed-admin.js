#!/usr/bin/env node
const bcrypt = require('bcryptjs');
const { config, ensureDirs } = require('../src/config');
const { migrate, getDb, closeDb } = require('../src/db');

ensureDirs();
migrate();

const username = process.argv[2] || config.adminUsername;
const password = process.argv[3] || config.adminPassword;
const hash = bcrypt.hashSync(password, 10);
const db = getDb();

const existing = db.prepare(`SELECT id FROM users WHERE username = ?`).get(username);
if (existing) {
  db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(hash, existing.id);
  console.log(`Updated password for user "${username}"`);
} else {
  db.prepare(`INSERT INTO users (username, password_hash) VALUES (?, ?)`).run(username, hash);
  console.log(`Created admin user "${username}"`);
}

closeDb();
