"""move_argocd_application_name_to_app_env

Revision ID: f3a8d6c1b502
Revises: e7f1a2b8c904
Create Date: 2026-07-06 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f3a8d6c1b502'
down_revision: Union[str, None] = 'e7f1a2b8c904'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('application_environments', sa.Column('argocd_application_name', sa.String(length=255), nullable=True))

    # Best-effort carry-over: the old Environment-level value was wrong for any
    # Environment with more than one Application, but for the common single-app
    # case it's the right value and shouldn't be silently lost.
    op.execute(
        "UPDATE application_environments ae "
        "SET argocd_application_name = e.argocd_application_name "
        "FROM environments e "
        "WHERE ae.environment_id = e.id AND e.argocd_application_name IS NOT NULL"
    )

    op.drop_column('environments', 'argocd_application_name')


def downgrade() -> None:
    op.add_column('environments', sa.Column('argocd_application_name', sa.String(length=255), nullable=True))
    op.execute(
        "UPDATE environments e "
        "SET argocd_application_name = sub.name "
        "FROM ("
        "  SELECT DISTINCT ON (environment_id) environment_id, argocd_application_name AS name "
        "  FROM application_environments "
        "  WHERE argocd_application_name IS NOT NULL"
        ") sub "
        "WHERE e.id = sub.environment_id"
    )
    op.drop_column('application_environments', 'argocd_application_name')
