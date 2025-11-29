"""Add shift_type to staff matrix templates

Revision ID: f4b5c6d7e8a9
Revises: e3f1a5b4c6d7
Create Date: 2025-12-20 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'f4b5c6d7e8a9'
down_revision = 'e3f1a5b4c6d7'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    if 'permanent_schedule_templates' in inspector.get_table_names():
        existing_columns = {column['name'] for column in inspector.get_columns('permanent_schedule_templates')}
        if 'shift_type' not in existing_columns:
            op.add_column(
                'permanent_schedule_templates',
                sa.Column('shift_type', sa.String(length=32), nullable=True),
            )


def downgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    if 'permanent_schedule_templates' in inspector.get_table_names():
        existing_columns = {column['name'] for column in inspector.get_columns('permanent_schedule_templates')}
        if 'shift_type' in existing_columns:
            op.drop_column('permanent_schedule_templates', 'shift_type')
