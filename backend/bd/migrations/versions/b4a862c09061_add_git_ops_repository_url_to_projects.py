"""add_git_ops_repository_url_to_projects

Revision ID: b4a862c09061
Revises: cb5dac4cd91b
Create Date: 2026-06-28 12:27:05.872600

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b4a862c09061'
down_revision: Union[str, None] = 'cb5dac4cd91b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column("git_ops_repository_url", sa.String(512), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("projects", "git_ops_repository_url")
