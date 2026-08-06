# Backend Notes

This file explains the parts backend teammates need to know before modifying or integrating the demo.

## Current Architecture

The project is currently a local Node.js demo server.

| Role | Typical URL | Purpose |
|---|---|---|
| Admin | `/admin` | Creates a room, shows QR / URL, manages connection status and disconnect |
| Controller / Presentation | `/presentation` or `/p/:room` | Used by phone, iPad, or another device to upload files and control presentation |
| Display | `/display?room=ROOM_ID` | Shows the presentation content on the presentation screen |

The server is started with:

```bash
node cbrin_image_server_v2_idle.js
```

Default port:

```text
3000
```

## Main User Flow

1. Admin clicks **Connect**.
2. A random room ID is generated.
3. Admin shows a QR code / URL for the controller.
4. Controller joins the room.
5. Controller uploads a presentation file.
6. Controller clicks **Start Presentation**.
7. Display opens / receives the presentation state.
8. Controller and Display stay synced for page changes, file changes, zoom, and pan.
9. Admin or Controller can disconnect the room.

## Room / Device Logic

The demo treats each connection room as a session.

Important rules:

- One room should only have one active controller at a time.
- One room should only have one active display at a time.
- Admin can disconnect the room and clear old device occupation.
- Controller can disconnect itself so another device can join.
- Display should release its slot when presentation exits.

This was added to avoid old browser tabs, refreshed pages, or cached sessions blocking new devices.

## File Upload Logic

The controller uploads presentation files to the local server.

Supported demo file types:

```text
PDF
PPTX
PPT
```

Current behavior:

- PDF is the most reliable.
- PPTX may be handled by a simplified browser-side text reader or converted/displayed depending on the current implementation.
- Legacy `.ppt` usually needs backend conversion for accurate preview.

Recommended backend improvement:

```text
Convert PPT/PPTX to PDF or slide images on the server,
then let Display and Controller render the converted output.
```

Possible tools for future implementation:

- LibreOffice headless conversion
- Microsoft Office conversion on Windows server
- Cloud conversion API
- Server-side image generation per slide

## Display Sync Logic

Controller and Display need to share the same presentation state.

State should include:

```json
{
  "room": "ROOM_ID",
  "fileId": "uploaded-file-id",
  "page": 1,
  "zoom": 1,
  "panX": 0,
  "panY": 0,
  "sequence": 100,
  "sourceClientId": "client-id"
}
```

Important points:

- Use a sequence number or timestamp to ignore old events.
- Ignore events sent by the same client when they are broadcast back.
- Page changes should reset zoom and pan to the default value.
- Pan and zoom should not be synced only by raw pixels because phone, iPad, and display screen sizes are different.
- Prefer relative pan / normalized position when syncing between devices.

## Mobile / iPad Notes

Mobile and iPad behavior is different from desktop browser behavior.

Implemented / expected behavior:

- Mobile Share Screen is hidden because mobile browsers usually do not support real screen capture.
- Mobile uses pinch gesture for zoom.
- Mobile uses drag gesture for pan.
- Page changing and file switching should use buttons, not swipe gestures, to avoid accidental actions.
- iPad may report itself as a desktop Mac browser, so detection should not rely only on the user agent string.

## Fullscreen Notes

A web page cannot force a remote computer to enter true F11 fullscreen mode without user interaction.

Practical behavior:

- The Display page can hide its own internal toolbar.
- Browser window UI, such as address bar, tab bar, and system buttons, cannot always be hidden by code.
- For true fullscreen during demo, press **F11** on the Display computer.
- Kiosk mode can also be used for a more presentation-like setup.

Example Chrome / Edge kiosk idea:

```bash
chrome --kiosk http://localhost:3000/display?room=ROOM_ID
```

The exact command may differ depending on OS and browser installation path.

## Connection Status

Admin should show the current connection status.

Suggested statuses:

```text
Not connected
Waiting for controller
Controller connected
Presentation live
Presentation ended, link still active
Disconnected
```

Suggested color logic:

```text
Grey   = not connected / disconnected
Yellow = waiting
Green  = controller connected / live
Red    = error
```

## Important Limitations

- This is still a local demo prototype, not a production backend.
- Current room state is likely in memory, so restarting the Node server clears all rooms.
- If long-term storage is needed, add a database or persistent file storage.
- If multiple teams/devices use it at the same time, backend room/session logic should be hardened.
- For production, upload validation, file size limits, MIME checking, and cleanup jobs should be added.

## Suggested Future Backend Tasks

1. Split server code into clearer modules:
   - routes
   - upload handling
   - room/session manager
   - socket/event manager
   - static file serving

2. Add stable room/session APIs:
   - create room
   - join room
   - leave room
   - disconnect room
   - get room status

3. Add robust file conversion:
   - PPT/PPTX to PDF or images
   - generated slide thumbnails
   - page count metadata

4. Add cleanup:
   - remove expired rooms
   - remove old uploaded files
   - release disconnected devices after timeout

5. Add better error handling:
   - duplicate controller
   - duplicate display
   - missing file
   - upload failure
   - unsupported file type

## Quick Testing Checklist

1. Start server.
2. Open `/admin`.
3. Click **Connect**.
4. Join from phone / iPad by QR code.
5. Upload a PDF.
6. Start Presentation.
7. Check Display shows the same file.
8. Test next / previous page.
9. Test zoom / pan.
10. Test file switching.
11. Test Controller Disconnect.
12. Test Admin Disconnect.
13. Refresh phone and confirm it does not block the room forever.
