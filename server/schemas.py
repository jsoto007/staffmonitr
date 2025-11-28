from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, EmailStr, Field, constr

from .roles import Role


class BrandingSchema(BaseModel):
    primaryColor: str = Field(default='#1d4ed8', min_length=3)
    logoUrl: Optional[str] = None


class GeofenceSchema(BaseModel):
    lat: float = Field(default=0.0)
    lon: float = Field(default=0.0)
    radiusMeters: int = Field(default=900, ge=1)


class SignupSchema(BaseModel):
    full_name: constr(strip_whitespace=True, min_length=1)
    email: EmailStr
    password: constr(min_length=8)
    role: Role = Field(default=Role.OWNER_ADMIN)
    account_name: Optional[str] = None
    company: Optional[str] = None
    organization: Optional[str] = None
    timezone: str = Field(default='UTC')
    branding: Optional[BrandingSchema] = None
    geofence: Optional[GeofenceSchema] = None
    logo_url: Optional[str] = None

    model_config = {'extra': 'ignore'}


class LoginSchema(BaseModel):
    email: EmailStr
    password: constr(min_length=8)

    model_config = {'extra': 'ignore'}


class CreateAccountSchema(BaseModel):
    name: constr(strip_whitespace=True, min_length=1) = Field(default='New Site')
    timezone: str = Field(default='UTC')
    theme: str = Field(default='#2563eb')
    geofence: Optional[GeofenceSchema] = None

    model_config = {'extra': 'ignore'}


class InviteCreateSchema(BaseModel):
    email: EmailStr
    role: Role = Field(default=Role.STAFF)
    expires_in: int = Field(default=48, gt=0, le=168)

    model_config = {'extra': 'ignore'}
