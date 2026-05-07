from flask import Blueprint, jsonify, request

from api.auth import issue_token, validate_credentials

bp = Blueprint("auth", __name__)


@bp.post("/api/auth/login")
def login():
    payload = request.get_json(silent=True) or {}
    username = str(payload.get("username", "")).strip()
    password = str(payload.get("password", "")).strip()

    if not username or not password:
        return jsonify({"error": "username and password are required"}), 400

    if not validate_credentials(username, password):
        return jsonify({"error": "invalid credentials"}), 401

    return jsonify({"token": issue_token()})
