import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()


def _env_flag(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in ('1', 'true', 'yes')


_ENVIRONMENT = (os.getenv('FLASK_ENV') or os.getenv('ENV') or 'development').lower()
_IS_PRODUCTION = _ENVIRONMENT in ('production', 'prod')
_SECRET = os.getenv('APP_SECRET_KEY') or os.getenv('SECRET_KEY')
if not _SECRET and _IS_PRODUCTION:
    raise RuntimeError('APP_SECRET_KEY must be set in production for secure sessions.')
if not _SECRET:
    # Dev/test fallback; keep this secret random and private in production.
    _SECRET = 'dev-only-secret-change-me'

class Config:
    _db_url = os.getenv('DATABASE_URL') or os.getenv('DATABASE_URI')
    # Accept legacy DATABASE_URI to avoid silently falling back to SQLite in production.
    SQLALCHEMY_DATABASE_URI = _db_url or 'sqlite:///staffmonitr.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JSON_SORT_KEYS = False
    SECRET_KEY = _SECRET
    MAIL_SENDER = os.getenv('MAIL_SENDER', 'noreply@staffmonitr.local')
    MAILGUN_API_KEY = os.getenv('MAILGUN_API_KEY')
    MAILGUN_DOMAIN = os.getenv('MAILGUN_DOMAIN')
    MAILGUN_BASE_URL = os.getenv('MAILGUN_BASE_URL') or os.getenv('BASE_URL', 'https://api.mailgun.net/v3')
    FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3000')
    JWT_EXPIRY = timedelta(hours=int(os.getenv('JWT_EXPIRY_HOURS', '8')))
    SSO_DOMAINS = os.getenv('SSO_DOMAINS', 'staffmonitr.local').split(',')
    JWT_COOKIE_NAME = os.getenv('JWT_COOKIE_NAME', 'staffmonitr_access_token')
    JWT_COOKIE_SAMESITE = os.getenv('JWT_COOKIE_SAMESITE', 'Lax')
    JWT_COOKIE_PATH = os.getenv('JWT_COOKIE_PATH', '/')
    JWT_COOKIE_SECURE = _env_flag('JWT_COOKIE_SECURE', _IS_PRODUCTION)
