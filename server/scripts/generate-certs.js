#!/usr/bin/env node
/**
 * Generate a LAN-friendly self-signed certificate for screen sharing.
 * Browsers only allow getDisplayMedia on HTTPS or localhost.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const selfsigned = require('selfsigned');

async function main() {
  const certDir = path.resolve(__dirname, '..', 'storage', 'certs');
  fs.mkdirSync(certDir, { recursive: true });

  const lanIps = Object.values(os.networkInterfaces())
    .flat()
    .filter((x) => x && (x.family === 'IPv4' || x.family === 4) && !x.internal)
    .map((x) => x.address);

  const altNames = [
    { type: 2, value: 'localhost' },
    { type: 2, value: 'events-room.local' },
    { type: 7, ip: '127.0.0.1' },
    ...lanIps.map((ip) => ({ type: 7, ip })),
  ];

  const attrs = [{ name: 'commonName', value: 'CBRIN Events Room LAN' }];
  const pems = await selfsigned.generate(attrs, {
    keySize: 2048,
    days: 825,
    algorithm: 'sha256',
    extensions: [
      { name: 'basicConstraints', cA: true },
      {
        name: 'subjectAltName',
        altNames,
      },
    ],
  });

  const keyPath = path.join(certDir, 'key.pem');
  const certPath = path.join(certDir, 'cert.pem');
  fs.writeFileSync(keyPath, pems.private);
  fs.writeFileSync(certPath, pems.cert);

  console.log('Wrote TLS certs:');
  console.log('  ', keyPath);
  console.log('  ', certPath);
  console.log('SAN hosts/IPs:', ['localhost', '127.0.0.1', ...lanIps].join(', '));
  console.log('');
  console.log('Enable HTTPS in .env:');
  console.log('  ENABLE_HTTPS=true');
  console.log('Then restart: npm start');
  console.log('Open https://YOUR_LAN_IP:3000/presentation (accept the browser warning once).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
