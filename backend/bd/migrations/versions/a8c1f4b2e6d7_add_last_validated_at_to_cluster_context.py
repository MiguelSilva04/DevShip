"""add_last_validated_at_to_cluster_context

Revision ID: a8c1f4b2e6d7
Revises: b9d3e7a1c650
Create Date: 2026-07-09 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a8c1f4b2e6d7'
down_revision: Union[str, None] = 'b9d3e7a1c650'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'cluster_contexts',
        sa.Column('last_validated_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('cluster_contexts', 'last_validated_at')
