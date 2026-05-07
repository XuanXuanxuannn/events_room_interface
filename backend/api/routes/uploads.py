import os
from datetime import datetime

from flask import Blueprint, jsonify, request
from werkzeug.utils import secure_filename

from api.auth import extract_bearer_token, is_valid_token
from models import SessionLocal, UploadedFile

bp = Blueprint("uploads", __name__)

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
UPLOAD_DIR = os.path.join(BASE_DIR, "static", "uploads")
ALLOWED_EXTENSIONS = {".pdf", ".ppt", ".pptx"}
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _to_public_url(stored_path: str) -> str:
    basename = os.path.basename(stored_path or "")
    if not basename:
        return ""
    return f"{request.host_url.rstrip('/')}/static/uploads/{basename}"


@bp.get("/api/uploads")
def list_uploads():
    db = SessionLocal()
    try:
        rows = db.query(UploadedFile).order_by(UploadedFile.id.desc()).all()
        return jsonify(
            [
                {
                    "id": row.id,
                    "filename": row.filename,
                    "file_type": row.file_type,
                    "file_path": row.file_path,
                    "public_url": _to_public_url(row.file_path),
                    "uploaded_by": row.uploaded_by,
                    "uploaded_at": row.uploaded_at.isoformat() if row.uploaded_at else None,
                    "status": row.status,
                }
                for row in rows
            ]
        )
    finally:
        db.close()


@bp.post("/api/uploads")
def upload_file():
    if "file" not in request.files:
        return jsonify({"error": "file is required"}), 400

    file = request.files["file"]
    filename = secure_filename(file.filename or "")
    extension = os.path.splitext(filename)[1].lower()

    if not filename:
        return jsonify({"error": "filename is required"}), 400

    if extension not in ALLOWED_EXTENSIONS:
        return jsonify({"error": "only PDF/PPT/PPTX files are supported"}), 400

    stored_name = f"{int(datetime.now().timestamp())}_{filename}"
    stored_path = os.path.join(UPLOAD_DIR, stored_name)
    file.save(stored_path)

    db = SessionLocal()
    try:
        row = UploadedFile(
            filename=filename,
            file_type=extension.lstrip("."),
            file_path=stored_path,
            uploaded_by=request.form.get("uploaded_by"),
            uploaded_at=datetime.now(),
            status="uploaded",
        )
        db.add(row)
        db.commit()
        db.refresh(row)

        return jsonify(
            {
                "id": row.id,
                "filename": row.filename,
                "file_type": row.file_type,
                "public_url": _to_public_url(row.file_path),
                "status": row.status,
            }
        ), 201
    finally:
        db.close()


@bp.post("/api/uploads/billboard-image")
def upload_billboard_image():
    token = extract_bearer_token(request)
    if not is_valid_token(token):
        return jsonify({"error": "unauthorized"}), 401

    if "file" not in request.files:
        return jsonify({"error": "file is required"}), 400

    file = request.files["file"]
    filename = secure_filename(file.filename or "")
    extension = os.path.splitext(filename)[1].lower()

    if not filename:
        return jsonify({"error": "filename is required"}), 400

    if extension not in ALLOWED_IMAGE_EXTENSIONS:
        return jsonify({"error": "only image files are supported"}), 400

    stored_name = f"{int(datetime.now().timestamp())}_{filename}"
    stored_path = os.path.join(UPLOAD_DIR, stored_name)
    file.save(stored_path)

    db = SessionLocal()
    try:
        row = UploadedFile(
            filename=filename,
            file_type=extension.lstrip("."),
            file_path=stored_path,
            uploaded_by="admin",
            uploaded_at=datetime.now(),
            status="uploaded",
        )
        db.add(row)
        db.commit()
    finally:
        db.close()

    media_url = f"{request.host_url.rstrip('/')}/static/uploads/{stored_name}"
    return jsonify({"media_url": media_url}), 201
