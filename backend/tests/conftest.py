import os

import pytest
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

load_dotenv()

TEST_DATABASE_URL = os.environ["TEST_DATABASE_URL"]

from backend.api.rate_limit import limiter

limiter.enabled = False


@pytest.fixture(scope="session")
def engine():
    import backend.bd.models  # noqa: F401 — register all models before create_all
    from backend.bd.base import Base

    eng = create_engine(TEST_DATABASE_URL)
    Base.metadata.drop_all(eng)
    Base.metadata.create_all(eng)
    yield eng
    Base.metadata.drop_all(eng)
    eng.dispose()


@pytest.fixture
def db_session(engine):
    """
    Each test runs inside a transaction that is rolled back at the end.
    Use db_session.begin_nested() inside tests that provoke constraint errors
    so that the savepoint absorbs the failure and the session stays usable.
    """
    conn = engine.connect()
    trans = conn.begin()
    session = Session(bind=conn, join_transaction_mode="create_savepoint")
    try:
        yield session
    finally:
        session.close()
        trans.rollback()
        conn.close()
