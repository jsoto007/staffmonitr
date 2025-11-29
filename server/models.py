import uuid
from datetime import datetime
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import backref
from sqlalchemy.sql import func

from .database import db
from .roles import MANAGER_ROLE_VALUES, Role

STAFF_MATRIX_DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']


def _default_weekly_pattern():
    return {day: [] for day in STAFF_MATRIX_DAY_KEYS}


class TimestampMixin:
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = db.Column(db.DateTime(timezone=True), onupdate=func.now(), nullable=True)


staff_account_association = db.Table(
    'staff_account_association',
    db.Column('staff_id', db.String(36), db.ForeignKey('staff_members.id', ondelete='CASCADE'), primary_key=True),
    db.Column('account_group_id', db.String(36), db.ForeignKey('account_groups.id', ondelete='CASCADE'), primary_key=True),
)


class AccountGroup(db.Model, TimestampMixin):
    __tablename__ = 'account_groups'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(120), nullable=False)
    timezone = db.Column(db.String(40), nullable=False, default='UTC')
    brand_primary = db.Column(db.String(32), nullable=False, default='#1d4ed8')
    logo_url = db.Column(db.String(255))
    geofence_lat = db.Column(db.Float, nullable=False, default=0.0)
    geofence_lon = db.Column(db.Float, nullable=False, default=0.0)
    geofence_radius = db.Column(db.Integer, nullable=False, default=800)
    active = db.Column(db.Boolean, default=True)

    staff = db.relationship('StaffMember', secondary=staff_account_association, back_populates='accounts')
    projection_settings = db.relationship(
        'ProjectionSettings',
        uselist=False,
        back_populates='account_group',
        cascade='all, delete-orphan',
    )
    staff_matrix_templates = db.relationship(
        'PermanentScheduleTemplate',
        back_populates='account_group',
        cascade='all, delete-orphan',
    )


class ProjectionSettings(db.Model, TimestampMixin):
    __tablename__ = 'projection_settings'

    account_group_id = db.Column(
        db.String(36),
        db.ForeignKey('account_groups.id', ondelete='CASCADE'),
        primary_key=True,
    )
    coverage_mode = db.Column(db.String(32), nullable=False, default='partial_coverage')

    account_group = db.relationship('AccountGroup', back_populates='projection_settings')
    shift_templates = db.relationship(
        'ShiftTemplate',
        back_populates='projection_settings',
        cascade='all, delete-orphan',
        order_by='ShiftTemplate.sort_order',
    )


class ShiftTemplate(db.Model, TimestampMixin):
    __tablename__ = 'shift_templates'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    account_group_id = db.Column(
        db.String(36),
        db.ForeignKey('projection_settings.account_group_id', ondelete='CASCADE'),
        nullable=False,
    )
    label = db.Column(db.String(128), nullable=False)
    start_minute = db.Column(db.Integer, nullable=False)
    end_minute = db.Column(db.Integer, nullable=False)
    color = db.Column(db.String(24))
    sort_order = db.Column(db.Integer, nullable=False)
    category = db.Column(db.String(32), nullable=False, default='coverage')
    role = db.Column(db.String(128))
    days = db.Column(db.String(64), nullable=False, default='sun,mon,tue,wed,thu,fri,sat')
    ratio_staff = db.Column(db.Integer, nullable=False, default=1)
    ratio_kids = db.Column(db.Integer, nullable=False, default=4)

    projection_settings = db.relationship('ProjectionSettings', back_populates='shift_templates')


class PermissionMixin:
    @hybrid_property
    def can_manage(self):
        return self.role in MANAGER_ROLE_VALUES

    @hybrid_property
    def can_view_assignments(self):
        return self.role != Role.DRIVER.value


