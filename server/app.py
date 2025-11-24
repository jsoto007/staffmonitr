import sys
from pathlib import Path

from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS

# Ensure parent directory is importable when Render runs `--chdir server`
project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from server.config import Config
from server.database import db, migrate
from server.routes import register_routes


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
