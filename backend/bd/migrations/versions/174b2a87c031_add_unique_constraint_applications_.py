"""add_unique_constraint_applications_source_repository

Revision ID: 174b2a87c031
Revises: b4a862c09061
Create Date: 2026-06-28 12:27:44.951702

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '174b2a87c031'
down_revision: Union[str, None] = 'b4a862c09061'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_applications_source_repository",
        "applications",
        ["source_repository"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_applications_source_repository",
        "applications",
        type_="unique",
    )
