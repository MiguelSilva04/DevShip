"""add_company_and_team_confirmation

Revision ID: d3f8a2c1b904
Revises: ca9e4a05a63c
Create Date: 2026-07-11 10:00:00.000000

"""
from typing import Sequence, Union
import uuid as _uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision: str = 'd3f8a2c1b904'
down_revision: Union[str, None] = 'ca9e4a05a63c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "companies",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("domain", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("domain", name="uq_companies_domain"),
    )

    op.add_column("teams", sa.Column("company_id", UUID(as_uuid=True), nullable=True))

    # Backfill: 1 Company por domain distinto ja existente em teams, depois aponta
    # cada team para a Company correspondente. IDs gerados em Python - o projeto
    # gera todos os ids client-side, nunca assume pgcrypto/gen_random_uuid().
    conn = op.get_bind()
    distinct_domains = conn.execute(sa.text("SELECT DISTINCT domain FROM teams")).fetchall()
    for (domain,) in distinct_domains:
        company_id = _uuid.uuid4()
        conn.execute(
            sa.text("INSERT INTO companies (id, name, domain, created_at) VALUES (:id, :name, :domain, now())"),
            {"id": company_id, "name": domain, "domain": domain},
        )
        conn.execute(
            sa.text("UPDATE teams SET company_id = :cid WHERE domain = :domain"),
            {"cid": company_id, "domain": domain},
        )

    op.alter_column("teams", "company_id", nullable=False)
    op.create_index("ix_teams_company_id", "teams", ["company_id"])
    op.create_foreign_key(
        "fk_teams_company_id_companies", "teams", "companies",
        ["company_id"], ["id"], ondelete="CASCADE",
    )
    op.drop_constraint("uq_teams_domain", "teams", type_="unique")
    op.drop_column("teams", "domain")

    team_member_status = sa.Enum("PENDING_CONFIRMATION", "CONFIRMED", "REJECTED", name="team_member_status")
    team_member_status.create(op.get_bind(), checkfirst=True)

    op.add_column(
        "team_members",
        sa.Column("status", team_member_status, server_default="CONFIRMED", nullable=False),
    )
    op.add_column("team_members", sa.Column("confirmed_by", UUID(as_uuid=True), nullable=True))
    op.add_column("team_members", sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("team_members", sa.Column("rejected_by", UUID(as_uuid=True), nullable=True))
    op.add_column("team_members", sa.Column("rejected_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_team_members_confirmed_by", "team_members", ["confirmed_by"])
    op.create_index("ix_team_members_rejected_by", "team_members", ["rejected_by"])
    op.create_foreign_key(
        "fk_team_members_confirmed_by_users", "team_members", "users",
        ["confirmed_by"], ["id"], ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_team_members_rejected_by_users", "team_members", "users",
        ["rejected_by"], ["id"], ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_team_members_rejected_by_users", "team_members", type_="foreignkey")
    op.drop_constraint("fk_team_members_confirmed_by_users", "team_members", type_="foreignkey")
    op.drop_index("ix_team_members_rejected_by", table_name="team_members")
    op.drop_index("ix_team_members_confirmed_by", table_name="team_members")
    op.drop_column("team_members", "rejected_at")
    op.drop_column("team_members", "rejected_by")
    op.drop_column("team_members", "confirmed_at")
    op.drop_column("team_members", "confirmed_by")
    op.drop_column("team_members", "status")
    sa.Enum(name="team_member_status").drop(op.get_bind(), checkfirst=True)

    op.add_column("teams", sa.Column("domain", sa.String(255), nullable=False, server_default=""))
    conn = op.get_bind()
    conn.execute(sa.text(
        "UPDATE teams SET domain = companies.domain FROM companies WHERE teams.company_id = companies.id"
    ))
    op.alter_column("teams", "domain", server_default=None)
    op.create_unique_constraint("uq_teams_domain", "teams", ["domain"])

    op.drop_constraint("fk_teams_company_id_companies", "teams", type_="foreignkey")
    op.drop_index("ix_teams_company_id", table_name="teams")
    op.drop_column("teams", "company_id")
    op.drop_table("companies")
