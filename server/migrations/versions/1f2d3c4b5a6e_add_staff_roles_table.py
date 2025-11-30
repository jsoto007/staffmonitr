"""Add staff roles table

Revision ID: 1f2d3c4b5a6e
Revises: f4b5c6d7e8a9
Create Date: 2025-07-05 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = '1f2d3c4b5a6e'
down_revision = 'f4b5c6d7e8a9'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    if 'account_groups' not in inspector.get_table_names():
        return

    if 'staff_roles' in inspector.get_table_names():
        return

    op.create_table(
        'staff_roles',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('account_group_id', sa.String(length=36), sa.ForeignKey('account_groups.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(length=128), nullable=False),
        sa.Column('color', sa.String(length=24), nullable=True),
        sa.UniqueConstraint('account_group_id', 'name', name='uq_staff_roles_account_name'),
    )


def downgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    if 'staff_roles' in inspector.get_table_names():
        op.drop_table('staff_roles')
