import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

class Config:
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL', 'sqlite:///staffmonitr.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JSON_SORT_KEYS = False
    SECRET_KEY = os.getenv('SECRET_KEY', 'staff-monitr-secret')
    MAIL_SENDER = os.getenv('MAIL_SENDER', 'noreply@staffmonitr.local')
    MAILGUN_API_KEY = os.getenv('MAILGUN_API_KEY')
    MAILGUN_DOMAIN = os.getenv('MAILGUN_DOMAIN')
    MAILGUN_BASE_URL = os.getenv('MAILGUN_BASE_URL', 'https://api.mailgun.net/v3')
    FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3000')
    JWT_EXPIRY = timedelta(hours=int(os.getenv('JWT_EXPIRY_HOURS', '8')))
    SSO_DOMAINS = os.getenv('SSO_DOMAINS', 'staffmonitr.local').split(',')
