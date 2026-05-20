from flask import Blueprint, jsonify, request

from extensions import socketio
from services.screen_share_service import (
    create_screen_share_session,
    get_screen_share_session_by_room,
    end_screen_share_session,
)

bp = Blueprint("screen_share", __name__)


@bp.post("/api/screen-share/session")
def create_session():
    """
    Generate screen share room/session。
    """
    session = create_screen_share_session()

    base_url = request.host_url.rstrip("/")
    room_code = session["room_code"]

    return jsonify(
        {
            **session,
            "socket_url": base_url,
            "message": "screen share session created",
            "display_instruction": f"Display should join room {room_code}",
            "presenter_instruction": f"Presenter should join room {room_code}",
        }
    ), 201


@bp.get("/api/screen-share/session/<room_code>")
def get_session(room_code: str):
    """
    Check room session。
    """
    session = get_screen_share_session_by_room(room_code)

    if not session:
        return jsonify({"error": "screen share session not found"}), 404

    return jsonify(session)


@bp.post("/api/screen-share/session/<room_code>/end")
def end_session(room_code: str):
    """
    End screen share session。

    if session end for the first time：
    - update database
    - broadcast stop-screen-share

    if session ended before：
    - do not broadcast stop-screen-share again
    - return already_ended=True
    """
    session = end_screen_share_session(room_code)

    if not session:
        return jsonify({"error": "screen share session not found"}), 404

    already_ended = session.get("already_ended", False)

    if not already_ended:
        socketio.emit(
            "stop-screen-share",
            {
                "room": room_code,
                "reason": "session ended by backend",
            },
            to=room_code,
        )

        message = "screen share session ended"
    else:
        message = "screen share session was already ended"

    return jsonify(
        {
            **session,
            "message": message,
        }
    )