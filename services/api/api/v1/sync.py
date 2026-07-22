"""
Sync API endpoints
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.sync import get_sync_operations, process_sync_push
from api.v1.auth import get_current_user
from models.user import User

router = APIRouter(prefix="/sync", tags=["sync"])


# Request/Response models
class SyncOperationRequest(BaseModel):
    operation_id: str
    entity_type: str
    entity_id: str
    operation: str
    payload: dict
    base_revision: Optional[int] = None


class SyncPushRequest(BaseModel):
    operations: list[SyncOperationRequest]


class SyncPushResponse(BaseModel):
    accepted: list[str]
    rejected: list[dict]
    server_version: int


class SyncOperationResponse(BaseModel):
    operation_id: str
    entity_type: str
    entity_id: str
    operation: str
    payload: dict
    server_version: int
    created_at: str


class SyncPullResponse(BaseModel):
    operations: list[SyncOperationResponse]
    next_cursor: int
    has_more: bool


class ErrorResponse(BaseModel):
    code: str
    message: str


@router.post("/push", response_model=SyncPushResponse)
async def sync_push(
    request: SyncPushRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Push local operations to server."""
    # Convert to dict format
    operations = [
        {
            "operation_id": str(op.operation_id),
            "entity_type": op.entity_type,
            "entity_id": str(op.entity_id),
            "operation": op.operation,
            "payload": op.payload,
            "base_revision": op.base_revision,
        }
        for op in request.operations
    ]

    # Process push
    result = await process_sync_push(
        db=db,
        user_id=str(current_user.id),
        operations=operations,
    )

    return SyncPushResponse(
        accepted=result["accepted"],
        rejected=result["rejected"],
        server_version=result["server_version"],
    )


@router.get("/pull", response_model=SyncPullResponse)
async def sync_pull(
    cursor: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Pull remote operations from server."""
    # Validate limit
    if limit > 1000:
        limit = 1000

    # Get operations
    operations, next_cursor = await get_sync_operations(
        db=db,
        user_id=str(current_user.id),
        cursor=cursor,
        limit=limit + 1,  # Get one extra to check if there are more
    )

    # Check if there are more
    has_more = len(operations) > limit
    if has_more:
        operations = operations[:limit]

    return SyncPullResponse(
        operations=[
            SyncOperationResponse(
                operation_id=str(op.operation_id),
                entity_type=op.entity_type,
                entity_id=str(op.entity_id),
                operation=op.operation,
                payload=op.payload,
                server_version=op.server_version,
                created_at=op.created_at.isoformat(),
            )
            for op in operations
        ],
        next_cursor=next_cursor,
        has_more=has_more,
    )
