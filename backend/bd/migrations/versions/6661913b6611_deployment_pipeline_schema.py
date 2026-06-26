"""deployment_pipeline_schema

Revision ID: 6661913b6611
Revises: d51ccc1dd079
Create Date: 2026-06-26 13:30:05.553107

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM as PgENUM


# revision identifiers, used by Alembic.
revision: str = '6661913b6611'
down_revision: Union[str, None] = 'd51ccc1dd079'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# All enum type objects use create_type=False so that op.create_table() does
# not attempt CREATE TYPE — creation is handled explicitly at the top of upgrade().
_deployment_type = PgENUM('STANDARD', 'ROLLBACK', 'REDEPLOY', name='deployment_type', create_type=False)
_request_status = PgENUM(
    'PENDING', 'APPROVED', 'REJECTED', 'RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED',
    name='request_status', create_type=False,
)
_lifecycle_status = PgENUM(
    'Deploying', 'Healthy', 'Degraded', 'Failed', 'RolledBack', 'Superseded',
    name='lifecycle_status', create_type=False,
)
_trigger_source = PgENUM('DEVSHIP', 'EXTERNAL', name='trigger_source', create_type=False)
_deployment_event_type = PgENUM(
    'WORKFLOW_STARTED', 'BUILD_COMPLETED', 'IMAGE_BUILD_FAILED', 'IMAGE_PUSHED',
    'GITOPS_UPDATED', 'SYNC_STARTED', 'SYNC_COMPLETED', 'SYNC_FAILED',
    'ROLLOUT_STARTED', 'ROLLOUT_COMPLETED', 'POD_CREATED',
    'READINESS_PASSED', 'READINESS_FAILED', 'CRASH_LOOP_BACKOFF',
    name='deployment_event_type', create_type=False,
)
_severity = PgENUM('INFO', 'WARNING', 'ERROR', name='severity', create_type=False)
_event_source = PgENUM('KUBERNETES', 'ARGOCD', 'GITHUB', name='event_source', create_type=False)


def upgrade() -> None:
    # ── Create new PostgreSQL enum types first ────────────────────────────────
    _deployment_type.create(op.get_bind(), checkfirst=True)
    _request_status.create(op.get_bind(), checkfirst=True)
    _lifecycle_status.create(op.get_bind(), checkfirst=True)
    _trigger_source.create(op.get_bind(), checkfirst=True)
    _deployment_event_type.create(op.get_bind(), checkfirst=True)
    _severity.create(op.get_bind(), checkfirst=True)
    _event_source.create(op.get_bind(), checkfirst=True)

    # ── Tables (requests first — versions FK to it, events FK to versions) ───
    op.create_table(
        'deployment_requests',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('application_environment_id', sa.UUID(), nullable=False),
        sa.Column('requested_by', sa.UUID(), nullable=True),
        sa.Column('requested_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('approved_by', sa.UUID(), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('source_commit_sha', sa.String(length=40), nullable=True),
        sa.Column('deployment_type', _deployment_type, nullable=False),
        sa.Column('github_workflow_run_id', sa.BigInteger(), nullable=True),
        sa.Column('status', _request_status, server_default=sa.text("'PENDING'"), nullable=False),
        sa.Column('justification', sa.Text(), nullable=True),
        sa.Column('failure_reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "status != 'REJECTED' OR justification IS NOT NULL",
            name=op.f('ck_deployment_requests_justification_required_on_rejection'),
        ),
        sa.ForeignKeyConstraint(
            ['application_environment_id'], ['application_environments.id'],
            name=op.f('fk_deployment_requests_application_environment_id_application_environments'),
            ondelete='CASCADE',
        ),
        sa.ForeignKeyConstraint(
            ['approved_by'], ['users.id'],
            name=op.f('fk_deployment_requests_approved_by_users'),
            ondelete='SET NULL',
        ),
        sa.ForeignKeyConstraint(
            ['requested_by'], ['users.id'],
            name=op.f('fk_deployment_requests_requested_by_users'),
            ondelete='SET NULL',
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_deployment_requests')),
    )
    op.create_index('ix_deployment_requests_application_environment_id', 'deployment_requests', ['application_environment_id'], unique=False)
    op.create_index('ix_deployment_requests_approved_by', 'deployment_requests', ['approved_by'], unique=False)
    op.create_index('ix_deployment_requests_requested_by', 'deployment_requests', ['requested_by'], unique=False)
    op.create_index('ix_deployment_requests_status', 'deployment_requests', ['status'], unique=False)

    op.create_table(
        'deployment_versions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('application_environment_id', sa.UUID(), nullable=False),
        sa.Column('deployment_request_id', sa.UUID(), nullable=True),
        sa.Column('image_tag', sa.String(length=255), nullable=True),
        sa.Column('image_digest', sa.String(length=128), nullable=True),
        sa.Column('version_label', sa.String(length=255), nullable=True),
        sa.Column('git_ops_commit_sha', sa.String(length=40), nullable=True),
        sa.Column('source_commit_sha', sa.String(length=40), nullable=True),
        sa.Column('argocd_sync_revision', sa.String(length=64), nullable=True),
        sa.Column('kubernetes_deployment_revision', sa.String(length=64), nullable=True),
        sa.Column('lifecycle_status', _lifecycle_status, server_default=sa.text("'Deploying'"), nullable=False),
        sa.Column('trigger_source', _trigger_source, server_default=sa.text("'DEVSHIP'"), nullable=False),
        sa.Column('deployed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(
            ['application_environment_id'], ['application_environments.id'],
            name=op.f('fk_deployment_versions_application_environment_id_application_environments'),
            ondelete='CASCADE',
        ),
        sa.ForeignKeyConstraint(
            ['deployment_request_id'], ['deployment_requests.id'],
            name=op.f('fk_deployment_versions_deployment_request_id_deployment_requests'),
            ondelete='SET NULL',
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_deployment_versions')),
        sa.UniqueConstraint('deployment_request_id', name=op.f('uq_deployment_versions_deployment_request_id')),
    )
    op.create_index('ix_deployment_versions_application_environment_id', 'deployment_versions', ['application_environment_id'], unique=False)
    op.create_index('ix_deployment_versions_lifecycle_status', 'deployment_versions', ['lifecycle_status'], unique=False)

    op.create_table(
        'deployment_events',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('deployment_version_id', sa.UUID(), nullable=False),
        sa.Column('event_type', _deployment_event_type, nullable=False),
        sa.Column('source', _event_source, nullable=False),
        sa.Column('message', sa.Text(), nullable=True),
        sa.Column('severity', _severity, nullable=False),
        sa.Column('raw_payload', sa.Text(), nullable=True),
        sa.Column('event_timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(
            ['deployment_version_id'], ['deployment_versions.id'],
            name=op.f('fk_deployment_events_deployment_version_id_deployment_versions'),
            ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_deployment_events')),
    )
    op.create_index('ix_deployment_events_deployment_version_id', 'deployment_events', ['deployment_version_id'], unique=False)
    op.create_index('ix_deployment_events_event_timestamp', 'deployment_events', ['event_timestamp'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_deployment_events_event_timestamp', table_name='deployment_events')
    op.drop_index('ix_deployment_events_deployment_version_id', table_name='deployment_events')
    op.drop_table('deployment_events')
    op.drop_index('ix_deployment_versions_lifecycle_status', table_name='deployment_versions')
    op.drop_index('ix_deployment_versions_application_environment_id', table_name='deployment_versions')
    op.drop_table('deployment_versions')
    op.drop_index('ix_deployment_requests_status', table_name='deployment_requests')
    op.drop_index('ix_deployment_requests_requested_by', table_name='deployment_requests')
    op.drop_index('ix_deployment_requests_approved_by', table_name='deployment_requests')
    op.drop_index('ix_deployment_requests_application_environment_id', table_name='deployment_requests')
    op.drop_table('deployment_requests')
    # Drop all enum types introduced in this migration (reverse dependency order).
    _event_source.drop(op.get_bind(), checkfirst=True)
    _severity.drop(op.get_bind(), checkfirst=True)
    _deployment_event_type.drop(op.get_bind(), checkfirst=True)
    _trigger_source.drop(op.get_bind(), checkfirst=True)
    _lifecycle_status.drop(op.get_bind(), checkfirst=True)
    _request_status.drop(op.get_bind(), checkfirst=True)
    _deployment_type.drop(op.get_bind(), checkfirst=True)
