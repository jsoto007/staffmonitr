"""Re-point role shift scopes to shift templates

Revision ID: d3f4a5b6c7d8
Revises: c1d2e3f4a5b6
Create Date: 2024-04-16 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'd3f4a5b6c7d8'
down_revision = 'c1d2e3f4a5b6'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = set(inspector.get_table_names())

    if 'role_shift_association' in tables:
        op.drop_table('role_shift_association')
    if 'user_role_shifts' in tables:
        op.drop_table('user_role_shifts')

    if 'role_shift_templates' not in tables:
        op.create_table(
            'role_shift_templates',
            sa.Column('role_id', sa.String(length=36), sa.ForeignKey('access_roles.id', ondelete='CASCADE'), primary_key=True),
            sa.Column('shift_template_id', sa.String(length=36), sa.ForeignKey('shift_templates.id', ondelete='CASCADE'), primary_key=True),
        )

    if 'user_role_shift_templates' not in tables:
        op.create_table(
            'user_role_shift_templates',
            sa.Column('user_role_id', sa.String(length=36), sa.ForeignKey('user_roles.id', ondelete='CASCADE'), primary_key=True),
            sa.Column('shift_template_id', sa.String(length=36), sa.ForeignKey('shift_templates.id', ondelete='CASCADE'), primary_key=True),
        )


def downgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = set(inspector.get_table_names())

    if 'user_role_shift_templates' in tables:
        op.drop_table('user_role_shift_templates')
    if 'role_shift_templates' in tables:
        op.drop_table('role_shift_templates')

    if 'role_shift_association' not in tables:
        op.create_table(
            'role_shift_association',
            sa.Column('role_id', sa.String(length=36), sa.ForeignKey('access_roles.id', ondelete='CASCADE'), primary_key=True),
            sa.Column('shift_id', sa.String(length=36), sa.ForeignKey('shifts.id', ondelete='CASCADE'), primary_key=True),
        )
    if 'user_role_shifts' not in tables:
        op.create_table(
            'user_role_shifts',
            sa.Column('user_role_id', sa.String(length=36), sa.ForeignKey('user_roles.id', ondelete='CASCADE'), primary_key=True),
            sa.Column('shift_id', sa.String(length=36), sa.ForeignKey('shifts.id', ondelete='CASCADE'), primary_key=True),
        )
