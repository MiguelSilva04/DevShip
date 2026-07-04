"""add_rollback_target_version_to_deployment_requests

Revision ID: e5f6a1b2c3d4
Revises: d4e5f6a1b2c3
Create Date: 2026-07-04 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'e5f6a1b2c3d4'
down_revision: Union[str, None] = 'd4e5f6a1b2c3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'deployment_requests',
        sa.Column('rollback_target_version_id', postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index(
        op.f('ix_deployment_requests_rollback_target_version_id'),
        'deployment_requests',
        ['rollback_target_version_id'],
    )
    # The naming_convention-generated name (71 chars: fk_deployment_requests_rollback_
    # target_version_id_deployment_versions) exceeds Postgres's 63-char identifier limit.
    # SQLAlchemy's dialect truncates it with an 4-char hash suffix at compile time — this
    # is that truncated name, confirmed via postgresql.dialect().identifier_preparer.
    op.create_foreign_key(
        'fk_deployment_requests_rollback_target_version_id_deplo_337f',
        'deployment_requests',
        'deployment_versions',
        ['rollback_target_version_id'],
        ['id'],
        ondelete='SET NULL',
    )


def downgrade() -> None:
    op.drop_constraint(
        'fk_deployment_requests_rollback_target_version_id_deplo_337f',
        'deployment_requests',
        type_='foreignkey',
    )
    op.drop_index(op.f('ix_deployment_requests_rollback_target_version_id'), table_name='deployment_requests')
    op.drop_column('deployment_requests', 'rollback_target_version_id')
