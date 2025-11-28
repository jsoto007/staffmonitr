"""Add staff matrix models

Revision ID: e3f1a5b4c6d7
Revises: b7a8c9d0e1f2
Create Date: 2025-12-15 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e3f1a5b4c6d7'
down_revision = 'b7a8c9d0e1f2'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    if 'permanent_schedule_templates' not in inspector.get_table_names():
        op.create_table(
            'permanent_schedule_templates',
            sa.Column('id', sa.String(length=36), nullable=False),
            sa.Column('account_group_id', sa.String(length=36), nullable=False),
            sa.Column('label', sa.String(length=128), nullable=False),
            sa.Column('role', sa.String(length=128), nullable=False),
            sa.Column('color', sa.String(length=32), nullable=True),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('weekly_pattern', sa.JSON(), nullable=False),
            sa.Column(
                'created_at',
                sa.DateTime(timezone=True),
                server_default=sa.text('(CURRENT_TIMESTAMP)'),
                nullable=False,
            ),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(['account_group_id'], ['account_groups.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
        )

    if 'staff_schedule_assignments' not in inspector.get_table_names():
        op.create_table(
            'staff_schedule_assignments',
            sa.Column('id', sa.String(length=36), nullable=False),
            sa.Column('account_group_id', sa.String(length=36), nullable=False),
            sa.Column('template_id', sa.String(length=36), nullable=False),
            sa.Column('staff_id', sa.String(length=36), nullable=False),
            sa.Column('start_date', sa.Date(), nullable=True),
            sa.Column('end_date', sa.Date(), nullable=True),
            sa.Column(
                'created_at',
                sa.DateTime(timezone=True),
                server_default=sa.text('(CURRENT_TIMESTAMP)'),
                nullable=False,
            ),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(['account_group_id'], ['account_groups.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['template_id'], ['permanent_schedule_templates.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['staff_id'], ['staff_members.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
        )

    if 'schedule_overrides' not in inspector.get_table_names():
        op.create_table(
            'schedule_overrides',
            sa.Column('id', sa.String(length=36), nullable=False),
            sa.Column('account_group_id', sa.String(length=36), nullable=False),
            sa.Column('staff_id', sa.String(length=36), nullable=False),
            sa.Column('template_id', sa.String(length=36), nullable=True),
            sa.Column('date', sa.Date(), nullable=False),
            sa.Column('override_type', sa.String(length=32), nullable=False, server_default='day_off'),
            sa.Column('reason', sa.String(length=256), nullable=True),
            sa.Column(
                'created_at',
                sa.DateTime(timezone=True),
                server_default=sa.text('(CURRENT_TIMESTAMP)'),
                nullable=False,
            ),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(['account_group_id'], ['account_groups.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['staff_id'], ['staff_members.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['template_id'], ['permanent_schedule_templates.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
        )

    if 'supplemental_shifts' not in inspector.get_table_names():
        op.create_table(
            'supplemental_shifts',
            sa.Column('id', sa.String(length=36), nullable=False),
            sa.Column('account_group_id', sa.String(length=36), nullable=False),
            sa.Column('staff_id', sa.String(length=36), nullable=False),
            sa.Column('date', sa.Date(), nullable=False),
            sa.Column('label', sa.String(length=128), nullable=False),
            sa.Column('start_minute', sa.Integer(), nullable=False),
            sa.Column('end_minute', sa.Integer(), nullable=False),
            sa.Column('is_overtime', sa.Boolean(), nullable=False, server_default='false'),
            sa.Column('notes', sa.String(length=256), nullable=True),
            sa.Column(
                'created_at',
                sa.DateTime(timezone=True),
                server_default=sa.text('(CURRENT_TIMESTAMP)'),
                nullable=False,
            ),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(['account_group_id'], ['account_groups.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['staff_id'], ['staff_members.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
        )


def downgrade():
    op.drop_table('supplemental_shifts')
    op.drop_table('schedule_overrides')
    op.drop_table('staff_schedule_assignments')
    op.drop_table('permanent_schedule_templates')
