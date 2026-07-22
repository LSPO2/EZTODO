"""
AI API endpoints
"""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.config import get_settings
from services.ai import TaskParser, ParseContext, ParseResult
from api.v1.auth import get_current_user
from models.user import User

settings = get_settings()
router = APIRouter(prefix="/ai", tags=["ai"])

# Create parser instance
parser = TaskParser()


class ParseTaskRequest(BaseModel):
    text: str
    current_time: str | None = None  # ISO 8601, defaults to server time
    timezone: str | None = None  # IANA format, defaults to UTC
    default_project: str | None = None
    default_tags: list[str] = []


class ParsedTaskResponse(BaseModel):
    title: str
    note: str | None = None
    scheduled_date: str | None = None
    scheduled_at: str | None = None
    due_at: str | None = None
    reminders: list[str] = []
    priority: str | None = None
    project: str | None = None
    tags: list[str] = []
    subtasks: list["ParsedTaskResponse"] = []
    recurrence: dict | None = None
    estimated_minutes: int | None = None
    confidence: str = "high"
    uncertain_fields: list[str] = []


class ParseTaskResponse(BaseModel):
    tasks: list[ParsedTaskResponse]
    confidence: str
    warnings: list[str] = []
    original_text: str


@router.post("/parse-task", response_model=ParseTaskResponse)
async def parse_task(
    request: ParseTaskRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Parse natural language input into structured tasks."""
    # Set defaults
    current_time = request.current_time or datetime.utcnow().isoformat() + "Z"
    timezone = request.timezone or "UTC"

    # Create context
    context = ParseContext(
        current_time=current_time,
        timezone=timezone,
        default_project=request.default_project,
        default_tags=request.default_tags,
    )

    try:
        # Parse task
        result = await parser.parse(request.text, context)

        # Convert to response
        return ParseTaskResponse(
            tasks=[_convert_task(task) for task in result.tasks],
            confidence=result.confidence,
            warnings=result.warnings,
            original_text=result.original_text,
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"AI parsing failed: {str(e)}",
        )


def _convert_task(task) -> ParsedTaskResponse:
    """Convert ParsedTask to ParsedTaskResponse."""
    return ParsedTaskResponse(
        title=task.title,
        note=task.note,
        scheduled_date=task.scheduled_date,
        scheduled_at=task.scheduled_at,
        due_at=task.due_at,
        reminders=task.reminders,
        priority=task.priority,
        project=task.project,
        tags=task.tags,
        subtasks=[_convert_task(sub) for sub in task.subtasks],
        recurrence=task.recurrence.model_dump() if task.recurrence else None,
        estimated_minutes=task.estimated_minutes,
        confidence=task.confidence,
        uncertain_fields=task.uncertain_fields,
    )
