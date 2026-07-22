"""
Task parser with deterministic rules and AI fallback
"""

import re
from datetime import datetime, timedelta
from typing import Optional

from .provider import (
    TaskParserProvider,
    ParseContext,
    ParseResult,
    ParsedTask,
    RecurrenceConfig,
)
from .deepseek import DeepSeekProvider


class TaskParser:
    """Task parser with deterministic rules and AI fallback"""

    def __init__(self, provider: Optional[TaskParserProvider] = None):
        self.provider = provider or DeepSeekProvider()

    async def parse(self, input_text: str, context: ParseContext) -> ParseResult:
        """
        Parse input text with deterministic rules first, then AI fallback.

        Args:
            input_text: User's natural language input
            context: Parse context with time, timezone, etc.

        Returns:
            ParseResult with parsed tasks
        """
        # Apply deterministic rules first
        deterministic_result = self._apply_deterministic_rules(input_text, context)

        # If deterministic rules found high confidence results, return them
        if deterministic_result.confidence == "high":
            return deterministic_result

        # Otherwise, use AI provider
        try:
            ai_result = await self.provider.parse_task(input_text, context)

            # Merge deterministic results with AI results
            return self._merge_results(deterministic_result, ai_result)

        except Exception as e:
            # If AI fails, return deterministic results
            if deterministic_result.tasks:
                return deterministic_result

            # Otherwise, return low confidence result
            return ParseResult(
                tasks=[ParsedTask(
                    title=input_text.strip(),
                    confidence="low",
                    uncertain_fields=["all"],
                )],
                confidence="low",
                warnings=[f"AI 解析失败: {str(e)}"],
                original_text=input_text,
            )

    def _apply_deterministic_rules(self, text: str, context: ParseContext) -> ParseResult:
        """Apply deterministic rules to extract obvious patterns."""
        warnings = []
        tasks = []

        # Extract date/time patterns
        scheduled_date, scheduled_at, due_at, reminders = self._extract_datetime(text, context)

        # Extract priority
        priority = self._extract_priority(text)

        # Extract recurrence
        recurrence = self._extract_recurrence(text)

        # Clean title
        title = self._clean_title(text)

        if title:
            task = ParsedTask(
                title=title,
                scheduled_date=scheduled_date,
                scheduled_at=scheduled_at,
                due_at=due_at,
                reminders=reminders,
                priority=priority,
                recurrence=recurrence,
                confidence="high" if (scheduled_date or scheduled_at or due_at) else "medium",
            )
            tasks.append(task)

        return ParseResult(
            tasks=tasks,
            confidence="high" if tasks else "low",
            warnings=warnings,
            original_text=text,
        )

    def _extract_datetime(
        self, text: str, context: ParseContext
    ) -> tuple[Optional[str], Optional[str], Optional[str], list[str]]:
        """Extract date and time from text."""
        now = datetime.fromisoformat(context.current_time.replace("Z", "+00:00"))
        scheduled_date = None
        scheduled_at = None
        due_at = None
        reminders = []

        # Date patterns
        date_patterns = {
            r"今天": now.strftime("%Y-%m-%d"),
            r"明天": (now + timedelta(days=1)).strftime("%Y-%m-%d"),
            r"后天": (now + timedelta(days=2)).strftime("%Y-%m-%d"),
            r"大后天": (now + timedelta(days=3)).strftime("%Y-%m-%d"),
        }

        for pattern, date in date_patterns.items():
            if re.search(pattern, text):
                scheduled_date = date
                break

        # Next week patterns
        if re.search(r"下周", text):
            days_until_next_monday = (7 - now.weekday()) % 7
            if days_until_next_monday == 0:
                days_until_next_monday = 7
            scheduled_date = (now + timedelta(days=days_until_next_monday)).strftime("%Y-%m-%d")

        # This month end
        if re.search(r"月底", text):
            if now.month == 12:
                scheduled_date = f"{now.year + 1}-01-01"
            else:
                scheduled_date = f"{now.year}-{now.month + 1:02d}-01"
                # Get last day of current month
                last_day = datetime(now.year, now.month + 1, 1) - timedelta(days=1)
                scheduled_date = last_day.strftime("%Y-%m-%d")

        # Time patterns
        time_patterns = {
            r"上午(\d{1,2})点": lambda m: f"{int(m.group(1)):02d}:00",
            r"下午(\d{1,2})点": lambda m: f"{int(m.group(1)) + 12:02d}:00",
            r"晚上(\d{1,2})点": lambda m: f"{int(m.group(1)) + 12:02d}:00",
            r"(\d{1,2}):(\d{2})": lambda m: f"{int(m.group(1)):02d}:{int(m.group(2)):02d}",
            r"(\d{1,2})点半": lambda m: f"{int(m.group(1)):02d}:30",
        }

        for pattern, time_func in time_patterns.items():
            match = re.search(pattern, text)
            if match:
                time_str = time_func(match)
                if scheduled_date:
                    scheduled_at = f"{scheduled_date}T{time_str}:00"
                else:
                    scheduled_at = f"{now.strftime('%Y-%m-%d')}T{time_str}:00"
                break

        # Reminder patterns
        if re.search(r"提前一天提醒", text):
            if scheduled_at:
                remind_time = datetime.fromisoformat(scheduled_at) - timedelta(days=1)
                reminders.append(remind_time.isoformat())
            elif scheduled_date:
                remind_date = datetime.strptime(scheduled_date, "%Y-%m-%d") - timedelta(days=1)
                reminders.append(remind_date.strftime("%Y-%m-%d"))

        if re.search(r"提前一小时提醒", text):
            if scheduled_at:
                remind_time = datetime.fromisoformat(scheduled_at) - timedelta(hours=1)
                reminders.append(remind_time.isoformat())

        # Due date patterns
        if re.search(r"前交|之前完成|截止", text):
            if scheduled_date:
                due_at = f"{scheduled_date}T23:59:59"
            elif scheduled_at:
                due_at = scheduled_at

        return scheduled_date, scheduled_at, due_at, reminders

    def _extract_priority(self, text: str) -> Optional[str]:
        """Extract priority from text."""
        if re.search(r"紧急|重要|立即|马上|尽快", text):
            return "p1"
        if re.search(r"优先|赶紧", text):
            return "p2"
        if re.search(r"有空|闲了|不急", text):
            return "p3"
        return None

    def _extract_recurrence(self, text: str) -> Optional[RecurrenceConfig]:
        """Extract recurrence rule from text."""
        if re.search(r"每天|每日", text):
            return RecurrenceConfig(frequency="daily")

        if re.search(r"工作日|周一到周五", text):
            return RecurrenceConfig(frequency="weekdays")

        # Weekly patterns
        week_match = re.search(r"每周([一二三四五六日]+)", text)
        if week_match:
            days_map = {"一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "日": 0}
            days = [days_map[d] for d in week_match.group(1)]
            return RecurrenceConfig(frequency="weekly", days_of_week=days)

        if re.search(r"每周", text):
            return RecurrenceConfig(frequency="weekly")

        if re.search(r"每月|每个月", text):
            return RecurrenceConfig(frequency="monthly")

        if re.search(r"每年|每年", text):
            return RecurrenceConfig(frequency="yearly")

        return None

    def _clean_title(self, text: str) -> str:
        """Clean and extract task title from text."""
        # Remove time/date related words
        remove_patterns = [
            r"今天|明天|后天|大后天",
            r"下周|月底|年底",
            r"上午|下午|晚上",
            r"\d{1,2}点(?:半)?",
            r"\d{1,2}:\d{2}",
            r"提前(?:一天|一小时)提醒",
            r"前交|之前完成|截止",
            r"每天|每日|工作日|每周[一二三四五六日]?|每月|每年",
            r"紧急|重要|立即|马上|尽快|优先|有空|闲了",
        ]

        title = text
        for pattern in remove_patterns:
            title = re.sub(pattern, "", title)

        # Clean up punctuation and whitespace
        title = re.sub(r"[，,。.、；;：:！!？?\s]+", " ", title)
        title = title.strip()

        # If title is empty or too short, use original text
        if len(title) < 2:
            title = text.strip()

        return title

    def _merge_results(
        self, deterministic: ParseResult, ai: ParseResult
    ) -> ParseResult:
        """Merge deterministic and AI results."""
        if not deterministic.tasks:
            return ai

        if not ai.tasks:
            return deterministic

        # Use AI result as primary, but keep deterministic date/time if AI didn't find any
        merged_tasks = []
        for ai_task in ai.tasks:
            # Find matching deterministic task
            det_task = None
            for dt in deterministic.tasks:
                if self._titles_similar(ai_task.title, dt.title):
                    det_task = dt
                    break

            if det_task:
                # Merge: use AI fields, fallback to deterministic for missing dates
                merged = ai_task.model_copy()
                if not merged.scheduled_date and not merged.scheduled_at:
                    merged.scheduled_date = det_task.scheduled_date
                    merged.scheduled_at = det_task.scheduled_at
                if not merged.due_at:
                    merged.due_at = det_task.due_at
                if not merged.reminders and det_task.reminders:
                    merged.reminders = det_task.reminders
                if not merged.priority and det_task.priority:
                    merged.priority = det_task.priority
                if not merged.recurrence and det_task.recurrence:
                    merged.recurrence = det_task.recurrence
                merged_tasks.append(merged)
            else:
                merged_tasks.append(ai_task)

        # Add deterministic tasks not in AI result
        for det_task in deterministic.tasks:
            found = False
            for ai_task in ai.tasks:
                if self._titles_similar(det_task.title, ai_task.title):
                    found = True
                    break
            if not found:
                merged_tasks.append(det_task)

        return ParseResult(
            tasks=merged_tasks,
            confidence=ai.confidence,
            warnings=ai.warnings + deterministic.warnings,
            original_text=ai.original_text,
        )

    def _titles_similar(self, title1: str, title2: str) -> bool:
        """Check if two titles are similar."""
        # Simple similarity check
        t1 = title1.strip().lower()
        t2 = title2.strip().lower()

        if t1 == t2:
            return True

        # Check if one contains the other
        if t1 in t2 or t2 in t1:
            return True

        return False
