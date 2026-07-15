"""unique_project_name_per_team

Revision ID: a1c7e4f92b6d
Revises: d3f8a2c1b904
Create Date: 2026-07-18 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'a1c7e4f92b6d'
down_revision: Union[str, None] = 'd3f8a2c1b904'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_unique_constraint('uq_projects_team_id_name', 'projects', ['team_id', 'name'])


def downgrade() -> None:
    op.drop_constraint('uq_projects_team_id_name', 'projects', type_='unique')
