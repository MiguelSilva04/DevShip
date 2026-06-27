"""add_archival_fields

Revision ID: cb5dac4cd91b
Revises: 6661913b6611
Create Date: 2026-06-26 18:46:04.512551

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cb5dac4cd91b'
down_revision: Union[str, None] = '6661913b6611'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "projects",
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "applications",
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "applications",
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
    )
 
 
def downgrade() -> None:
    op.drop_column("applications", "archived_at")
    op.drop_column("applications", "is_archived")
    op.drop_column("projects", "archived_at")
    op.drop_column("projects", "is_archived")
