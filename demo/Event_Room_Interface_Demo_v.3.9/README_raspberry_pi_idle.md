# CBRIN Raspberry Pi Idle Billboard Demo

## Run locally

```bash
node cbrin_image_server_v2_idle.js
```

Open:

- Admin page: `http://localhost:3000/admin`
- Idle display page: `http://localhost:3000/idle`

Upload images from the admin page. The idle display fetches `/api/idle-slides` and rotates through the stored image URLs.

## Raspberry Pi kiosk idea

On the Raspberry Pi connected to the LED screen, run the Node server and open Chromium in kiosk mode:

```bash
chromium-browser --kiosk --noerrdialogs --disable-infobars http://localhost:3000/idle
```

The idle page is designed to stay full-screen and keep showing uploaded images like a screensaver/billboard. It refreshes slide metadata from the backend every 30 seconds.

## Files

- `Admin_cbrin_backend_storage.html`: admin upload page
- `idle_display_cbrin.html`: full-screen idle billboard page
- `cbrin_image_server_v2_idle.js`: simple backend server
- `data/idle-slides.json`: metadata storage, created automatically
- `uploads/`: uploaded image storage, created automatically
