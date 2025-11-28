"""Add shift metadata for role-specific segments

Revision ID: a1b2c3d4e5f6
Revises: df7a1d4c8b5a
Create Date: 2025-11-23 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = 'df7a1d4c8b5a'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_columns = {col['name'] for col in inspector.get_columns('shift_templates')}

    if 'category' not in existing_columns:
        op.add_column(
            'shift_templates',
            sa.Column('category', sa.String(length=32), nullable=False, server_default='coverage'),
        )
    if 'role' not in existing_columns:
        op.add_column(
            'shift_templates',
            sa.Column('role', sa.String(length=128), nullable=True),
        )
    if 'days' not in existing_columns:
        op.add_column(
            'shift_templates',
            sa.Column(
                'days',
                sa.String(length=64),
                nullable=False,
                server_default='sun,mon,tue,wed,thu,fri,sat',
            ),
        )


def downgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_columns = {col['name'] for col in inspector.get_columns('shift_templates')}

    if 'days' in existing_columns:
        op.drop_column('shift_templates', 'days')
    if 'role' in existing_columns:
        op.drop_column('shift_templates', 'role')
    if 'category' in existing_columns:
        op.drop_column('shift_templates', 'category')
