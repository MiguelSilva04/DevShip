"""add_gitops_branch_to_environments

Revision ID: c3d4e5f6a1b2
Revises: b2c3d4e5f6a1
Create Date: 2026-07-04 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c3d4e5f6a1b2'
down_revision: Union[str, None] = 'b2c3d4e5f6a1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('environments', sa.Column('gitops_branch', sa.String(255), nullable=True))
    # Backfill: source_branch guardava de facto o valor da branch GitOps em todos os
    # registos existentes (é o que a validação de onboarding sempre leu) — copia para a
    # frente. source_branch fica intocado para correção manual se divergir na realidade.
    op.execute("UPDATE environments SET gitops_branch = source_branch WHERE gitops_branch IS NULL")


def downgrade() -> None:
    op.drop_column('environments', 'gitops_branch')
