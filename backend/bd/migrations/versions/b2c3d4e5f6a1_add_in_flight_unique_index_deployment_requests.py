"""add_in_flight_unique_index_deployment_requests

Revision ID: b2c3d4e5f6a1
Revises: a1b2c3d4e5f6
Create Date: 2026-06-29 10:01:00.000000

"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text


revision: str = 'b2c3d4e5f6a1'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "CREATE UNIQUE INDEX uq_deployment_requests_in_flight "
        "ON deployment_requests (application_environment_id) "
        "WHERE status IN ('PENDING', 'APPROVED', 'RUNNING')"
    )


def downgrade() -> None:
    op.drop_index('uq_deployment_requests_in_flight', table_name='deployment_requests')