class StaffMember(db.Model, TimestampMixin, PermissionMixin):
    __tablename__ = 'staff_members'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    full_name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(160), nullable=False, unique=True)
    phone_number = db.Column(db.String(32))
    photo_url = db.Column(db.String(255))
    password_hash = db.Column(db.String(128))
    role = db.Column(db.String(64), nullable=False)
    status = db.Column(db.String(32), nullable=False, default='active')
    invited_at = db.Column(db.DateTime, default=datetime.utcnow)
    invite_expires_at = db.Column(db.DateTime)

    accounts = db.relationship('AccountGroup', secondary=staff_account_association, back_populates='staff')
    assignments = db.relationship('Assignment', back_populates='staff')
    open_shift_requests = db.relationship('OpenShiftRequest', back_populates='staff')
    schedule_assignments = db.relationship(
        'StaffScheduleAssignment',
        back_populates='staff',
        cascade='all, delete-orphan',
    )
    schedule_overrides = db.relationship(
        'ScheduleOverride',
        back_populates='staff',
        cascade='all, delete-orphan',
    )
    supplemental_shifts = db.relationship(
        'SupplementalShift',
        back_populates='staff',
        cascade='all, delete-orphan',
    )


class Shift(db.Model, TimestampMixin):
    __tablename__ = 'shifts'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    account_group_id = db.Column(db.String(36), db.ForeignKey('account_groups.id'), nullable=False)
    site = db.Column(db.String(120), nullable=False)
    start_time = db.Column(db.DateTime, nullable=False)
    end_time = db.Column(db.DateTime, nullable=False)
    ratio_min = db.Column(db.Integer, default=1)
    leads_required = db.Column(db.Integer, default=1)
    is_special = db.Column(db.Boolean, default=False)
    difficulty = db.Column(db.String(32), default='standard')
    open_shift = db.Column(db.Boolean, default=False)

    account_group = db.relationship('AccountGroup', backref=backref('shifts', lazy=True))
    assignments = db.relationship(
        'Assignment', back_populates='shift', cascade='all, delete-orphan'
    )
    kids = db.relationship('Kid', back_populates='shift', cascade='all, delete-orphan')
    open_shift_requests = db.relationship(
        'OpenShiftRequest', back_populates='shift', cascade='all, delete-orphan'
    )

    @hybrid_property
    def duration_hours(self):
        return (self.end_time - self.start_time).total_seconds() / 3600


class Assignment(db.Model, TimestampMixin):
    __tablename__ = 'assignments'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    shift_id = db.Column(db.String(36), db.ForeignKey('shifts.id'), nullable=False)
    staff_id = db.Column(db.String(36), db.ForeignKey('staff_members.id'))
    title = db.Column(db.String(120), nullable=False)
    difficulty_rating = db.Column(db.Integer, default=1)
    instructions = db.Column(db.Text)
    requires_one_on_one = db.Column(db.Boolean, default=False)

    shift = db.relationship('Shift', back_populates='assignments')
    staff = db.relationship('StaffMember', back_populates='assignments')
    kids = db.relationship('Kid', back_populates='assignment', cascade='all, delete-orphan')


class Kid(db.Model, TimestampMixin):
    __tablename__ = 'kids'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    full_name = db.Column(db.String(120), nullable=False)
    ratio = db.Column(db.String(10), nullable=False, default='1:1')
    special_instructions = db.Column(db.Text)
    banned_staff = db.Column(db.JSON, default=list)
    requires_personal_trainer = db.Column(db.Boolean, default=False)
    account_group_id = db.Column(db.String(36), db.ForeignKey('account_groups.id'), nullable=False)
    shift_id = db.Column(db.String(36), db.ForeignKey('shifts.id'))
    assignment_id = db.Column(db.String(36), db.ForeignKey('assignments.id'))

    account_group = db.relationship('AccountGroup', backref=backref('kids', lazy=True))
    shift = db.relationship('Shift', back_populates='kids')
    assignment = db.relationship('Assignment', back_populates='kids')


class Invitation(db.Model, TimestampMixin):
    __tablename__ = 'invitations'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = db.Column(db.String(160), nullable=False)
    token = db.Column(
        db.String(64),
        unique=True,
        nullable=False,
        doc='Deprecated: legacy plaintext token storage kept for existing invites.',
    )
    token_hash = db.Column(
        db.String(64),
        unique=True,
        nullable=True,
        doc='SHA-256 hash of the invite token. New invites should only use this field.',
    )
    role = db.Column(db.String(64), nullable=False)
    expires_at = db.Column(db.DateTime)
    account_group_id = db.Column(db.String(36), db.ForeignKey('account_groups.id'))

    account_group = db.relationship('AccountGroup')


