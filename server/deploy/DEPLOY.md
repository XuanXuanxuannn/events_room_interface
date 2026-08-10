# Deploy: Room PC + Raspberry Pi (LAN)

## 1. Room PC (primary server)

Install Node.js 18+:

```bash
node -v
```

Install LibreOffice for PPT conversion:

```bash
# Debian/Ubuntu
sudo apt update && sudo apt install -y libreoffice-impress

# macOS
brew install --cask libreoffice
```

Install and run the server:

```bash
cd /opt/events-room/server   # or your clone path
cp .env.example .env
# edit SESSION_SECRET, ADMIN_PASSWORD, LIBREOFFICE_BIN
npm install
npm run migrate
npm run seed-admin
npm start
```

### systemd (Linux room PC or Pi)

```bash
sudo cp deploy/events-room.service /etc/systemd/system/
sudo sed -i 's|/opt/events-room/server|'"$PWD"'|g' /etc/systemd/system/events-room.service
sudo sed -i 's|User=pi|User='"$USER"'|g' /etc/systemd/system/events-room.service
sudo systemctl daemon-reload
sudo systemctl enable --now events-room
sudo systemctl status events-room
```

Logs:

```bash
journalctl -u events-room -f
```

### Firewall

Allow TCP `3000` on the LAN only. Example ufw:

```bash
sudo ufw allow from 192.168.0.0/16 to any port 3000 proto tcp
```

Do not expose port 3000 to the public internet without reverse-proxy TLS + stronger auth.

## 2. Raspberry Pi idle kiosk

Point Chromium at the room PC:

```bash
chromium-browser --kiosk --noerrdialogs --disable-infobars \
  http://ROOM_PC_IP:3000/idle
```

Autostart via `/etc/xdg/lxsession/LXDE-pi/autostart` or a systemd user unit that launches Chromium after network is up.

Screen-share display overlay:

```text
http://ROOM_PC_IP:3000/idle?screen_room=ROOM_CODE
```

## 3. Presentation display kiosk

```bash
chromium --kiosk http://ROOM_PC_IP:3000/display?room=ROOM_CODE
```

For true fullscreen if the browser blocks the Fullscreen API, press **F11** once.

## 4. Backup

```bash
cd /opt/events-room/server
npm run backup
# copies SQLite + uploads to storage/backups/<timestamp>
```

Cron example (daily 2am):

```cron
0 2 * * * cd /opt/events-room/server && /usr/bin/npm run backup >> /var/log/events-room-backup.log 2>&1
```

## 5. HTTPS for LAN screen sharing

Browsers only allow `getDisplayMedia` (Share Screen) on **HTTPS** or **localhost**.
A phone/laptop opening `http://192.168.x.x:3000` cannot start screen share.

```bash
cd /opt/events-room/server
npm run generate-certs
# in .env:
ENABLE_HTTPS=true
npm start
```

Then open:

```text
https://ROOM_PC_IP:3000/presentation
```

Accept the self-signed certificate warning once (Advanced → Continue).

Prefer starting Share Screen from the **room PC** in desktop Chrome/Edge. Mobile browsers usually cannot capture the system screen.

## 6. LibreOffice binary path

Set in `.env`:

```bash
# Linux
LIBREOFFICE_BIN=soffice

# macOS
LIBREOFFICE_BIN=/Applications/LibreOffice.app/Contents/MacOS/soffice
```

Prefer running conversion on the room PC, not a low-power Pi.

## 7. Smoke checklist

1. `curl http://localhost:3000/api/health` → `ok: true`
2. Login at `/admin`
3. Upload idle image → `/idle` rotates
4. Connect → QR → phone upload PDF → display syncs
5. Create screen-share room → presenter + idle display connect
6. Upload PPTX → convert returns `/converted/...pdf`
7. Reboot room PC → systemd brings service back; slides still present
