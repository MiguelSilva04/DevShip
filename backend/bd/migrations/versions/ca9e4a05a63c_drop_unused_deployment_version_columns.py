"""drop_unused_deployment_version_columns

Revision ID: ca9e4a05a63c
Revises: a8c1f4b2e6d7
Create Date: 2026-07-10 17:24:50.067043

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'ca9e4a05a63c'
down_revision: Union[str, None] = 'a8c1f4b2e6d7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column('deployment_versions', 'kubernetes_deployment_revision')
    op.drop_column('deployment_versions', 'image_digest')
    op.drop_column('deployment_versions', 'git_ops_commit_sha')


def downgrade() -> None:
    op.add_column('deployment_versions', sa.Column('git_ops_commit_sha', sa.String(length=40), nullable=True))
    op.add_column('deployment_versions', sa.Column('image_digest', sa.String(length=128), nullable=True))
    op.add_column('deployment_versions', sa.Column('kubernetes_deployment_revision', sa.String(length=64), nullable=True))
