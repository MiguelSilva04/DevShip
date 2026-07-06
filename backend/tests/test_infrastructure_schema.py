import uuid

import pytest
from sqlalchemy.exc import IntegrityError

from backend.bd.models import (
    Application,
    ApplicationEnvironment,
    ClusterContext,
    Environment,
    EnvironmentValidation,
    Project,
    SetupStatus,
    Team,
    TeamMemberRole,
    User,
    ValidationStatus,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_user(email: str = None) -> User:
    return User(
        name="Test User",
        email=email or f"{uuid.uuid4()}@example.com",
        password_hash="hashed",
    )


def make_team(name: str = "Test Team") -> Team:
    return Team(name=name, domain=f"{uuid.uuid4()}.test")


def make_project(team: Team, created_by: User | None = None) -> Project:
    return Project(
        team_id=team.id,
        created_by=created_by.id if created_by else None,
        name="Test Project",
    )


def make_cluster_context(project: Project) -> ClusterContext:
    return ClusterContext(
        project_id=project.id,
        cluster_arn="arn:aws:eks:us-east-1:123456789012:cluster/test",
        cluster_name="test-cluster",
        region="us-east-1",
        eks_endpoint="https://api.example.com",
        ca_certificate="CERT_DATA",
        ca_file_path="/tmp/ca.crt",
        iam_role_arn="arn:aws:iam::123456789012:role/eks-role",
        external_id=str(uuid.uuid4()),
    )


def make_environment(project: Project, name: str = "dev", order: int = 0) -> Environment:
    return Environment(
        project_id=project.id,
        name=name,
        deployment_order=order,
    )


def make_validation(env: Environment) -> EnvironmentValidation:
    return EnvironmentValidation(environment_id=env.id)


def make_application(project: Project, created_by: User | None = None) -> Application:
    return Application(
        project_id=project.id,
        name="Test App",
        source_repository="github.com/org/repo",
        ci_workflow_file="deploy.yml",
        created_by=created_by.id if created_by else None,
    )


def make_app_env(app: Application, env: Environment) -> ApplicationEnvironment:
    return ApplicationEnvironment(
        application_id=app.id,
        environment_id=env.id,
        deployment_name="test-deployment",
    )


# ---------------------------------------------------------------------------
# Project
# ---------------------------------------------------------------------------

def test_create_project_defaults(db_session):
    team = make_team()
    db_session.add(team)
    db_session.flush()

    project = make_project(team)
    db_session.add(project)
    db_session.flush()

    assert project.id is not None
    assert project.setup_status == SetupStatus.PENDING_CLUSTER
    assert project.created_at is not None
    assert project.updated_at is not None
    assert project.created_by is None


def test_project_all_setup_statuses(db_session):
    team = make_team()
    db_session.add(team)
    db_session.flush()

    for status in SetupStatus:
        p = Project(team_id=team.id, name=f"proj-{status.value}", setup_status=status)
        db_session.add(p)
    db_session.flush()


def test_project_created_by_references_user(db_session):
    user = make_user()
    team = make_team()
    db_session.add_all([user, team])
    db_session.flush()

    project = make_project(team, created_by=user)
    db_session.add(project)
    db_session.flush()

    assert project.created_by == user.id


def test_delete_team_cascades_projects(db_session):
    team = make_team()
    db_session.add(team)
    db_session.flush()

    project = make_project(team)
    db_session.add(project)
    db_session.flush()
    project_id = project.id

    db_session.delete(team)
    db_session.flush()

    db_session.expunge(project)
    assert db_session.get(Project, project_id) is None


def test_delete_user_sets_project_created_by_null(db_session):
    user = make_user()
    team = make_team()
    db_session.add_all([user, team])
    db_session.flush()

    project = make_project(team, created_by=user)
    db_session.add(project)
    db_session.flush()

    db_session.delete(user)
    db_session.flush()

    db_session.expire(project)
    db_session.refresh(project)
    assert project.created_by is None


# ---------------------------------------------------------------------------
# ClusterContext
# ---------------------------------------------------------------------------

def test_create_cluster_context(db_session):
    team = make_team()
    db_session.add(team)
    db_session.flush()

    project = make_project(team)
    db_session.add(project)
    db_session.flush()

    ctx = make_cluster_context(project)
    db_session.add(ctx)
    db_session.flush()

    assert ctx.id is not None
    assert ctx.created_at is not None


def test_cluster_context_unique_per_project(db_session):
    team = make_team()
    db_session.add(team)
    db_session.flush()

    project = make_project(team)
    db_session.add(project)
    db_session.flush()

    ctx1 = make_cluster_context(project)
    db_session.add(ctx1)
    db_session.flush()

    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            ctx2 = make_cluster_context(project)
            db_session.add(ctx2)
            db_session.flush()


def test_cluster_context_unique_external_id(db_session):
    team = make_team()
    db_session.add(team)
    db_session.flush()

    project_a = make_project(team)
    project_b = Project(team_id=team.id, name="B")
    db_session.add_all([project_a, project_b])
    db_session.flush()

    shared_external_id = str(uuid.uuid4())

    ctx_a = make_cluster_context(project_a)
    ctx_a.external_id = shared_external_id
    db_session.add(ctx_a)
    db_session.flush()

    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            ctx_b = make_cluster_context(project_b)
            ctx_b.external_id = shared_external_id
            db_session.add(ctx_b)
            db_session.flush()


def test_delete_project_cascades_cluster_context(db_session):
    team = make_team()
    db_session.add(team)
    db_session.flush()

    project = make_project(team)
    db_session.add(project)
    db_session.flush()

    ctx = make_cluster_context(project)
    db_session.add(ctx)
    db_session.flush()
    ctx_id = ctx.id

    db_session.delete(project)
    db_session.flush()

    db_session.expunge(ctx)
    assert db_session.get(ClusterContext, ctx_id) is None


# ---------------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------------

def test_create_environment_defaults(db_session):
    team = make_team()
    db_session.add(team)
    db_session.flush()

    project = make_project(team)
    db_session.add(project)
    db_session.flush()

    env = make_environment(project)
    db_session.add(env)
    db_session.flush()

    assert env.id is not None
    assert env.requires_approval is False
    assert env.approval_required_role is None
    assert env.created_at is not None


def test_multiple_environments_per_project(db_session):
    team = make_team()
    db_session.add(team)
    db_session.flush()

    project = make_project(team)
    db_session.add(project)
    db_session.flush()

    envs = [make_environment(project, name=n, order=i) for i, n in enumerate(["dev", "staging", "prod"])]
    db_session.add_all(envs)
    db_session.flush()

    assert all(e.id is not None for e in envs)


def test_environment_approval_role(db_session):
    team = make_team()
    db_session.add(team)
    db_session.flush()

    project = make_project(team)
    db_session.add(project)
    db_session.flush()

    env = make_environment(project)
    env.requires_approval = True
    env.approval_required_role = TeamMemberRole.TECH_LEAD
    db_session.add(env)
    db_session.flush()

    db_session.expire(env)
    db_session.refresh(env)
    assert env.approval_required_role == TeamMemberRole.TECH_LEAD


def test_delete_project_cascades_environments(db_session):
    team = make_team()
    db_session.add(team)
    db_session.flush()

    project = make_project(team)
    db_session.add(project)
    db_session.flush()

    env = make_environment(project)
    db_session.add(env)
    db_session.flush()
    env_id = env.id

    db_session.delete(project)
    db_session.flush()

    db_session.expunge(env)
    assert db_session.get(Environment, env_id) is None


# ---------------------------------------------------------------------------
# EnvironmentValidation
# ---------------------------------------------------------------------------

def test_create_environment_validation_defaults(db_session):
    team = make_team()
    db_session.add(team)
    db_session.flush()

    project = make_project(team)
    db_session.add(project)
    db_session.flush()

    env = make_environment(project)
    db_session.add(env)
    db_session.flush()

    validation = make_validation(env)
    db_session.add(validation)
    db_session.flush()

    db_session.expire(validation)
    db_session.refresh(validation)
    assert validation.namespace_status == ValidationStatus.PENDING
    assert validation.branch_status == ValidationStatus.PENDING
    assert validation.git_ops_path_status == ValidationStatus.PENDING
    assert validation.overall_status == ValidationStatus.PENDING
    assert validation.validated_at is None


def test_environment_validation_unique_per_environment(db_session):
    team = make_team()
    db_session.add(team)
    db_session.flush()

    project = make_project(team)
    db_session.add(project)
    db_session.flush()

    env = make_environment(project)
    db_session.add(env)
    db_session.flush()

    v1 = make_validation(env)
    db_session.add(v1)
    db_session.flush()

    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            v2 = make_validation(env)
            db_session.add(v2)
            db_session.flush()


def test_delete_environment_cascades_validation(db_session):
    team = make_team()
    db_session.add(team)
    db_session.flush()

    project = make_project(team)
    db_session.add(project)
    db_session.flush()

    env = make_environment(project)
    db_session.add(env)
    db_session.flush()

    validation = make_validation(env)
    db_session.add(validation)
    db_session.flush()
    val_id = validation.id

    db_session.delete(env)
    db_session.flush()

    db_session.expunge(validation)
    assert db_session.get(EnvironmentValidation, val_id) is None


# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------

def test_create_application(db_session):
    team = make_team()
    db_session.add(team)
    db_session.flush()

    project = make_project(team)
    db_session.add(project)
    db_session.flush()

    app = make_application(project)
    db_session.add(app)
    db_session.flush()

    assert app.id is not None
    assert app.created_at is not None
    assert app.created_by is None


def test_delete_project_cascades_applications(db_session):
    team = make_team()
    db_session.add(team)
    db_session.flush()

    project = make_project(team)
    db_session.add(project)
    db_session.flush()

    app = make_application(project)
    db_session.add(app)
    db_session.flush()
    app_id = app.id

    db_session.delete(project)
    db_session.flush()

    db_session.expunge(app)
    assert db_session.get(Application, app_id) is None


def test_delete_user_sets_application_created_by_null(db_session):
    user = make_user()
    team = make_team()
    db_session.add_all([user, team])
    db_session.flush()

    project = make_project(team)
    db_session.add(project)
    db_session.flush()

    app = make_application(project, created_by=user)
    db_session.add(app)
    db_session.flush()

    db_session.delete(user)
    db_session.flush()

    db_session.expire(app)
    db_session.refresh(app)
    assert app.created_by is None


# ---------------------------------------------------------------------------
# ApplicationEnvironment
# ---------------------------------------------------------------------------

def test_create_application_environment(db_session):
    team = make_team()
    db_session.add(team)
    db_session.flush()

    project = make_project(team)
    db_session.add(project)
    db_session.flush()

    env = make_environment(project)
    app = make_application(project)
    db_session.add_all([env, app])
    db_session.flush()

    app_env = make_app_env(app, env)
    db_session.add(app_env)
    db_session.flush()

    assert app_env.id is not None
    assert app_env.enabled is True
    assert app_env.created_at is not None


def test_application_environment_unique_pair(db_session):
    team = make_team()
    db_session.add(team)
    db_session.flush()

    project = make_project(team)
    db_session.add(project)
    db_session.flush()

    env = make_environment(project)
    app = make_application(project)
    db_session.add_all([env, app])
    db_session.flush()

    ae1 = make_app_env(app, env)
    db_session.add(ae1)
    db_session.flush()

    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            ae2 = make_app_env(app, env)
            db_session.add(ae2)
            db_session.flush()


def test_same_app_different_envs_allowed(db_session):
    team = make_team()
    db_session.add(team)
    db_session.flush()

    project = make_project(team)
    db_session.add(project)
    db_session.flush()

    env_dev = make_environment(project, name="dev", order=0)
    env_prod = make_environment(project, name="prod", order=1)
    app = make_application(project)
    db_session.add_all([env_dev, env_prod, app])
    db_session.flush()

    ae_dev = make_app_env(app, env_dev)
    ae_prod = make_app_env(app, env_prod)
    db_session.add_all([ae_dev, ae_prod])
    db_session.flush()

    assert ae_dev.id != ae_prod.id


def test_delete_application_cascades_app_environments(db_session):
    team = make_team()
    db_session.add(team)
    db_session.flush()

    project = make_project(team)
    db_session.add(project)
    db_session.flush()

    env = make_environment(project)
    app = make_application(project)
    db_session.add_all([env, app])
    db_session.flush()

    app_env = make_app_env(app, env)
    db_session.add(app_env)
    db_session.flush()
    ae_id = app_env.id

    db_session.delete(app)
    db_session.flush()

    db_session.expunge(app_env)
    assert db_session.get(ApplicationEnvironment, ae_id) is None


def test_delete_environment_cascades_app_environments(db_session):
    team = make_team()
    db_session.add(team)
    db_session.flush()

    project = make_project(team)
    db_session.add(project)
    db_session.flush()

    env = make_environment(project)
    app = make_application(project)
    db_session.add_all([env, app])
    db_session.flush()

    app_env = make_app_env(app, env)
    db_session.add(app_env)
    db_session.flush()
    ae_id = app_env.id

    db_session.delete(env)
    db_session.flush()

    db_session.expunge(app_env)
    assert db_session.get(ApplicationEnvironment, ae_id) is None
