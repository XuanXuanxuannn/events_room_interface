import random
from datetime import datetime
from typing import Optional, Dict, Any

from models import SessionLocal, DisplaySession, ScreenState


def generate_room_code() -> str:
    """
    generate a 6 digit room code。
    Exs：834921
    """
    return str(random.randint(100000, 999999))


def create_screen_share_session() -> Dict[str, Any]:
    """
    Generate a screen share session。

    Reuse DisplaySession for now，Not adding new ones。
    get room_code in notes just for now。
    """
    db = SessionLocal()
    try:
        room_code = generate_room_code()

        session = DisplaySession(
            session_type="screen_share",
            started_at=datetime.now(),
            ended_at=None,
            device_type="browser",
            status="waiting",
            uploaded_file_id=None,
            notes=f"room_code={room_code}",
        )

        db.add(session)
        db.commit()
        db.refresh(session)

        state = db.query(ScreenState).first()

        if state:
            state.mode = "screen_share_waiting"
            state.current_session_id = session.id
            state.last_changed_at = datetime.now()
        else:
            state = ScreenState(
                mode="screen_share_waiting",
                current_content_id=None,
                current_session_id=session.id,
                last_changed_at=datetime.now(),
            )
            db.add(state)

        db.commit()

        return {
            "session_id": session.id,
            "room_code": room_code,
            "status": session.status,
            "mode": state.mode,
        }

    finally:
        db.close()


def get_screen_share_session_by_room(room_code: str) -> Optional[Dict[str, Any]]:
    """
    Use room_code to find screen share session。
    """
    db = SessionLocal()
    try:
        session = (
            db.query(DisplaySession)
            .filter(DisplaySession.session_type == "screen_share")
            .filter(DisplaySession.notes == f"room_code={room_code}")
            .first()
        )

        if not session:
            return None

        return {
            "session_id": session.id,
            "room_code": room_code,
            "session_type": session.session_type,
            "status": session.status,
            "started_at": session.started_at.isoformat() if session.started_at else None,
            "ended_at": session.ended_at.isoformat() if session.ended_at else None,
        }

    finally:
        db.close()


def end_screen_share_session(room_code: str) -> Optional[Dict[str, Any]]:
    """
    End screen share session，Back to billboard mode。

    if session ended before：
    - Do not cover ended_at
    - return already_ended=True
    - Make sure screen_state is safe
    """
    db = SessionLocal()
    try:
        session = (
            db.query(DisplaySession)
            .filter(DisplaySession.session_type == "screen_share")
            .filter(DisplaySession.notes == f"room_code={room_code}")
            .first()
        )

        if not session:
            return None

        already_ended = session.status == "ended"

        if not already_ended:
            session.status = "ended"
            session.ended_at = datetime.now()

        state = db.query(ScreenState).first()

        if state:
            if state.current_session_id == session.id or not already_ended:
                state.mode = "billboard"
                state.current_session_id = None
                state.last_changed_at = datetime.now()

            elif already_ended and state.current_session_id is None:
                state.mode = "billboard"
                state.last_changed_at = datetime.now()

        db.commit()

        return {
            "session_id": session.id,
            "room_code": room_code,
            "status": session.status,
            "already_ended": already_ended,
            "mode": state.mode if state else "billboard",
            "ended_at": session.ended_at.isoformat() if session.ended_at else None,
        }

    finally:
        db.close()