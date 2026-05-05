from datetime import datetime

from flask import Blueprint, jsonify, request

from api.auth import extract_bearer_token, is_valid_token
from api.serializers import serialize_content_item
from models import ContentItem, SessionLocal

bp = Blueprint("admin_content", __name__)


def _require_admin():
    token = extract_bearer_token(request)
    if not is_valid_token(token):
        return jsonify({"error": "unauthorized"}), 401
    return None


@bp.get("/api/admin/content")
def list_admin_content():
    unauthorized = _require_admin()
    if unauthorized:
        return unauthorized

    db = SessionLocal()
    try:
        items = (
            db.query(ContentItem)
            .order_by(ContentItem.display_order.asc(), ContentItem.id.asc())
            .all()
        )
        return jsonify([serialize_content_item(item) for item in items])
    finally:
        db.close()


@bp.post("/api/admin/content")
def create_admin_content():
    unauthorized = _require_admin()
    if unauthorized:
        return unauthorized

    payload = request.get_json(silent=True) or {}
    title = str(payload.get("title", "")).strip()
    if not title:
        return jsonify({"error": "title is required"}), 400

    db = SessionLocal()
    try:
        item = ContentItem(
            title=title,
            type=str(payload.get("type", "event")).strip() or "event",
            description=str(payload.get("description", "")).strip(),
            media_url=str(payload.get("media_url", "")).strip(),
            is_active=bool(payload.get("is_active", True)),
            display_order=int(payload.get("display_order", 0)),
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        return jsonify(serialize_content_item(item)), 201
    finally:
        db.close()


@bp.delete("/api/admin/content/<int:item_id>")
def delete_admin_content(item_id: int):
    unauthorized = _require_admin()
    if unauthorized:
        return unauthorized

    db = SessionLocal()
    try:
        item = db.query(ContentItem).filter(ContentItem.id == item_id).first()
        if not item:
            return jsonify({"error": "content not found"}), 404

        db.delete(item)
        db.commit()
        return jsonify({"ok": True})
    finally:
        db.close()
