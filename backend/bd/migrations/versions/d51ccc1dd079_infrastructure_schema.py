"""infrastructure_schema

Revision ID: d51ccc1dd079
Revises: 7dfe3e5ed0c4
Create Date: 2026-06-26 11:28:21.453277

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM as PgENUM


# revision identifiers, used by Alembic.
revision: str = 'd51ccc1dd079'
down_revision: Union[str, None] = '7dfe3e5ed0c4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Enum type instances used only for explicit .create() / .drop() calls.
# create_type=False prevents SQLAlchemy from attempting CREATE TYPE inside
# op.create_table() — type creation is handled explicitly below.
_setup_status = PgENUM(
    'PENDING_CLUSTER', 'PENDING_ENVIRONMENTS', 'PENDING_APPLICATIONS', 'CONFIGURED',
    name='setup_status',
    create_type=False,
)
_validation_status = PgENUM(
    'PENDING', 'VALID', 'INVALID',
    name='validation_status',
    create_type=False,
)


def upgrade() -> None:
    # ── Create new PostgreSQL enum types first ────────────────────────────────
    # team_member_role is intentionally absent — it was created in 7dfe3e5ed0c4.
    _setup_status.create(op.get_bind(), checkfirst=True)
    _validation_status.create(op.get_bind(), checkfirst=True)

    # ── Tables ────────────────────────────────────────────────────────────────
    op.create_table(
        'projects',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('team_id', sa.UUID(), nullable=False),
        sa.Column('created_by', sa.UUID(), nullable=True),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('setup_status', _setup_status, server_default=sa.text("'PENDING_CLUSTER'"), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_projects_created_by_users'), ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['team_id'], ['teams.id'], name=op.f('fk_projects_team_id_teams'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_projects')),
    )
    op.create_index('ix_projects_created_by', 'projects', ['created_by'], unique=False)
    op.create_index('ix_projects_team_id', 'projects', ['team_id'], unique=False)

    op.create_table(
        'applications',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('project_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('source_repository', sa.String(length=512), nullable=False),
        sa.Column('container_registry_repository', sa.String(length=512), nullable=False),
        sa.Column('created_by', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_applications_created_by_users'), ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], name=op.f('fk_applications_project_id_projects'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_applications')),
    )
    op.create_index('ix_applications_created_by', 'applications', ['created_by'], unique=False)
    op.create_index('ix_applications_project_id', 'applications', ['project_id'], unique=False)

    op.create_table(
        'cluster_contexts',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('project_id', sa.UUID(), nullable=False),
        sa.Column('cluster_arn', sa.String(length=512), nullable=False),
        sa.Column('cluster_name', sa.String(length=255), nullable=False),
        sa.Column('region', sa.String(length=64), nullable=False),
        sa.Column('eks_endpoint', sa.String(length=512), nullable=False),
        sa.Column('ca_certificate', sa.Text(), nullable=False),
        sa.Column('ca_file_path', sa.Text(), nullable=False),
        sa.Column('iam_role_arn', sa.String(length=512), nullable=False),
        sa.Column('external_id', sa.String(length=128), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], name=op.f('fk_cluster_contexts_project_id_projects'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_cluster_contexts')),
        sa.UniqueConstraint('external_id', name=op.f('uq_cluster_contexts_external_id')),
        sa.UniqueConstraint('project_id', name=op.f('uq_cluster_contexts_project_id')),
    )

    # team_member_role already exists from migration 7dfe3e5ed0c4.
    # PgENUM with create_type=False prevents any CREATE TYPE attempt.
    _existing_role = PgENUM(name='team_member_role', create_type=False)

    op.create_table(
        'environments',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('project_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=64), nullable=False),
        sa.Column('display_name', sa.String(length=255), nullable=True),
        sa.Column('namespace', sa.String(length=255), nullable=True),
        sa.Column('git_ops_base_path', sa.String(length=512), nullable=True),
        sa.Column('source_branch', sa.String(length=255), nullable=True),
        sa.Column('requires_approval', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('approval_required_role', _existing_role, nullable=True),
        sa.Column('deployment_order', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], name=op.f('fk_environments_project_id_projects'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_environments')),
    )
    op.create_index('ix_environments_project_id', 'environments', ['project_id'], unique=False)

    op.create_table(
        'application_environments',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('application_id', sa.UUID(), nullable=False),
        sa.Column('environment_id', sa.UUID(), nullable=False),
        sa.Column('deployment_name', sa.String(length=255), nullable=False),
        sa.Column('service_name', sa.String(length=255), nullable=True),
        sa.Column('manifest_path', sa.String(length=512), nullable=True),
        sa.Column('replicas', sa.Integer(), nullable=True),
        sa.Column('resource_limits', sa.Text(), nullable=True),
        sa.Column('exposure_type', sa.String(length=32), nullable=True),
        sa.Column('deployment_strategy', sa.String(length=64), nullable=True),
        sa.Column('health_probe_path', sa.String(length=255), nullable=True),
        sa.Column('enabled', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['application_id'], ['applications.id'], name=op.f('fk_application_environments_application_id_applications'), ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['environment_id'], ['environments.id'], name=op.f('fk_application_environments_environment_id_environments'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_application_environments')),
        sa.UniqueConstraint('application_id', 'environment_id', name=op.f('uq_application_environments_application_id')),
    )
    op.create_index('ix_application_environments_application_id', 'application_environments', ['application_id'], unique=False)
    op.create_index('ix_application_environments_environment_id', 'application_environments', ['environment_id'], unique=False)

    op.create_table(
        'environment_validations',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('environment_id', sa.UUID(), nullable=False),
        sa.Column('namespace_status', _validation_status, server_default=sa.text("'PENDING'"), nullable=False),
        sa.Column('namespace_error', sa.Text(), nullable=True),
        sa.Column('branch_status', _validation_status, server_default=sa.text("'PENDING'"), nullable=False),
        sa.Column('branch_error', sa.Text(), nullable=True),
        sa.Column('git_ops_path_status', _validation_status, server_default=sa.text("'PENDING'"), nullable=False),
        sa.Column('git_ops_path_error', sa.Text(), nullable=True),
        sa.Column('overall_status', _validation_status, server_default=sa.text("'PENDING'"), nullable=False),
        sa.Column('validated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['environment_id'], ['environments.id'], name=op.f('fk_environment_validations_environment_id_environments'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_environment_validations')),
        sa.UniqueConstraint('environment_id', name=op.f('uq_environment_validations_environment_id')),
    )


def downgrade() -> None:
    op.drop_table('environment_validations')
    op.drop_index('ix_application_environments_environment_id', table_name='application_environments')
    op.drop_index('ix_application_environments_application_id', table_name='application_environments')
    op.drop_table('application_environments')
    op.drop_index('ix_environments_project_id', table_name='environments')
    op.drop_table('environments')
    op.drop_table('cluster_contexts')
    op.drop_index('ix_applications_project_id', table_name='applications')
    op.drop_index('ix_applications_created_by', table_name='applications')
    op.drop_table('applications')
    op.drop_index('ix_projects_team_id', table_name='projects')
    op.drop_index('ix_projects_created_by', table_name='projects')
    op.drop_table('projects')
    # Drop only the types introduced in this migration.
    # team_member_role is owned by 7dfe3e5ed0c4 and must not be touched here.
    _validation_status.drop(op.get_bind(), checkfirst=True)
    _setup_status.drop(op.get_bind(), checkfirst=True)
