const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const ADMIN_HTML = path.join(ROOT, 'Admin_cbrin_backend_storage.html');
const IDLE_HTML = path.join(ROOT, 'idle_display_cbrin.html');
const PRESENTATION_HTML = path.join(ROOT, 'presentation_cbrin_mobile_display.html');
const DATA_DIR = path.join(ROOT, 'data');
const UPLOAD_DIR = path.join(ROOT, 'uploads');
const PRESENTATION_UPLOAD_DIR = path.join(ROOT, 'presentation_uploads');
const SLIDES_FILE = path.join(DATA_DIR, 'idle-slides.json');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(PRESENTATION_UPLOAD_DIR, { recursive: true });

const presentationClients = new Map();
const presentationSessions = new Map();
const presentationStates = new Map();
const PRESENTATION_SESSION_TTL = 15000;
function cleanPresentationSessions(room) {
  const key = String(room || '12345678').replace(/\s/g, '') || '12345678';
  const now = Date.now();
  const state = presentationSessions.get(key);
  if (!state) return {};
  for (const role of ['controller', 'display']) {
    if (state[role] && now - state[role].lastSeen > PRESENTATION_SESSION_TTL) delete state[role];
  }
  return state;
}
function getPresentationSessionState(room) {
  const key = String(room || '12345678').replace(/\s/g, '') || '12345678';
  const state = cleanPresentationSessions(key);
  presentationSessions.set(key, state);
  return { key, state };
}
async function handlePresentationPresence(req, res) {
  try {
    const body = await collectBody(req);
    const payload = JSON.parse(body.toString('utf8') || '{}');
    const room = String(payload.room || '12345678').replace(/\s/g, '') || '12345678';
    const role = payload.role === 'display' ? 'display' : 'controller';
    const action = payload.action || 'join';
    const clientId = String(payload.clientId || '').trim();
    const { key, state } = getPresentationSessionState(room);
    if (action === 'clear-display') {
      delete state.display;
      presentationSessions.set(key, state);
      sendPresentationEvent(key, { command:'presence', room:key, role:'display', status:'left', at:Date.now() });
      return sendJson(res, 200, { ok:true, room:key, role:'display', active:state });
    }
    if (action === 'clear-room') {
      delete state.display;
      delete state.controller;
      presentationSessions.set(key, state);
      presentationStates.delete(key);
      sendPresentationEvent(key, { command:'exit', room:key, seq:Date.now(), sender:'server-clear', at:Date.now() });
      return sendJson(res, 200, { ok:true, room:key, role:'all', active:state });
    }
    if (!clientId) return sendJson(res, 400, { ok:false, error:'Missing client id.' });
    if (action === 'leave') {
      if (state[role] && state[role].clientId === clientId) {
        delete state[role];
        sendPresentationEvent(key, { command:'presence', room:key, role, status:'left', at:Date.now() });
      }
      presentationSessions.set(key, state);
      return sendJson(res, 200, { ok:true, room:key, role, active:state });
    }
    const existing = state[role];
    if (existing && existing.clientId !== clientId) {
      return sendJson(res, 409, {
        ok:false,
        room:key,
        role,
        error: role === 'controller'
          ? 'Another controller is already connected to this room. Please disconnect it before joining.'
          : 'Another display screen is already connected to this room. Please close it before joining.'
      });
    }
    state[role] = { clientId, role, lastSeen: Date.now(), userAgent: String(payload.userAgent || '') };
    presentationSessions.set(key, state);
    sendPresentationEvent(key, { command:'presence', room:key, role, status:'joined', active:state, at:Date.now() });
    return sendJson(res, 200, { ok:true, room:key, role, active:state });
  } catch (err) {
    console.error('Presentation presence failed:', err);
    sendJson(res, 400, { ok:false, error:'Bad presence request: ' + err.message });
  }
}
function sendPresentationEvent(room, payload) {
  const key = String(room || '12345678').replace(/\s/g, '') || '12345678';
  const clients = presentationClients.get(key);
  if (!clients) return;
  const data = 'data: ' + JSON.stringify(payload) + '\n\n';
  for (const res of Array.from(clients)) {
    try { res.write(data); } catch (e) { clients.delete(res); }
  }
}
function addPresentationClient(room, res) {
  const key = String(room || '12345678').replace(/\s/g, '') || '12345678';
  if (!presentationClients.has(key)) presentationClients.set(key, new Set());
  presentationClients.get(key).add(res);
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  res.write('event: ready\n');
  res.write('data: ' + JSON.stringify({ ok:true, room:key }) + '\n\n');
  const state = presentationStates.get(key);
  if (state && state.active && state.presentation) {
    res.write('data: ' + JSON.stringify({ command:'start', room:key, seq:state.seq || Date.now(), presentation:state.presentation, at:Date.now(), sender:'server' }) + '\n\n');
    if (state.page || state.zoom) res.write('data: ' + JSON.stringify({ command:'sync', room:key, seq:(state.seq || Date.now()) + 1, page:state.page || 1, zoom:state.zoom || 1, panX:state.panX || 0, panY:state.panY || 0, panRatioX:state.panRatioX, panRatioY:state.panRatioY, panUnitX:state.panUnitX, panUnitY:state.panUnitY, presentationId:state.presentationId || state.presentation.id || null, sender:'server', at:Date.now() }) + '\n\n');
  }
  const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch(e) {} }, 25000);
  res.on('close', () => {
    clearInterval(ping);
    const set = presentationClients.get(key);
    if (set) set.delete(res);
  });
}


