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
    dist_dir = project_root / "client" / "dist"
    static_folder = str(dist_dir) if dist_dir.exists() else None
    # Serve built client assets from /static to avoid root collisions with SPA routes
    app = Flask(__name__, static_folder=static_folder, static_url_path="/static")
    app.config.from_object(Config)
    db.init_app(app)
    migrate.init_app(app, db)
    CORS(app)
    register_routes(app)

    @app.route("/")
    def root():
        if static_folder:
            return app.send_static_file("index.html")
        return jsonify({"status": "staffmonitr API"}), 200

    # React-router fallback to index.html
    @app.route("/<path:path>")
    def frontend(path):
        if static_folder:
            file_path = dist_dir / path
            if file_path.exists():
                return send_from_directory(dist_dir, path)
            return app.send_static_file("index.html")
        return jsonify({"error": "frontend not built"}), 404

    @app.route('/api/docs')
    def docs():
        try:
            return send_from_directory('..', 'openapi.yaml')
        except FileNotFoundError:
            return jsonify({'error': 'OpenAPI spec missing'}), 404

    return app


app = create_app()
