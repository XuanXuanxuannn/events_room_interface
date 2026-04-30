from flask import Flask

from api.routes.admin_content import bp as admin_content_bp
from api.routes.billboard import bp as billboard_bp
from api.routes.bookings import bp as bookings_bp
from api.routes.connection import bp as connection_bp
from api.routes.health import bp as health_bp
from api.routes.screen import bp as screen_bp
from api.routes.uploads import bp as uploads_bp


def create_app() -> Flask:
    app = Flask(__name__)

    app.register_blueprint(health_bp)
    app.register_blueprint(screen_bp)
    app.register_blueprint(connection_bp)
    app.register_blueprint(uploads_bp)
    app.register_blueprint(billboard_bp)
    app.register_blueprint(bookings_bp)
    app.register_blueprint(admin_content_bp)

    return app


app = create_app()


if __name__ == "__main__":
    app.run(debug=True)