import os
from secrets import token_urlsafe
from typing import Optional, Set

from flask import Request

ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")

_active_tokens: Set[str] = set()


def validate_credentials(username: str, password: str) -> bool:
    return username == ADMIN_USERNAME and password == ADMIN_PASSWORD


def issue_token() -> str:
    token = token_urlsafe(24)
    _active_tokens.add(token)
    return token


def extract_bearer_token(req: Request) -> Optional[str]:
    auth_header = req.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    return auth_header[len("Bearer ") :].strip() or None


def is_valid_token(token: Optional[str]) -> bool:
    return bool(token and token in _active_tokens)
