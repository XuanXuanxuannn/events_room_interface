from flask import Blueprint, jsonify

bp = Blueprint("admin_content", __name__)


@bp.get("/api/admin/content")
def list_admin_content_placeholder():
    return jsonify(
        {
            "message": "Admin content CRUD is scaffolded and will be implemented in Sprint 5.",
            "items": [],
        }
    )
