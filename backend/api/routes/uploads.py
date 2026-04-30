from flask import Blueprint, jsonify

bp = Blueprint("uploads", __name__)


@bp.get("/api/uploads")
def list_uploads_placeholder():
    return jsonify(
        {
            "message": "Upload APIs are scaffolded and will be implemented in Sprint 4.",
            "items": [],
        }
    )
