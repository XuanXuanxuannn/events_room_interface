# CBRIN Local Presentation Demo

This project is a local demo for an Admin + Presentation + Display workflow.

- **Admin side**: used on the host computer to create a connection room and show QR / URL.
- **Controller / Presentation side**: used on phone, iPad, or another device to upload files and control the presentation.
- **Display side**: used on the presentation screen to show the uploaded file.

## Requirements

You need **Node.js** installed.

Check whether Node.js is installed:

```bash
node -v
```

If it shows a version number, for example `v20.x.x`, Node.js is ready.

## Windows Setup

1. Extract the project zip file.
2. Open the extracted folder.
3. Right-click inside the folder and choose **Open in Terminal** or **Open PowerShell window here**.
4. Run:

```bash
node cbrin_image_server_v2_idle.js
```

5. Open this address on the host computer:

```text
http://localhost:3000/admin
```

Admin login:

```text
Username: admin
Password: cbrin123
```

## macOS Setup

1. Extract the project zip file.
2. Open **Terminal**.
3. Go to the project folder. Example:

```bash
cd ~/Downloads/your-project-folder
```

4. Run:

```bash
node cbrin_image_server_v2_idle.js
```

5. Open this address on the host Mac:

```text
http://localhost:3000/admin
```

Admin login:

```text
Username: admin
Password: cbrin123
```

## Connect Phone / iPad / Another Computer

The host computer and the other device must be on the **same Wi-Fi / local network**.

In the Admin page:

1. Click **Connect**.
2. Choose **Wireless**.
3. Scan the QR code with the phone / iPad, or open the shown URL manually.
4. Upload a PDF / PowerPoint file on the controller device.
5. Click **Start Presentation**.

## Find Local IP Address

If the QR code or URL does not work, manually use the host computer's local IP address.

### Windows

Run:

```bash
ipconfig
```

Find the `IPv4 Address`, for example:

```text
192.168.1.206
```

Then open this on the phone / iPad:

```text
http://192.168.1.206:3000/presentation
```

### macOS

For Wi-Fi, run:

```bash
ipconfig getifaddr en0
```

For wired Ethernet, try:

```bash
ipconfig getifaddr en1
```

Then open:

```text
http://YOUR_MAC_IP:3000/presentation
```

## Notes

- The phone / iPad is mainly used as the controller.
- Mobile browsers usually do not support real screen sharing, so the mobile Share Screen option is hidden.
- For a true fullscreen display on the presentation computer, press **F11** in the display browser window.
- If a device cannot connect because another device is still occupying the room, click **Disconnect** in Admin or Controller, then connect again.
- If the page looks outdated, refresh with **Ctrl + F5** on Windows, or **Cmd + Shift + R** on macOS.

## Stop the Server

Go back to the Terminal / PowerShell window and press:

```text
Ctrl + C
```
