# app/database/database.py
"""Database engine, session factory, and idempotent ALTERs for legacy databases."""

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DB_URL")

if not DATABASE_URL:
    raise RuntimeError("DB_URL not in .env file")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def ensure_quiz_attempts_bonus_columns() -> None:
    """
    create_all() does not ALTER existing tables. Older DBs lack attempt_kind / quiz_snapshot_json.
    Idempotent PostgreSQL-only patch (UndefinedColumn on attempt_kind without migration).
    """
    if engine.dialect.name != "postgresql":
        return

    with engine.begin() as conn:
        conn.execute(
            text(
                """
                ALTER TABLE quiz_attempts
                ADD COLUMN IF NOT EXISTS attempt_kind VARCHAR(32) NOT NULL DEFAULT 'main'
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE quiz_attempts
                ADD COLUMN IF NOT EXISTS quiz_snapshot_json TEXT
                """
            )
        )


def ensure_users_login_key_and_email_nullable() -> None:
    """
    create_all() does not ALTER existing tables. Adds student login_key, makes email nullable,
    then backfills login_key for rows that need it.
    """
    from app.core.student_login_key import build_student_login_key, strip_last_name_for_login

    if engine.dialect.name != "postgresql":
        return

    with engine.begin() as conn:
        conn.execute(
            text(
                """
                ALTER TABLE users
                ADD COLUMN IF NOT EXISTS login_key VARCHAR(128) NULL
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS uq_users_login_key
                ON users (login_key)
                WHERE login_key IS NOT NULL
                """
            )
        )
        conn.execute(text("ALTER TABLE users ALTER COLUMN email DROP NOT NULL"))

    # Backfill login_key for existing students (ORM; small dataset)
    db = SessionLocal()
    try:
        from models.users import User  # noqa: WPS433 — import after tables exist

        q = db.query(User).filter(User.role == "student", User.login_key.is_(None))
        for u in q.all():
            slug = strip_last_name_for_login(u.last_name or "")
            if slug:
                u.login_key = build_student_login_key(u.last_name, u.id)
            else:
                u.login_key = f"student{int(u.id)}"
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def get_db():
    """FastAPI dependency: one Session per request, closed in finally."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
