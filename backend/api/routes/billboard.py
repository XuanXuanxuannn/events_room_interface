from flask import Blueprint, jsonify

from api.serializers import serialize_content_item
from db_utils import get_active_content_items

bp = Blueprint("billboard", __name__)


@bp.get("/api/billboard/playlist")
def get_billboard_playlist():
    items = get_active_content_items()
    return jsonify([serialize_content_item(item) for item in items])
