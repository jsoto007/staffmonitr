from ..roles import Role

ROLE_PERMISSIONS = {
    Role.OWNER_ADMIN.value: {'manage': True, 'schedule': True},
    Role.ADMIN.value: {'manage': True, 'schedule': True},
    Role.DIRECTOR.value: {'manage': False, 'schedule': True},
    Role.LEAD.value: {'manage': False, 'schedule': True},
    Role.TRAINER.value: {'manage': False, 'schedule': True},
    Role.RESIDENCE_MANAGER.value: {'manage': False, 'schedule': True},
    Role.STAFF.value: {'manage': False, 'schedule': True},
    Role.DRIVER.value: {'manage': False, 'schedule': False},
    Role.ASSISTANT_LEAD.value: {'manage': False, 'schedule': True},
    Role.ASSISTANT_PROGRAM_DIRECTOR.value: {'manage': True, 'schedule': True},
}

def has_permission(role: str, permission: str) -> bool:
    return ROLE_PERMISSIONS.get(role, {}).get(permission, False)
