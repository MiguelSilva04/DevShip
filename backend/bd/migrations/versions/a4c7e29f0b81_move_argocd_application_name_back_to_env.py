"""move_argocd_application_name_back_to_environment

Revision ID: a4c7e29f0b81
Revises: f3a8d6c1b502
Create Date: 2026-07-06 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a4c7e29f0b81'
down_revision: Union[str, None] = 'f3a8d6c1b502'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('environments', sa.Column('argocd_application_name', sa.String(length=255), nullable=True))

    # Confirmed against the real ArgoCD instance: one Application per Environment,
    # shared by every Application deployed into it — not per (Application, Environment).
    # Carry over any value already set (arbitrarily picks one if they somehow differ).
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


def downgrade() -> None:
    op.add_column('application_environments', sa.Column('argocd_application_name', sa.String(length=255), nullable=True))
    op.execute(
        "UPDATE application_environments ae "
        "SET argocd_application_name = e.argocd_application_name "
        "FROM environments e "
        "WHERE ae.environment_id = e.id AND e.argocd_application_name IS NOT NULL"
    )
    op.drop_column('environments', 'argocd_application_name')
