"""
AI Provider interface and data models
"""

from abc import ABC, abstractmethod
from typing import Optional
from pydantic import BaseModel


class ParseContext(BaseModel):
    """Context for task parsing"""
    current_time: str  # ISO 8601
    timezone: str  # IANA format
    default_project: Optional[str] = None
    default_tags: list[str] = []


class RecurrenceConfig(BaseModel):
    """Recurrence configuration"""
    frequency: str  # daily, weekdays, weekly, monthly, yearly
    interval: int = 1
    days_of_week: Optional[list[int]] = None
    day_of_month: Optional[int] = None
    month_of_year: Optional[int] = None
    end_date: Optional[str] = None
    max_occurrences: Optional[int] = None


class ParsedTask(BaseModel):
    """A single parsed task"""
    title: str
    note: Optional[str] = None
    scheduled_date: Optional[str] = None  # YYYY-MM-DD
    scheduled_at: Optional[str] = None  # ISO 8601
    due_at: Optional[str] = None  # ISO 8601
    reminders: list[str] = []  # ISO 8601 list
    priority: Optional[str] = None  # p1, p2, p3, p4, none
    project: Optional[str] = None
    tags: list[str] = []
    subtasks: list["ParsedTask"] = []
    recurrence: Optional[RecurrenceConfig] = None
    estimated_minutes: Optional[int] = None
    confidence: str = "high"  # high, medium, low
    uncertain_fields: list[str] = []


class ParseResult(BaseModel):
    """Result of task parsing"""
    tasks: list[ParsedTask]
    confidence: str  # high, medium, low
    warnings: list[str] = []
    original_text: str


class TaskParserProvider(ABC):
    """Abstract base class for task parser providers"""

    @abstractmethod
    async def parse_task(self, input_text: str, context: ParseContext) -> ParseResult:
        """
        Parse natural language input into structured tasks.

        Args:
            input_text: The user's natural language input
            context: Context including current time, timezone, etc.

        Returns:
            ParseResult with parsed tasks, confidence, and warnings
        """
        pass

    @abstractmethod
    async def is_available(self) -> bool:
        """
        Check if the AI provider is available.

        Returns:
            True if the provider can be used
        """
        pass
