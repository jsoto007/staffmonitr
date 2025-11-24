from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS

# Support running as a package (server.app) or as a module with --chdir server
try:
    from .config import Config
    from .database import db, migrate
    from .routes import register_routes
except ImportError:  # pragma: no cover
    from config import Config
    from database import db, migrate
    from routes import register_routes


def create_app():
    app = Flask(__name__, static_folder='static', static_url_path='/static')
    app.config.from_object(Config)
    db.init_app(app)
    migrate.init_app(app, db)
    CORS(app)
    register_routes(app)

    @app.route('/')
    def root():
        return jsonify({'status': 'staffmonitr API'}), 200

    @app.route('/api/docs')
    def docs():
        try:
            return send_from_directory('..', 'openapi.yaml')
        except FileNotFoundError:
            return jsonify({'error': 'OpenAPI spec missing'}), 404

    return app


app = create_app()
