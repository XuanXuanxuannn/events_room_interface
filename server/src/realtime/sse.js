const clients = new Map();

function roomKey(room) {
  return String(room || '12345678').replace(/\s/g, '') || '12345678';
}

function addClient(room, res) {
  const key = roomKey(room);
  if (!clients.has(key)) clients.set(key, new Set());
  clients.get(key).add(res);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
  res.write('event: ready\n');
  res.write(`data: ${JSON.stringify({ ok: true, room: key })}\n\n`);

  const ping = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch (_e) {
      /* ignore */
    }
  }, 25000);

  res.on('close', () => {
    clearInterval(ping);
    const set = clients.get(key);
    if (set) set.delete(res);
  });

  return key;
}

function broadcast(room, payload) {
  const key = roomKey(room);
  const set = clients.get(key);
  if (!set) return;
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of Array.from(set)) {
    try {
      res.write(data);
    } catch (_e) {
      set.delete(res);
    }
  }
}

function clientCount(room) {
  const set = clients.get(roomKey(room));
  return set ? set.size : 0;
}

module.exports = { addClient, broadcast, roomKey, clientCount };
