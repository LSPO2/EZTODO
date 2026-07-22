"""
Sync service for synchronization
"""

from datetime import datetime
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from models.sync import SyncOperation, SyncCursor
from models.user import User


async def get_user_cursor(db: AsyncSession, user_id: str) -> int:
    """Get the current sync cursor for a user."""
    result = await db.execute(select(SyncCursor).where(SyncCursor.user_id == user_id))
    cursor = result.scalar_one_or_none()

    if cursor:
        return cursor.last_cursor
    return 0


async def update_user_cursor(db: AsyncSession, user_id: str, new_cursor: int) -> None:
    """Update the sync cursor for a user."""
    result = await db.execute(select(SyncCursor).where(SyncCursor.user_id == user_id))
    cursor = result.scalar_one_or_none()

    if cursor:
        cursor.last_cursor = new_cursor
        cursor.updated_at = datetime.utcnow()
    else:
        cursor = SyncCursor(user_id=user_id, last_cursor=new_cursor)
        db.add(cursor)

    await db.commit()


async def create_sync_operation(
    db: AsyncSession,
    user_id: str,
    operation_id: str,
    entity_type: str,
    entity_id: str,
    operation: str,
    payload: dict,
    base_revision: Optional[int] = None,
) -> SyncOperation:
    """Create a new sync operation."""
    # Get next server version
    result = await db.execute(
        select(SyncOperation.server_version)
        .where(SyncOperation.user_id == user_id)
        .order_by(desc(SyncOperation.server_version))
        .limit(1)
    )
    last_version = result.scalar_one_or_none() or 0
    new_version = last_version + 1

    sync_op = SyncOperation(
        user_id=user_id,
        operation_id=operation_id,
        entity_type=entity_type,
        entity_id=entity_id,
        operation=operation,
        payload=payload,
        base_revision=base_revision,
        server_version=new_version,
    )
    db.add(sync_op)

    # Update user cursor
    await update_user_cursor(db, user_id, new_version)

    await db.commit()
    await db.refresh(sync_op)

    return sync_op


async def get_sync_operations(
    db: AsyncSession,
    user_id: str,
    cursor: int = 0,
    limit: int = 100,
) -> tuple[list[SyncOperation], int]:
    """Get sync operations for a user after a cursor."""
    result = await db.execute(
        select(SyncOperation)
        .where(
            SyncOperation.user_id == user_id,
            SyncOperation.server_version > cursor,
        )
        .order_by(SyncOperation.server_version)
        .limit(limit)
    )
    operations = list(result.scalars().all())

    # Get next cursor
    next_cursor = operations[-1].server_version if operations else cursor

    return operations, next_cursor


async def check_operation_exists(db: AsyncSession, operation_id: str) -> bool:
    """Check if an operation already exists (for idempotency)."""
    result = await db.execute(
        select(SyncOperation).where(SyncOperation.operation_id == operation_id)
    )
    return result.scalar_one_or_none() is not None


async def get_operation_by_id(db: AsyncSession, operation_id: str) -> Optional[SyncOperation]:
    """Get an operation by its operation_id."""
    result = await db.execute(
        select(SyncOperation).where(SyncOperation.operation_id == operation_id)
    )
    return result.scalar_one_or_none()


async def process_sync_push(
    db: AsyncSession,
    user_id: str,
    operations: list[dict],
) -> dict:
    """Process a batch of sync operations from client."""
    accepted = []
    rejected = []
    last_version = 0

    for op_data in operations:
        operation_id = op_data.get("operation_id")

        # Check idempotency
        if await check_operation_exists(db, operation_id):
            existing = await get_operation_by_id(db, operation_id)
            accepted.append(operation_id)
            last_version = max(last_version, existing.server_version)
            continue

        try:
            # Create sync operation
            sync_op = await create_sync_operation(
                db=db,
                user_id=user_id,
                operation_id=operation_id,
                entity_type=op_data.get("entity_type"),
                entity_id=op_data.get("entity_id"),
                operation=op_data.get("operation"),
                payload=op_data.get("payload"),
                base_revision=op_data.get("base_revision"),
            )
            accepted.append(operation_id)
            last_version = max(last_version, sync_op.server_version)
        except Exception as e:
            rejected.append({
                "operation_id": operation_id,
                "error": str(e),
            })

    # Get current cursor
    current_cursor = await get_user_cursor(db, user_id)

    return {
        "accepted": accepted,
        "rejected": rejected,
        "server_version": current_cursor,
    }