function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    ...headers
  });
  res.end(body);
}

function sendJson(res, status, data) {
  send(res, status, JSON.stringify(data, null, 2), { 'Content-Type': 'application/json; charset=utf-8' });
}

function readSlides() {
  if (!fs.existsSync(SLIDES_FILE)) {
    const seedSlides = [
      {
        id: 'demo-1',
        type: 'event',
        title: 'Design Futures Meetup',
        description: 'Default backend demo slide. Upload real images from the admin page.',
        src: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80',
        fileName: 'remote-demo-1.jpg',
        uploadedAt: new Date().toISOString()
      },
      {
        id: 'demo-2',
        type: 'partner',
        title: 'Canberra Innovation Network',
        description: 'Default backend demo slide. This will be stored in data/idle-slides.json.',
        src: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80',
        fileName: 'remote-demo-2.jpg',
        uploadedAt: new Date().toISOString()
      }
    ];
    fs.writeFileSync(SLIDES_FILE, JSON.stringify(seedSlides, null, 2));
    return seedSlides;
  }
  try {
    return JSON.parse(fs.readFileSync(SLIDES_FILE, 'utf8'));
  } catch (err) {
    console.error('Could not read slides JSON:', err);
    return [];
  }
}

function writeSlides(slides) {
  fs.writeFileSync(SLIDES_FILE, JSON.stringify(slides, null, 2));
}


function getLanAddresses(req) {
  const addresses = [];
  const port = PORT === 80 ? '' : ':' + PORT;
  for (const items of Object.values(os.networkInterfaces())) {
    for (const item of items || []) {
      if (item.family === 'IPv4' && !item.internal) {
        addresses.push(`http://${item.address}${port}`);
      }
    }
  }
  const host = req.headers.host || `localhost:${PORT}`;
  const currentOrigin = `http://${host}`;
  return { currentOrigin, lanOrigins: addresses };
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.js') return 'text/javascript; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.ppt') return 'application/vnd.ms-powerpoint';
  if (ext === '.pptx') return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.svg') return 'image/svg+xml';
  return 'application/octet-stream';
}

function collectBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > 30 * 1024 * 1024) {
        reject(new Error('File is too large. Limit is 30MB.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function bufferSplit(buffer, separator) {
  const parts = [];
  let start = 0;
  let index;
  while ((index = buffer.indexOf(separator, start)) !== -1) {
    parts.push(buffer.slice(start, index));
    start = index + separator.length;
  }
  parts.push(buffer.slice(start));
  return parts;
}

function parseMultipart(body, contentTypeHeader) {
  const boundaryMatch = /boundary=(?:(?:"([^"]+)")|([^;]+))/i.exec(contentTypeHeader || '');
  if (!boundaryMatch) throw new Error('Missing multipart boundary.');
  const boundary = Buffer.from('--' + (boundaryMatch[1] || boundaryMatch[2]));
  const rawParts = bufferSplit(body, boundary).slice(1, -1);
  const fields = {};
  const files = {};

  for (let part of rawParts) {
    if (part.slice(0, 2).toString() === '\r\n') part = part.slice(2);
    if (part.slice(-2).toString() === '\r\n') part = part.slice(0, -2);
    const sep = Buffer.from('\r\n\r\n');
    const headerEnd = part.indexOf(sep);
    if (headerEnd === -1) continue;
    const headerText = part.slice(0, headerEnd).toString('utf8');
    let content = part.slice(headerEnd + sep.length);
    const disposition = /content-disposition:\s*form-data;([^\r\n]+)/i.exec(headerText);
    if (!disposition) continue;
    const name = /name="([^"]+)"/i.exec(disposition[1])?.[1];
    const filename = /filename="([^"]*)"/i.exec(disposition[1])?.[1];
    if (!name) continue;
    const type = /content-type:\s*([^\r\n]+)/i.exec(headerText)?.[1]?.trim() || '';
    if (filename) files[name] = { filename, type, content };
    else fields[name] = content.toString('utf8');
  }
  return { fields, files };
}

function safeExtension(filename, mimeType) {
  const ext = path.extname(filename || '').toLowerCase();
  const allowed = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);
  if (allowed.has(ext)) return ext;
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/jpeg') return '.jpg';
  if (mimeType === 'image/gif') return '.gif';
  if (mimeType === 'image/webp') return '.webp';
  if (mimeType === 'image/svg+xml') return '.svg';
  return '.img';
}

