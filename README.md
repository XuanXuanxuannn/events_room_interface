# CBRIN Smart Event Space Platform

Web-based event-room platform for **Canberra Innovation Network (CBRIN)**. It simplifies how presenters connect to the room display and turns the screen into a branded billboard when idle.

**Client:** Ben Garrett, CBRIN

**Team:** Yuxuan Liu (u7598939), Yiping Zhu (u7747684), Junnao Xiong (u7888908), Kai Kuang (u7628326)

## What it does

Two operating modes:

| Mode | Purpose |
|------|---------|
| **Connection / Presentation** | Wireless join via QR or room code, PDF/PPT/PPTX upload, live slide sync to the room display, optional browser screen share, HDMI fallback path |
| **Billboard (Idle)** | Branded idle slideshow managed from Admin (images, timing) |

Primary runtime is the **Node.js production server** in [`server/`](server/) (Express + Socket.IO + SQLite). It serves Admin, Idle, and Presentation UIs and APIs on one process (port **3000**).

## Repository layout

```text
server/          # Recommended: production LAN/on-prem Node server + UI
  public/        # Admin, idle, presentation HTML
  src/           # Express app, routes, services, SQLite
  storage/       # DB, uploads, presentations, converted PDFs, certs
  deploy/        # systemd / kiosk / backup notes
backend/         # Legacy Flask API (reference only)
demo/            # Earlier static demos (reference)
```

## Quick start (Node server)

Requires **Node.js 18+**.

```bash
cd server
cp .env.example .env
npm install
npm run migrate
npm run seed-admin
npm run generate-certs    # needed for HTTPS / LAN screen sharing
# In .env: ENABLE_HTTPS=true
npm start
```

Open (use **https**, not `http://0.0.0.0`):

| Page | URL |
|------|-----|
| Admin | https://localhost:3000/admin |
| Idle / billboard | https://localhost:3000/idle |
| Presentation | https://localhost:3000/presentation |
| Health | https://localhost:3000/api/health |

Default admin credentials (change after first login):

```text
username: admin
password: cbrin123
```

Accept the self-signed certificate warning once in the browser when using HTTPS.

### Optional: PowerPoint conversion

PPT/PPTX can be converted to PDF via LibreOffice (`POST /api/convert-presentation`). Install LibreOffice and set in `server/.env`:

```bash
# macOS
LIBREOFFICE_BIN=/Applications/LibreOffice.app/Contents/MacOS/soffice
# Linux
LIBREOFFICE_BIN=soffice
```

Upload size limit defaults to `MAX_UPLOAD_MB=30` (configurable in `.env`). Prefer uploading PDF when possible.

More detail: [`server/README.md`](server/README.md) and [`server/deploy/DEPLOY.md`](server/deploy/DEPLOY.md).

## Typical room workflow

1. On the room PC, open **Admin** → Connect → **Wireless**.
2. Presenter scans the QR code (or opens the join URL) on phone/laptop.
3. Presenter uploads a file (or picks a stored one) → **Start Presentation**.
4. The admin live display mirrors the deck; presenter controls pages from the controller.
5. **End Presentation** / Admin **Disconnect** returns the room to waiting / idle.

Screen share requires a secure context (HTTPS or localhost).

## Current capabilities

- Admin login (bcrypt + session/bearer tokens)
- Wireless room create / QR join / presence (controller + display)
- Presentation sync over SSE (start, page, zoom/pan, exit)
- Presenter upload of PDF / PPT / PPTX with server-side storage
- Admin **Manage Uploaded Files** (list, open, delete)
- Presentation page can select previously stored uploads
- Idle billboard slides (CRUD + timing)
- Same-origin Socket.IO WebRTC signaling for screen share
- LAN server-info helpers, health checks, cleanup jobs

## Key APIs (Node)

| Method | Path | Notes |
|--------|------|--------|
| `POST` | `/api/auth/login` | Admin login |
| `GET`/`POST`/`DELETE` | `/api/idle-slides` | Billboard content |
| `POST` | `/api/presentation-files` | Upload deck |
| `GET` | `/api/presentation-files` | List stored decks |
| `GET`/`DELETE` | `/api/uploaded-files` | Admin file management (auth) |
| `GET` | `/api/presentation-events` | SSE sync |
| `POST` | `/api/presentation-command` | start / sync / exit |
| `POST` | `/api/presentation-presence` | join / leave / clear |
| `POST` | `/api/rooms` | Create room (auth) |
| `POST` | `/api/convert-presentation` | PPT/PPTX → PDF |
| `GET` | `/api/health` | Liveness |

## Legacy / reference

- **`backend/`** — earlier Flask API and SQLite helpers. Not required when using `server/`.
- **`demo/`** — historical UI demos (e.g. `Event_Room_Interface_Demo_v.3.9`). Prefer the pages served by the Node server.

To run the legacy Flask path (optional):

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
python3 backend/init_db.py
python3 backend/app.py
```

## Project context

Built as a university client project to prototype a maintainable, web-based replacement for awkward multi-step room display connection, with idle billboard value for staff and partners. Hardware targets include a room PC and optional Raspberry Pi kiosk for the idle display.
