from typing import Dict, Optional

from api.serializers import serialize_booking_event
from db_utils import get_current_or_next_booking


def get_booking_snapshot() -> Dict[str, Optional[dict]]:
    current_event, next_event = get_current_or_next_booking()
    return {
        "current_event": serialize_booking_event(current_event),
        "next_event": serialize_booking_event(next_event),
    }
