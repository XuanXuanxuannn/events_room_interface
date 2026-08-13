#!/usr/bin/env node
const { ensureDirs } = require('../src/config');
const { migrate, closeDb } = require('../src/db');

ensureDirs();
migrate();
console.log('Migrations applied.');
closeDb();
