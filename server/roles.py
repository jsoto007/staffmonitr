from __future__ import annotations

from enum import Enum


class Role(str, Enum):
    """Canonical role names for staff members."""

    OWNER_ADMIN = 'Owner_admin'
    ADMIN = 'Admin'
    STAFF = 'Staff'
    DRIVER = 'Driver'
    TRAINER = 'Trainer'
    ASSISTANT_LEAD = 'Assistant Lead'
    LEAD = 'Lead'
    RESIDENCE_MANAGER = 'Residence Manager'
    ASSISTANT_PROGRAM_DIRECTOR = 'Assistant Program Director'
    DIRECTOR = 'Director'


ROLES = [role.value for role in Role]
MANAGER_ROLE_VALUES = {
    Role.OWNER_ADMIN.value,
    Role.ADMIN.value,
    Role.ASSISTANT_PROGRAM_DIRECTOR.value,
}
SUPER_ADMIN_ROLE_VALUES = {Role.OWNER_ADMIN.value}
INVITE_ALLOWED_ROLE_VALUES = MANAGER_ROLE_VALUES

# TODO: Surface roles from the database and remove this enum when a roles table exists.
