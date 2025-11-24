"""Add ratio fields to shift templates

Revision ID: b7a8c9d0e1f2
Revises: a1b2c3d4e5f6
Create Date: 2025-12-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b7a8c9d0e1f2'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def _has_column(connection, table: str, column: str) -> bool:
    inspector = sa.inspect(connection)
    return any(col['name'] == column for col in inspector.get_columns(table))


def upgrade():
    bind = op.get_bind()
    if not _has_column(bind, 'shift_templates', 'ratio_staff'):
        op.add_column(
            'shift_templates',
            sa.Column('ratio_staff', sa.Integer(), nullable=False, server_default='1'),
        )
    if not _has_column(bind, 'shift_templates', 'ratio_kids'):
        op.add_column(
            'shift_templates',
            sa.Column('ratio_kids', sa.Integer(), nullable=False, server_default='4'),
        )


def downgrade():
    bind = op.get_bind()
    if _has_column(bind, 'shift_templates', 'ratio_kids'):
        op.drop_column('shift_templates', 'ratio_kids')
    if _has_column(bind, 'shift_templates', 'ratio_staff'):
        op.drop_column('shift_templates', 'ratio_staff')
