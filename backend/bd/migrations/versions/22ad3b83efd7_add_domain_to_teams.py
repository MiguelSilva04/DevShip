"""add_domain_to_teams

Revision ID: 22ad3b83efd7
Revises: 174b2a87c031
Create Date: 2026-06-28 17:46:12.001957

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '22ad3b83efd7'
down_revision: Union[str, None] = '174b2a87c031'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # server_default="" allows backfilling existing rows; removed after add
    op.add_column("teams", sa.Column("domain", sa.String(255), nullable=False, server_default=""))
    op.create_unique_constraint("uq_teams_domain", "teams", ["domain"])
    op.alter_column("teams", "domain", server_default=None)


def downgrade() -> None:
    op.drop_constraint("uq_teams_domain", "teams", type_="unique")
    op.drop_column("teams", "domain")
