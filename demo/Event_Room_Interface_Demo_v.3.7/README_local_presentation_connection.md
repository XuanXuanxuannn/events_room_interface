# CBRIN Local Admin + Presentation Connection Demo

## Run locally

```bash
node cbrin_image_server_v2_idle.js
```

Open the admin page on the computer running the server:

- `http://localhost:3000/admin`

Admin login:

- Username: `admin`
- Password: `cbrin123`

## Presentation connection flow

1. In Admin, click **Infinite Connect**.
2. The admin page generates a local presentation URL and QR code.
3. On another computer or phone connected to the same Wi-Fi/LAN, scan the QR code or open the shown URL.
4. The other device opens the Presentation page.
5. Enter/use the meeting code `12345678` or `1234 5678` and continue.

## Important LAN note

The server now exposes:

- Admin: `/admin`
- Idle display: `/idle`
- Presentation display: `/presentation`
- Server info: `/api/server-info`

The QR code uses the first LAN IPv4 address detected by Node.js, so it should work from another device on the same network. If another device cannot open it, check Windows Firewall and make sure both devices are on the same Wi-Fi.
