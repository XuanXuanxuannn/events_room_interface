from typing import Any, Dict, Optional


def _to_iso(dt: Optional[Any]) -> Optional[str]:
    return dt.isoformat() if dt else None


def serialize_content_item(item: Any) -> Dict[str, Any]:
    return {
        "id": item.id,
        "title": item.title,
        "type": item.type,
        "description": item.description,
        "media_url": item.media_url,
        "display_order": item.display_order,
        "is_active": item.is_active,
        "start_time": _to_iso(item.start_time),
        "end_time": _to_iso(item.end_time),
    }


def serialize_booking_event(event: Optional[Any]) -> Optional[Dict[str, Any]]:
    if not event:
        return None

    return {
        "id": event.id,
        "external_event_id": event.external_event_id,
        "title": event.title,
        "start_time": _to_iso(event.start_time),
        "end_time": _to_iso(event.end_time),
        "organiser": event.organiser,
        "location": event.location,
        "source": event.source,
        "synced_at": _to_iso(event.synced_at),
    }


def serialize_screen_state(state: Optional[Any]) -> Optional[Dict[str, Any]]:
    if not state:
        return None

    return {
        "id": state.id,
        "mode": state.mode,
        "current_content_id": state.current_content_id,
        "current_session_id": state.current_session_id,
        "last_changed_at": _to_iso(state.last_changed_at),
    }
