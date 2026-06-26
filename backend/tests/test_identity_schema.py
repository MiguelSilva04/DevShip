import uuid

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DataError, IntegrityError

from backend.bd.models import Team, TeamMember, TeamMemberRole, User


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_user(email: str = None, name: str = "Test User") -> User:
    return User(
        name=name,
        email=email or f"{uuid.uuid4()}@example.com",
        password_hash="hashed_password",
    )


def make_team(name: str = "Test Team") -> Team:
    return Team(name=name)


def make_member(
    team: Team,
    user: User,
    role: TeamMemberRole = TeamMemberRole.DEVELOPER,
    added_by: uuid.UUID | None = None,
) -> TeamMember:
    return TeamMember(
        team_id=team.id,
        user_id=user.id,
        role=role,
        added_by=added_by,
    )


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------

def test_create_user(db_session):
    user = make_user(email="alice@example.com")
    db_session.add(user)
    db_session.flush()

    assert user.id is not None
    assert user.created_at is not None
    assert user.updated_at is not None


def test_duplicate_email_raises(db_session):
    user1 = make_user(email="dup@example.com")
    db_session.add(user1)
    db_session.flush()

    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            user2 = make_user(email="dup@example.com")
            db_session.add(user2)
            db_session.flush()


# ---------------------------------------------------------------------------
# Team
# ---------------------------------------------------------------------------

def test_create_team(db_session):
    team = make_team("Alpha")
    db_session.add(team)
    db_session.flush()

    assert team.id is not None
    assert team.created_at is not None


# ---------------------------------------------------------------------------
# TeamMember
# ---------------------------------------------------------------------------

def test_create_team_member(db_session):
    user = make_user()
    team = make_team()
    db_session.add_all([user, team])
    db_session.flush()

    member = make_member(team, user)
    db_session.add(member)
    db_session.flush()

    assert member.id is not None
    assert member.joined_at is not None
    assert member.added_by is None


def test_duplicate_team_member_raises(db_session):
    user = make_user()
    team = make_team()
    db_session.add_all([user, team])
    db_session.flush()

    member1 = make_member(team, user)
    db_session.add(member1)
    db_session.flush()

    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            member2 = make_member(team, user, role=TeamMemberRole.TECH_LEAD)
            db_session.add(member2)
            db_session.flush()


def test_invalid_role_raises(db_session):
    user = make_user()
    team = make_team()
    db_session.add_all([user, team])
    db_session.flush()

    with pytest.raises((DataError, Exception)):
        with db_session.begin_nested():
            db_session.execute(
                text(
                    "INSERT INTO team_members (id, team_id, user_id, role, joined_at)"
                    " VALUES (:id, :team_id, :user_id, 'INVALID_ROLE', NOW())"
                ),
                {
                    "id": str(uuid.uuid4()),
                    "team_id": str(team.id),
                    "user_id": str(user.id),
                },
            )


def test_added_by_null_self_onboarding(db_session):
    user = make_user()
    team = make_team()
    db_session.add_all([user, team])
    db_session.flush()

    member = make_member(team, user, added_by=None)
    db_session.add(member)
    db_session.flush()

    assert member.added_by is None


def test_same_user_in_two_teams(db_session):
    user = make_user()
    team_a = make_team("Team A")
    team_b = make_team("Team B")
    db_session.add_all([user, team_a, team_b])
    db_session.flush()

    member_a = make_member(team_a, user, role=TeamMemberRole.DEVELOPER)
    member_b = make_member(team_b, user, role=TeamMemberRole.TECH_LEAD)
    db_session.add_all([member_a, member_b])
    db_session.flush()

    assert member_a.role == TeamMemberRole.DEVELOPER
    assert member_b.role == TeamMemberRole.TECH_LEAD


# ---------------------------------------------------------------------------
# ON DELETE CASCADE — Team
# ---------------------------------------------------------------------------

def test_delete_team_cascades_members(db_session):
    user = make_user()
    team = make_team()
    db_session.add_all([user, team])
    db_session.flush()

    member = make_member(team, user)
    db_session.add(member)
    db_session.flush()
    member_id = member.id

    db_session.delete(team)
    db_session.flush()

    # Expunge so get() goes to the DB instead of the identity map
    db_session.expunge(member)
    assert db_session.get(TeamMember, member_id) is None


# ---------------------------------------------------------------------------
# ON DELETE CASCADE — User
# ---------------------------------------------------------------------------

def test_delete_user_cascades_members(db_session):
    user = make_user()
    team = make_team()
    db_session.add_all([user, team])
    db_session.flush()

    member = make_member(team, user)
    db_session.add(member)
    db_session.flush()
    member_id = member.id

    db_session.delete(user)
    db_session.flush()

    # Expunge so get() goes to the DB instead of the identity map
    db_session.expunge(member)
    assert db_session.get(TeamMember, member_id) is None


# ---------------------------------------------------------------------------
# ON DELETE SET NULL — added_by
# ---------------------------------------------------------------------------

def test_delete_adder_sets_added_by_null(db_session):
    adder = make_user(email="adder@example.com")
    member_user = make_user(email="member@example.com")
    team = make_team()
    db_session.add_all([adder, member_user, team])
    db_session.flush()

    member = make_member(team, member_user, added_by=adder.id)
    db_session.add(member)
    db_session.flush()

    assert member.added_by == adder.id

    db_session.delete(adder)
    db_session.flush()

    db_session.expire(member)
    db_session.refresh(member)
    assert member.added_by is None
