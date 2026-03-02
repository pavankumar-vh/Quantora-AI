"""
Quantora AI — Database Engine & Session
========================================
Async SQLAlchemy with SQLite (dev) or PostgreSQL (prod).
"""

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.config import get_settings


class Base(DeclarativeBase):
    pass


import ssl as _ssl

_settings = get_settings()

# Auto-fix PostgreSQL URL for asyncpg driver
_db_url = _settings.database_url
_is_pg = False
if _db_url.startswith("postgresql+asyncpg://"):
    _is_pg = True
elif _db_url.startswith("postgresql://"):
    _db_url = _db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    _is_pg = True
elif _db_url.startswith("postgres://"):
    _db_url = _db_url.replace("postgres://", "postgresql+asyncpg://", 1)
    _is_pg = True

if _is_pg:
    # Supabase/cloud PostgreSQL requires SSL + no prepared statements for pooler
    _ssl_ctx = _ssl.create_default_context()
    _ssl_ctx.check_hostname = False
    _ssl_ctx.verify_mode = _ssl.CERT_NONE
    engine = create_async_engine(
        _db_url,
        echo=_settings.debug,
        connect_args={"ssl": _ssl_ctx, "prepared_statement_cache_size": 0},
    )
else:
    engine = create_async_engine(
        _db_url,
        echo=_settings.debug,
        connect_args={"check_same_thread": False} if "sqlite" in _db_url else {},
    )

async_session = async_sessionmaker(engine, expire_on_commit=False)


async def init_db():
    """Create all tables. Called on startup."""
    async with engine.begin() as conn:
        from app.models import transaction, alert, user, bank_connection  # noqa: F401
        await conn.run_sync(Base.metadata.create_all)


async def get_db() -> AsyncSession:
    """Dependency injection for FastAPI endpoints."""
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
