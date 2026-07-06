"""add_argocd_namespace_to_cluster_context

Revision ID: e7f1a2b8c904
Revises: c2e4a89f1d36
Create Date: 2026-07-06 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e7f1a2b8c904'
down_revision: Union[str, None] = 'c2e4a89f1d36'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'cluster_contexts',
        sa.Column('argocd_namespace', sa.String(length=255), nullable=False, server_default='argocd'),
    )


def downgrade() -> None:
    op.drop_column('cluster_contexts', 'argocd_namespace')
