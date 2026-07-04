"""add_argocd_application_name_to_environments

Revision ID: 025d1c7e7a51
Revises: e5f6a1b2c3d4
Create Date: 2026-07-04 17:14:35.229011

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '025d1c7e7a51'
down_revision: Union[str, None] = 'e5f6a1b2c3d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "environments",
        sa.Column("argocd_application_name", sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("environments", "argocd_application_name")