class OpenShiftRequest(db.Model, TimestampMixin):
    __tablename__ = 'open_shift_requests'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    staff_id = db.Column(db.String(36), db.ForeignKey('staff_members.id'))
    shift_id = db.Column(db.String(36), db.ForeignKey('shifts.id'))
    status = db.Column(db.String(32), default='pending')
    requested_at = db.Column(db.DateTime, default=datetime.utcnow)

    staff = db.relationship('StaffMember', back_populates='open_shift_requests')
    shift = db.relationship('Shift', back_populates='open_shift_requests')


class PermanentScheduleTemplate(db.Model, TimestampMixin):
    __tablename__ = 'permanent_schedule_templates'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    account_group_id = db.Column(db.String(36), db.ForeignKey('account_groups.id', ondelete='CASCADE'), nullable=False)
    label = db.Column(db.String(128), nullable=False)
    role = db.Column(db.String(128), nullable=False)
    shift_type = db.Column(db.String(32), nullable=True)
    color = db.Column(db.String(32))
    notes = db.Column(db.Text)
    weekly_pattern = db.Column(db.JSON, nullable=False, default=_default_weekly_pattern)

    account_group = db.relationship('AccountGroup', back_populates='staff_matrix_templates')
    assignments = db.relationship(
        'StaffScheduleAssignment',
        back_populates='template',
        cascade='all, delete-orphan',
    )


class StaffScheduleAssignment(db.Model, TimestampMixin):
    __tablename__ = 'staff_schedule_assignments'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    account_group_id = db.Column(
        db.String(36),
        db.ForeignKey('account_groups.id', ondelete='CASCADE'),
        nullable=False,
    )
    template_id = db.Column(
        db.String(36),
        db.ForeignKey('permanent_schedule_templates.id', ondelete='CASCADE'),
        nullable=False,
    )
    staff_id = db.Column(db.String(36), db.ForeignKey('staff_members.id'), nullable=False)
    start_date = db.Column(db.Date, nullable=True)
    end_date = db.Column(db.Date, nullable=True)

    template = db.relationship('PermanentScheduleTemplate', back_populates='assignments')
    staff = db.relationship('StaffMember', back_populates='schedule_assignments')


class ScheduleOverride(db.Model, TimestampMixin):
    __tablename__ = 'schedule_overrides'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    account_group_id = db.Column(
        db.String(36),
        db.ForeignKey('account_groups.id', ondelete='CASCADE'),
        nullable=False,
    )
    staff_id = db.Column(db.String(36), db.ForeignKey('staff_members.id'), nullable=False)
    template_id = db.Column(
        db.String(36),
        db.ForeignKey('permanent_schedule_templates.id'),
        nullable=True,
    )
    date = db.Column(db.Date, nullable=False)
    override_type = db.Column(db.String(32), nullable=False, default='day_off')
    reason = db.Column(db.String(256))

    staff = db.relationship('StaffMember', back_populates='schedule_overrides')
    template = db.relationship('PermanentScheduleTemplate')


class SupplementalShift(db.Model, TimestampMixin):
    __tablename__ = 'supplemental_shifts'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    account_group_id = db.Column(
        db.String(36),
        db.ForeignKey('account_groups.id', ondelete='CASCADE'),
        nullable=False,
    )
    staff_id = db.Column(db.String(36), db.ForeignKey('staff_members.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    label = db.Column(db.String(128), nullable=False)
    start_minute = db.Column(db.Integer, nullable=False)
    end_minute = db.Column(db.Integer, nullable=False)
    is_overtime = db.Column(db.Boolean, default=False, nullable=False)
    notes = db.Column(db.String(256))

    staff = db.relationship('StaffMember', back_populates='supplemental_shifts')
