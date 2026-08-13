const { config } = require('../config');

function wantsHtml(req) {
  const accept = String(req.headers.accept || '');
  const secFetch = String(req.headers['sec-fetch-dest'] || '');
  return req.method === 'GET' && (accept.includes('text/html') || secFetch === 'document');
}

function notFound(req, res) {
  // Browser navigations should not land on raw JSON after a bad link / Exit race.
  if (wantsHtml(req)) {
    res.status(404).type('html').send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Page not found</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:Avenir,"Avenir Next",Arial,sans-serif;
    background:radial-gradient(circle at top left,#28197a,#170f49 40%,#140c3f);color:#fff}
  .card{width:min(520px,92vw);background:rgba(45,30,114,.96);border:1px solid rgba(255,255,255,.12);
    border-radius:24px;padding:28px;box-shadow:0 26px 70px rgba(4,2,20,.4)}
  h1{margin:0 0 10px;font-size:28px} p{color:#c7bdf7;line-height:1.6}
  a{display:inline-block;margin:8px 10px 0 0;padding:12px 16px;border-radius:14px;color:#fff;text-decoration:none;
    background:linear-gradient(135deg,#a82e9b,#d24896);font-weight:800}
  code{color:#fff;background:rgba(0,0,0,.25);padding:2px 6px;border-radius:8px}
</style></head><body><div class="card">
  <h1>Page not found</h1>
  <p>No page exists at <code>${String(req.originalUrl || req.url || '/').replace(/</g, '&lt;')}</code>.</p>
  <p>Open one of these instead:</p>
  <p>
    <a href="/admin">Admin</a>
    <a href="/presentation">Presentation</a>
    <a href="/display">Display</a>
    <a href="/idle">Idle</a>
  </p>
</div></body></html>`);
    return;
  }
  res.status(404).json({ ok: false, error: 'Not found' });
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';
  if (status >= 500) {
    console.error(err);
  }
  res.status(status).json({
    ok: false,
    error: message,
    ...(config.nodeEnv !== 'production' && err.stack ? { stack: err.stack } : {}),
  });
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { notFound, errorHandler, asyncHandler };
