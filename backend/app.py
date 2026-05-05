from flask import Flask, request

from api.routes.auth import bp as auth_bp
from api.routes.admin_content import bp as admin_content_bp
from api.routes.billboard import bp as billboard_bp
from api.routes.bookings import bp as bookings_bp
from api.routes.connection import bp as connection_bp
from api.routes.health import bp as health_bp
from api.routes.screen import bp as screen_bp
from api.routes.uploads import bp as uploads_bp


def create_app() -> Flask:
    app = Flask(__name__)

    app.register_blueprint(auth_bp)
    app.register_blueprint(health_bp)
    app.register_blueprint(screen_bp)
    app.register_blueprint(connection_bp)
    app.register_blueprint(uploads_bp)
    app.register_blueprint(billboard_bp)
    app.register_blueprint(bookings_bp)
    app.register_blueprint(admin_content_bp)

    @app.before_request
    def handle_preflight():
        if request.method == "OPTIONS":
            return app.make_default_options_response()

    @app.after_request
    def add_cors_headers(response):
        # Keep local demo pages (e.g. :5500) able to call backend APIs.
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        return response

    return app


app = create_app()


if __name__ == "__main__":
    app.run(debug=True)