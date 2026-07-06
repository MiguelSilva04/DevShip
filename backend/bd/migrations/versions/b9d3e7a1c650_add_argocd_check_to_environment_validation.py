"""add_argocd_check_to_environment_validation

Revision ID: b9d3e7a1c650
Revises: a4c7e29f0b81
Create Date: 2026-07-06 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM as PgENUM


revision: str = 'b9d3e7a1c650'
down_revision: Union[str, None] = 'a4c7e29f0b81'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_validation_status = PgENUM(
    'PENDING', 'VALID', 'INVALID',
    name='validation_status',
    create_type=False,
)


def upgrade() -> None:
    op.add_column('environment_validations', sa.Column('argocd_status', _validation_status, server_default=sa.text("'PENDING'"), nullable=False))
    op.add_column('environment_validations', sa.Column('argocd_error', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('environment_validations', 'argocd_error')
    op.drop_column('environment_validations', 'argocd_status')
