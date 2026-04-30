from flask import Blueprint, jsonify

bp = Blueprint("connection", __name__)


@bp.get("/api/connection/options")
def get_connection_options():
    # MVP static guidance; can move to DB-driven content later.
    return jsonify(
        {
            "options": [
                {
                    "id": "wireless-macos-ios",
                    "label": "AirPlay (macOS / iPhone)",
                    "steps": [
                        "Ensure device is on room Wi-Fi",
                        "Open Screen Mirroring / AirPlay",
                        "Select room display name",
                    ],
                },
                {
                    "id": "wireless-windows-android",
                    "label": "Wireless Cast (Windows / Android)",
                    "steps": [
                        "Ensure device is on room Wi-Fi",
                        "Open Cast / Project settings",
                        "Select room display receiver",
                    ],
                },
                {
                    "id": "upload",
                    "label": "Upload file (PDF/PPT)",
                    "steps": [
                        "Open local upload page",
                        "Upload PDF or PPT",
                        "Start presentation from screen",
                    ],
                },
                {
                    "id": "hdmi",
                    "label": "HDMI fallback",
                    "steps": [
                        "Connect HDMI cable to your device",
                        "Switch display output if needed",
                        "Start presentation",
                    ],
                },
            ]
        }
    )
