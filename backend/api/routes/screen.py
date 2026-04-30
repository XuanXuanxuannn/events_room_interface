from flask import Blueprint, jsonify

from api.serializers import serialize_screen_state
from db_utils import get_current_screen_state

bp = Blueprint("screen", __name__)


@bp.get("/api/screen/state")
def get_screen_state():
    state = get_current_screen_state()
    if not state:
        return jsonify({"error": "screen state not initialized"}), 404

    return jsonify(serialize_screen_state(state))
