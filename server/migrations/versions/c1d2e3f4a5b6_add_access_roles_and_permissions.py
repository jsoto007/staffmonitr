"""Add hierarchical access roles, permissions, and shift scoping

Revision ID: c1d2e3f4a5b6
Revises: 1f2d3c4b5a6e
Create Date: 2024-04-15 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'c1d2e3f4a5b6'
down_revision = '1f2d3c4b5a6e'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = set(inspector.get_table_names())

    if 'permissions' not in tables:
        op.create_table(
            'permissions',
            sa.Column('id', sa.String(length=36), primary_key=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('code', sa.String(length=64), nullable=False, unique=True),
            sa.Column('description', sa.String(length=255)),
        )

    if 'access_roles' not in tables:
        op.create_table(
            'access_roles',
            sa.Column('id', sa.String(length=36), primary_key=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('name', sa.String(length=128), nullable=False, unique=True),
            sa.Column('description', sa.Text()),
            sa.Column('level', sa.Integer(), nullable=False),
        )

    current_columns = {col['name'] for col in inspector.get_columns('shifts')} if 'shifts' in tables else set()
    if 'name' not in current_columns and 'shifts' in tables:
        op.add_column('shifts', sa.Column('name', sa.String(length=120), nullable=True))

    if 'role_permissions' not in tables:
        op.create_table(
            'role_permissions',
            sa.Column('role_id', sa.String(length=36), sa.ForeignKey('access_roles.id', ondelete='CASCADE'), primary_key=True),
            sa.Column('permission_id', sa.String(length=36), sa.ForeignKey('permissions.id', ondelete='CASCADE'), primary_key=True),
        )

    if 'role_shift_association' not in tables:
        op.create_table(
            'role_shift_association',
            sa.Column('role_id', sa.String(length=36), sa.ForeignKey('access_roles.id', ondelete='CASCADE'), primary_key=True),
            sa.Column('shift_id', sa.String(length=36), sa.ForeignKey('shifts.id', ondelete='CASCADE'), primary_key=True),
        )

    if 'user_roles' not in tables:
        op.create_table(
            'user_roles',
            sa.Column('id', sa.String(length=36), primary_key=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('staff_id', sa.String(length=36), sa.ForeignKey('staff_members.id', ondelete='CASCADE'), nullable=False),
            sa.Column('role_id', sa.String(length=36), sa.ForeignKey('access_roles.id', ondelete='CASCADE'), nullable=False),
            sa.UniqueConstraint('staff_id', 'role_id', name='uq_user_roles_staff_role'),
        )

    if 'user_role_shifts' not in tables:
        op.create_table(
            'user_role_shifts',
            sa.Column('user_role_id', sa.String(length=36), sa.ForeignKey('user_roles.id', ondelete='CASCADE'), primary_key=True),
            sa.Column('shift_id', sa.String(length=36), sa.ForeignKey('shifts.id', ondelete='CASCADE'), primary_key=True),
        )


def downgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = set(inspector.get_table_names())

    if 'user_role_shifts' in tables:
        op.drop_table('user_role_shifts')
    if 'user_roles' in tables:
        op.drop_table('user_roles')
    if 'role_shift_association' in tables:
        op.drop_table('role_shift_association')
    if 'role_permissions' in tables:
        op.drop_table('role_permissions')
    if 'access_roles' in tables:
        op.drop_table('access_roles')
    if 'permissions' in tables:
        op.drop_table('permissions')
    if 'shifts' in tables:
        current_columns = {col['name'] for col in inspector.get_columns('shifts')}
        if 'name' in current_columns:
            op.drop_column('shifts', 'name')
