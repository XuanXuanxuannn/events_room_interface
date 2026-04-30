from flask import Blueprint, jsonify

from api.serializers import serialize_booking_event
from db_utils import get_current_or_next_booking

bp = Blueprint("bookings", __name__)


@bp.get("/api/bookings/current-next")
def get_current_next_booking():
    current_event, next_event = get_current_or_next_booking()
    return jsonify(
        {
            "current_event": serialize_booking_event(current_event),
            "next_event": serialize_booking_event(next_event),
        }
    )
