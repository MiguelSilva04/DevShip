"""add_discovered_status_to_application_environments

Revision ID: f6a1b2c3d4e5
Revises: 025d1c7e7a51
Create Date: 2026-07-05 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f6a1b2c3d4e5'
down_revision: Union[str, None] = '025d1c7e7a51'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    lifecycle_status_enum = sa.Enum(
        'Deploying', 'Healthy', 'Degraded', 'Failed', 'RolledBack', 'Superseded',
        name='lifecycle_status',
        create_type=False,
    )
    op.add_column('application_environments', sa.Column('discovered_status', lifecycle_status_enum, nullable=True))
    op.add_column('application_environments', sa.Column('discovered_status_checked_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('application_environments', 'discovered_status_checked_at')
    op.drop_column('application_environments', 'discovered_status')
