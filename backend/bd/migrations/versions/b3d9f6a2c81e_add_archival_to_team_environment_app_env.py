"""add_archival_to_team_environment_app_env

Revision ID: b3d9f6a2c81e
Revises: a1c7e4f92b6d
Create Date: 2026-07-15 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b3d9f6a2c81e'
down_revision: Union[str, None] = 'a1c7e4f92b6d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("teams", sa.Column("is_archived", sa.Boolean(), server_default=sa.false(), nullable=False))
    op.add_column("teams", sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True))

    op.add_column("environments", sa.Column("is_archived", sa.Boolean(), server_default=sa.false(), nullable=False))
    op.add_column("environments", sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True))

    op.add_column("application_environments", sa.Column("is_archived", sa.Boolean(), server_default=sa.false(), nullable=False))
    op.add_column("application_environments", sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True))
    op.drop_column("application_environments", "enabled")


def downgrade() -> None:
    op.add_column("application_environments", sa.Column("enabled", sa.Boolean(), server_default=sa.true(), nullable=False))
    op.drop_column("application_environments", "archived_at")
    op.drop_column("application_environments", "is_archived")

    op.drop_column("environments", "archived_at")
    op.drop_column("environments", "is_archived")

    op.drop_column("teams", "archived_at")
    op.drop_column("teams", "is_archived")
