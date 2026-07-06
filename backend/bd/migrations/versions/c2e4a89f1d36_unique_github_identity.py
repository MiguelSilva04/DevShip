"""unique_github_identity

Revision ID: c2e4a89f1d36
Revises: 9d3b6f2a1c47
Create Date: 2026-07-06 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'c2e4a89f1d36'
down_revision: Union[str, None] = '9d3b6f2a1c47'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "CREATE UNIQUE INDEX ix_users_github_username_unique "
        "ON users (github_username) "
        "WHERE github_username IS NOT NULL"
    )
    op.execute(
        "CREATE UNIQUE INDEX ix_users_github_email_unique "
        "ON users (github_email) "
        "WHERE github_email IS NOT NULL"
    )


def downgrade() -> None:
    op.drop_index('ix_users_github_email_unique', table_name='users')
    op.drop_index('ix_users_github_username_unique', table_name='users')
