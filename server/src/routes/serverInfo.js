const os = require('os');
const express = require('express');
const { config } = require('../config');
const { asyncHandler } = require('../middleware/errors');

const router = express.Router();

function requestProtocol(req) {
  if (req.secure || req.app.get('secure')) return 'https';
  const xf = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  if (xf) return xf;
  return req.protocol || 'http';
}

function getLanAddresses(req) {
  const protocol = requestProtocol(req);
  const port = config.enableHttps
    ? (config.httpsPort === 443 ? '' : `:${config.httpsPort}`)
    : (config.port === 80 ? '' : `:${config.port}`);
  const addresses = [];
  for (const items of Object.values(os.networkInterfaces())) {
    for (const item of items || []) {
      if ((item.family === 'IPv4' || item.family === 4) && !item.internal) {
        addresses.push(`${protocol}://${item.address}${port}`);
      }
    }
  }
  const host = req.headers.host || `localhost:${config.enableHttps ? config.httpsPort : config.port}`;
  const currentOrigin = `${protocol}://${host}`;
  return { currentOrigin, lanOrigins: addresses, protocol };
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const info = getLanAddresses(req);
    const origin = info.lanOrigins[0] || info.currentOrigin;
    res.json({
      port: config.enableHttps ? config.httpsPort : config.port,
      https: info.protocol === 'https',
      currentOrigin: info.currentOrigin,
      lanOrigins: info.lanOrigins,
      presentationUrl: `${origin}/presentation`,
      displayUrl: `${origin}/display`,
      adminUrl: `${origin}/admin`,
      idleUrl: `${origin}/idle`,
      screenShareHint:
        info.protocol === 'https'
          ? 'Secure context ready for browser screen sharing.'
          : 'Use HTTPS (npm run generate-certs + ENABLE_HTTPS=true) or open localhost for screen sharing.',
    });
  })
);

module.exports = router;
