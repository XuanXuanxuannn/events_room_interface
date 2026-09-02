# Events Room Production Server (LAN / On-Prem)

Node.js Express + Socket.IO backend for the CBRIN Events Room demo UI.

Replaces the single-file demo server and the Flask `:5000` screen-share dependency with one process on port `3000`.

## Features

- Admin auth (`POST /api/auth/login`) with bcrypt + bearer/session tokens
- SQLite persistence for users, idle slides, uploads, rooms, presence, presentation state, screen share
- Demo-compatible APIs: idle slides, presentation SSE sync, presence, uploads
- Socket.IO WebRTC signaling for screen share (same origin)
- LibreOffice-powered PPT/PPTX → PDF conversion on upload (`POST /api/presentation-files`) and via `/api/convert-presentation`
- Health checks, rate limits, cleanup jobs, systemd + kiosk docs

## Quick start

```bash
cd server
cp .env.example .env
npm install
npm run migrate
npm run seed-admin
npm run generate-certs   # required for LAN screen sharing
# ensure ENABLE_HTTPS=true in .env
# For PPT/PPTX uploads, install LibreOffice and set LIBREOFFICE_BIN
npm start
```

Open:

- Admin: `https://localhost:3000/admin` (or `http://` if HTTPS is off)
- Idle: `https://localhost:3000/idle`
- Presentation: `https://localhost:3000/presentation`
- Health: `https://localhost:3000/api/health`

**Uploads:** default limit is `MAX_UPLOAD_MB=100`. PPT/PPTX are converted to PDF on the server during upload (requires LibreOffice). Prefer uploading PDF when you can.

**Screen sharing:** browsers block capture on `http://LAN-IP`. Use HTTPS (above) or open presentation on the presenting PC via `https://localhost:3000/presentation`.

Default admin (change after first login):

```text
username: admin
password: cbrin123
```

Override via `.env` / `npm run seed-admin -- myuser mypass`.

## LAN room PC + Raspberry Pi

1. Run this server on the **room PC** (recommended for conversion CPU).
2. On the Pi kiosk:

```bash
chromium-browser --kiosk --noerrdialogs --disable-infobars http://ROOM_PC_IP:3000/idle
```

3. On the display machine for presentations:

```bash
chromium --kiosk http://ROOM_PC_IP:3000/display?room=ROOM_CODE
```

See [deploy/DEPLOY.md](deploy/DEPLOY.md) for systemd, firewall, backup, and LibreOffice setup.

## API overview

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/auth/login` | no | Admin login |
| GET | `/api/auth/me` | yes | Current admin |
| GET/POST/DELETE | `/api/idle-slides` | write=yes | Billboard CRUD |
| POST | `/api/presentation-files` | no | Upload PDF/PPT/PPTX (PPT→PDF on upload) |
| GET | `/api/presentation-events` | no | SSE sync |
| POST | `/api/presentation-presence` | clear-room=yes | Join/leave/clear |
| POST | `/api/presentation-command` | no | start/sync/exit |
| POST | `/api/rooms` | yes | Create room |
| GET | `/api/rooms/:code` | no | Room status |
| POST | `/api/screen-share/session` | yes | Create share room |
| GET | `/api/screen/state` | no | Current mode |
| POST | `/api/convert-presentation` | no (LAN) | PPT/PPTX → PDF |
| GET | `/api/server-info` | no | LAN URLs |
| GET | `/api/health` | no | Liveness |

## Storage

```text
storage/
  app.db
  uploads/          # idle images → /uploads/*
  presentations/    # decks → /presentation_uploads/*
  converted/        # PDFs → /converted/*
```

## Scripts

```bash
npm start              # production listen
npm run dev            # watch mode (Node 18+)
npm run migrate        # apply schema
npm run seed-admin     # create/update admin
npm run backup         # copy DB + files to storage/backups/
```