function safePresentationExtension(filename, mimeType) {
  const ext = path.extname(filename || '').toLowerCase();
  const allowed = new Set(['.pdf', '.ppt', '.pptx']);
  if (allowed.has(ext)) return ext;
  if (mimeType === 'application/pdf') return '.pdf';
  if (mimeType === 'application/vnd.ms-powerpoint') return '.ppt';
  if (mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') return '.pptx';
  return '';
}

async function handlePresentationFileUpload(req, res) {
  try {
    const body = await collectBody(req);
    const { files } = parseMultipart(body, req.headers['content-type']);
    const file = files.file || files.presentation || Object.values(files)[0];
    if (!file) return send(res, 400, 'Please upload a PDF, PPT, or PPTX file.');
    const ext = safePresentationExtension(file.filename, file.type);
    if (!ext) return send(res, 400, 'Only PDF, PPT, and PPTX files are supported.');
    const id = Date.now().toString(36) + '-' + crypto.randomBytes(4).toString('hex');
    const cleanBase = path.basename(file.filename || ('presentation' + ext)).replace(/[^a-zA-Z0-9._-]+/g, '_');
    const storedName = id + '-' + cleanBase;
    const diskPath = path.join(PRESENTATION_UPLOAD_DIR, storedName);
    fs.writeFileSync(diskPath, file.content);
    return sendJson(res, 201, {
      id,
      name: file.filename || storedName,
      type: ext.slice(1),
      size: file.content.length,
      url: '/presentation_uploads/' + storedName
    });
  } catch (err) {
    console.error('Presentation upload failed:', err);
    send(res, 500, 'Presentation upload failed: ' + err.message);
  }
}

async function handlePresentationCommand(req, res) {
  try {
    const body = await collectBody(req);
    const payload = JSON.parse(body.toString('utf8') || '{}');
    const room = String(payload.room || '12345678').replace(/\s/g, '') || '12345678';
    const eventPayload = {
      command: payload.command || 'unknown',
      room,
      seq: payload.seq || Date.now(),
      presentation: payload.presentation || null,
      presentationId: payload.presentationId || null,
      page: payload.page || null,
      zoom: payload.zoom || null,
      panX: payload.panX || 0,
      panY: payload.panY || 0,
      panRatioX: Number.isFinite(Number(payload.panRatioX)) ? Number(payload.panRatioX) : null,
      panRatioY: Number.isFinite(Number(payload.panRatioY)) ? Number(payload.panRatioY) : null,
      panUnitX: Number.isFinite(Number(payload.panUnitX)) ? Number(payload.panUnitX) : null,
      panUnitY: Number.isFinite(Number(payload.panUnitY)) ? Number(payload.panUnitY) : null,
      viewportW: Number(payload.viewportW) || null,
      viewportH: Number(payload.viewportH) || null,
      orientation: payload.orientation || null,
      sender: payload.sender || null,
      source: payload.source || null,
      clientId: String(payload.clientId || ''),
      direction: Number.isFinite(Number(payload.direction)) ? Number(payload.direction) : null,
      action: payload.action || null,
      fileIndex: Number.isFinite(Number(payload.fileIndex)) ? Number(payload.fileIndex) : null,
      at: Date.now()
    };
    const existingState = presentationStates.get(room) || {};
    if (eventPayload.command === 'start' && eventPayload.presentation) {
      presentationStates.set(room, { active:true, ...existingState, ...eventPayload });
    } else if (eventPayload.command === 'sync') {
      presentationStates.set(room, { ...existingState, active: existingState.active !== false, ...eventPayload, presentation: existingState.presentation || eventPayload.presentation || null });
    } else if (eventPayload.command === 'exit') {
      presentationStates.set(room, { active:false, seq:eventPayload.seq, at:Date.now() });
      // The display usually closes immediately after an exit command. Clear its presence slot now
      // so starting a new presentation does not get blocked by the previous closed demo window.
      const sessionState = cleanPresentationSessions(room);
      if (sessionState.display) {
        delete sessionState.display;
        presentationSessions.set(room, sessionState);
        sendPresentationEvent(room, { command:'presence', room, role:'display', status:'left', at:Date.now() });
      }
    }
    sendPresentationEvent(room, eventPayload);
    sendJson(res, 200, { ok: true, room });
  } catch (err) {
    console.error('Presentation command failed:', err);
    send(res, 400, 'Bad presentation command: ' + err.message);
  }
}

async function handleUpload(req, res) {
  try {
    const body = await collectBody(req);
    const { fields, files } = parseMultipart(body, req.headers['content-type']);
    const image = files.image;
    if (!image || !image.type.startsWith('image/')) {
      send(res, 400, 'Please upload an image file.');
      return;
    }

    const id = Date.now().toString(36) + '-' + crypto.randomBytes(4).toString('hex');
    const ext = safeExtension(image.filename, image.type);
    const storedName = id + ext;
    const diskPath = path.join(UPLOAD_DIR, storedName);
    fs.writeFileSync(diskPath, image.content);

    const slide = {
      id,
      type: String(fields.type || 'event').trim().toLowerCase(),
      title: String(fields.title || path.basename(image.filename, path.extname(image.filename)) || 'Untitled Slide').trim(),
      description: String(fields.description || 'A backend stored idle slide.').trim(),
      src: '/uploads/' + storedName,
      fileName: image.filename,
      uploadedAt: new Date().toISOString()
    };

    const slides = readSlides();
    slides.push(slide);
    writeSlides(slides);
    sendJson(res, 201, slide);
  } catch (err) {
    console.error('Upload failed:', err);
    send(res, 500, 'Upload failed: ' + err.message);
  }
}

function handleDelete(req, res, id) {
  const slides = readSlides();
  const target = slides.find(s => String(s.id) === String(id));
  const next = slides.filter(s => String(s.id) !== String(id));
  if (target && target.src && target.src.startsWith('/uploads/')) {
    const filePath = path.join(ROOT, target.src.replace(/^\//, ''));
    if (filePath.startsWith(UPLOAD_DIR) && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (err) { console.warn('Could not delete image file:', err); }
    }
  }
  writeSlides(next);
  sendJson(res, 200, { ok: true, deleted: id });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === 'OPTIONS') return send(res, 204, '');

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/admin')) {
    return send(res, 200, fs.readFileSync(ADMIN_HTML), { 'Content-Type': 'text/html; charset=utf-8' });
  }
  if (req.method === 'GET' && url.pathname === '/idle') {
    return send(res, 200, fs.readFileSync(IDLE_HTML), { 'Content-Type': 'text/html; charset=utf-8' });
  }
  if (req.method === 'GET' && url.pathname.startsWith('/p/')) {
    const room = decodeURIComponent(url.pathname.slice(3) || '12345678').replace(/\s/g, '') || '12345678';
    res.writeHead(302, { Location: '/presentation?room=' + encodeURIComponent(room) });
    return res.end();
  }
  if (req.method === 'GET' && (url.pathname === '/presentation' || url.pathname === '/display')) {
    return send(res, 200, fs.readFileSync(PRESENTATION_HTML), { 'Content-Type': 'text/html; charset=utf-8' });
  }
  if (req.method === 'GET' && url.pathname === '/api/server-info') {
    const info = getLanAddresses(req);
    const origin = info.lanOrigins[0] || info.currentOrigin;
    return sendJson(res, 200, {
      port: PORT,
      currentOrigin: info.currentOrigin,
      lanOrigins: info.lanOrigins,
      presentationUrl: origin + '/presentation',
      displayUrl: origin + '/display',
      adminUrl: origin + '/admin',
      idleUrl: origin + '/idle'
    });
  }
  if (req.method === 'GET' && url.pathname === '/api/presentation-events') {
    return addPresentationClient(url.searchParams.get('room') || '12345678', res);
  }
  if (req.method === 'POST' && url.pathname === '/api/presentation-presence') {
    return handlePresentationPresence(req, res);
  }
  if (req.method === 'POST' && url.pathname === '/api/presentation-command') {
    return handlePresentationCommand(req, res);
  }
  if (req.method === 'POST' && url.pathname === '/api/presentation-files') {
    return handlePresentationFileUpload(req, res);
  }
  if (req.method === 'GET' && url.pathname.startsWith('/presentation_uploads/')) {
    const requested = path.normalize(url.pathname).replace(/^\/+/, '');
    const filePath = path.join(ROOT, requested);
    if (!filePath.startsWith(PRESENTATION_UPLOAD_DIR) || !fs.existsSync(filePath)) return send(res, 404, 'Not found');
    return send(res, 200, fs.readFileSync(filePath), { 'Content-Type': contentType(filePath) });
  }
  if (req.method === 'GET' && url.pathname === '/api/idle-slides') {
    return sendJson(res, 200, readSlides());
  }
  if (req.method === 'POST' && url.pathname === '/api/idle-slides') {
    return handleUpload(req, res);
  }
  if (req.method === 'DELETE' && url.pathname.startsWith('/api/idle-slides/')) {
    const id = decodeURIComponent(url.pathname.split('/').pop());
    return handleDelete(req, res, id);
  }
  if (req.method === 'GET' && url.pathname.startsWith('/uploads/')) {
    const requested = path.normalize(url.pathname).replace(/^\/+/, '');
    const filePath = path.join(ROOT, requested);
    if (!filePath.startsWith(UPLOAD_DIR) || !fs.existsSync(filePath)) return send(res, 404, 'Not found');
    return send(res, 200, fs.readFileSync(filePath), { 'Content-Type': contentType(filePath) });
  }

  return send(res, 404, 'Not found');
});

server.listen(PORT, () => {
  console.log(`CBRIN image server running: http://localhost:${PORT}`);
  console.log('Admin page:', `http://localhost:${PORT}/admin`);
  console.log('Idle display:', `http://localhost:${PORT}/idle`);
  console.log('Presentation page:', `http://localhost:${PORT}/presentation`);
  const nets = Object.values(os.networkInterfaces()).flat().filter(x => x && x.family === 'IPv4' && !x.internal);
  nets.forEach(x => console.log('LAN presentation:', `http://${x.address}:${PORT}/presentation`));
  console.log('Images are stored in:', UPLOAD_DIR);
  console.log('Slide metadata is stored in:', SLIDES_FILE);
});
