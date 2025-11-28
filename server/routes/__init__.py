from .accounts import accounts_bp
from .assignments import assignments_bp
from .auth import auth_bp
from .events import events_bp
from .imports import imports_bp
from .kids import kids_bp
from .notifications import notifications_bp
from .projection_settings import projection_settings_bp
from .reports import reports_bp
from .shifts import shifts_bp
from .staff_matrix import staff_matrix_bp

__all__ = ['register_routes']


def register_routes(app):
    for blueprint in [
        auth_bp,
        accounts_bp,
        kids_bp,
        shifts_bp,
        projection_settings_bp,
        assignments_bp,
        imports_bp,
        reports_bp,
        notifications_bp,
        events_bp,
        staff_matrix_bp,
    ]:
        app.register_blueprint(blueprint, url_prefix='/api')
