from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from .config import settings

# Async engine — used by FastAPI route handlers
async_engine = create_async_engine(settings.database_url, echo=False)
AsyncSessionLocal = async_sessionmaker(async_engine, expire_on_commit=False)

# Sync engine — used by Celery workers
sync_engine = create_engine(settings.database_sync_url, echo=False)
SyncSessionLocal = sessionmaker(sync_engine)


async def get_async_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session
