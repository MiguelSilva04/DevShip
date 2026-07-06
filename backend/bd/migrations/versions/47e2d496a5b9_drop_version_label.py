"""drop_version_label

Revision ID: 47e2d496a5b9
Revises: f94b5dd9480e
Create Date: 2026-07-06 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '47e2d496a5b9'
down_revision: Union[str, None] = 'f94b5dd9480e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column('deployment_versions', 'version_label')


def downgrade() -> None:
    op.add_column('deployment_versions', sa.Column('version_label', sa.String(length=255), nullable=True))
