"""drop_container_registry_repository

Revision ID: 9d3b6f2a1c47
Revises: 47e2d496a5b9
Create Date: 2026-07-06 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '9d3b6f2a1c47'
down_revision: Union[str, None] = '47e2d496a5b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column('applications', 'container_registry_repository')


def downgrade() -> None:
    op.add_column('applications', sa.Column('container_registry_repository', sa.String(length=512), nullable=True))
