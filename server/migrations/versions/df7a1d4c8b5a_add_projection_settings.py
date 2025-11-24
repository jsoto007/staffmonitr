"""Add projection settings

Revision ID: df7a1d4c8b5a
Revises: 94c76f7b3329
Create Date: 2025-11-22 00:10:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'df7a1d4c8b5a'
down_revision = '94c76f7b3329'
branch_labels = None
depends_on = None


def upgrade():
    op.drop_table('shift_windows')

    op.create_table(
        'projection_settings',
        sa.Column('account_group_id', sa.String(length=36), nullable=False),
        sa.Column('coverage_mode', sa.String(length=32), nullable=False, server_default='partial_coverage'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['account_group_id'], ['account_groups.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('account_group_id'),
    )

    op.create_table(
        'shift_templates',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('account_group_id', sa.String(length=36), nullable=False),
        sa.Column('label', sa.String(length=128), nullable=False),
        sa.Column('start_minute', sa.Integer(), nullable=False),
        sa.Column('end_minute', sa.Integer(), nullable=False),
        sa.Column('color', sa.String(length=24), nullable=True),
        sa.Column('sort_order', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['account_group_id'], ['projection_settings.account_group_id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade():
    op.drop_table('shift_templates')
    op.drop_table('projection_settings')

    op.create_table('shift_windows',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('account_group_id', sa.String(length=36), nullable=False),
    sa.Column('name', sa.String(length=128), nullable=False),
    sa.Column('start_minute', sa.Integer(), nullable=False),
    sa.Column('end_minute', sa.Integer(), nullable=False),
    sa.Column('sort_order', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['account_group_id'], ['account_groups.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
