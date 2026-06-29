"""add_ci_workflow_file_to_applications

Revision ID: a1b2c3d4e5f6
Revises: 22ad3b83efd7
Create Date: 2026-06-29 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '22ad3b83efd7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # server_default required to backfill existing rows (NOT NULL column on non-empty table)
    op.add_column('applications', sa.Column('ci_workflow_file', sa.String(255), nullable=False, server_default='deploy.yml'))
    op.alter_column('applications', 'ci_workflow_file', server_default=None)


def downgrade() -> None:
    op.drop_column('applications', 'ci_workflow_file')
