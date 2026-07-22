/**
 * Time handling module
 * Handles timezone conversion, date formatting, and time calculations
 */

export interface TimeInfo {
  utc: string;           // ISO 8601 UTC
  local: string;         // 本地时间显示
  timezone: string;      // IANA 时区
  isAllDay: boolean;     // 是否全天任务
  date?: string;         // 全天任务日期 YYYY-MM-DD
}

export interface TimeDisplay {
  relative: string;      // 相对时间（如"今天"、"明天"）
  absolute: string;      // 绝对时间（如"2026-07-22 15:00"）
  isOverdue: boolean;    // 是否已逾期
}

/**
 * 获取系统时区
 */
export function getSystemTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * 解析时间输入
 */
export function parseTime(input: string, timezone?: string): TimeInfo {
  const tz = timezone || getSystemTimezone();
  const date = new Date(input);

  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${input}`);
  }

  // 检查是否是全天任务（只有日期，没有时间）
  const isAllDay = !input.includes('T') || input.endsWith('T00:00:00');

  return {
    utc: date.toISOString(),
    local: formatForDisplay(date.toISOString(), tz),
    timezone: tz,
    isAllDay,
    date: isAllDay ? input.split('T')[0] : undefined,
  };
}

/**
 * 格式化为本地显示时间
 */
export function formatForDisplay(utc: string, timezone: string): string {
  const date = new Date(utc);

  return date.toLocaleString('zh-CN', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * 格式化日期
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/**
 * 格式化时间
 */
export function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * 检查是否已逾期
 */
export function isOverdue(dueAt: string): boolean {
  const now = new Date();
  const due = new Date(dueAt);
  return due < now;
}

/**
 * 检查是否是今天
 */
export function isToday(dateStr: string): boolean {
  const date = new Date(dateStr);
  const today = new Date();

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

/**
 * 检查是否是明天
 */
export function isTomorrow(dateStr: string): boolean {
  const date = new Date(dateStr);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  return (
    date.getFullYear() === tomorrow.getFullYear() &&
    date.getMonth() === tomorrow.getMonth() &&
    date.getDate() === tomorrow.getDate()
  );
}

/**
 * 检查是否是昨天
 */
export function isYesterday(dateStr: string): boolean {
  const date = new Date(dateStr);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  return (
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()
  );
}

/**
 * 检查是否在本周
 */
export function isThisWeek(dateStr: string): boolean {
  const date = new Date(dateStr);
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  return date >= startOfWeek && date < endOfWeek;
}

/**
 * 检查是否在未来7天内
 */
export function isWithinNext7Days(dateStr: string): boolean {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);

  return date >= today && date < nextWeek;
}

/**
 * 获取相对时间描述
 */
export function getRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (isToday(dateStr)) {
    return '今天';
  } else if (isTomorrow(dateStr)) {
    return '明天';
  } else if (isYesterday(dateStr)) {
    return '昨天';
  } else if (diffDays > 0 && diffDays <= 7) {
    return `${diffDays}天后`;
  } else if (diffDays < 0 && diffDays >= -7) {
    return `${Math.abs(diffDays)}天前`;
  } else {
    return formatDate(dateStr);
  }
}

/**
 * 获取时间显示信息
 */
export function getTimeDisplay(dateStr: string, timezone?: string): TimeDisplay {
  const tz = timezone || getSystemTimezone();
  const date = new Date(dateStr);
  const now = new Date();

  return {
    relative: getRelativeTime(dateStr),
    absolute: formatForDisplay(dateStr, tz),
    isOverdue: date < now,
  };
}

/**
 * 创建今天日期字符串
 */
export function todayString(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * 创建明天日期字符串
 */
export function tomorrowString(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
}

/**
 * 计算两个日期之间的天数
 */
export function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffMs = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * 添加天数到日期
 */
export function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

/**
 * 添加小时到时间
 */
export function addHours(dateStr: string, hours: number): string {
  const date = new Date(dateStr);
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}

/**
 * 添加分钟到时间
 */
export function addMinutes(dateStr: string, minutes: number): string {
  const date = new Date(dateStr);
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
}

/**
 * 获取今天的开始时间
 */
export function startOfDay(dateStr?: string): string {
  const date = dateStr ? new Date(dateStr) : new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

/**
 * 获取今天的结束时间
 */
export function endOfDay(dateStr?: string): string {
  const date = dateStr ? new Date(dateStr) : new Date();
  date.setHours(23, 59, 59, 999);
  return date.toISOString();
}

/**
 * 检查时间是否在范围内
 */
export function isInRange(dateStr: string, start: string, end: string): boolean {
  const date = new Date(dateStr);
  const startDate = new Date(start);
  const endDate = new Date(end);
  return date >= startDate && date <= endDate;
}

/**
 * 获取下一个指定时间
 */
export function getNextTime(hour: number, minute: number): string {
  const now = new Date();
  const next = new Date();
  next.setHours(hour, minute, 0, 0);

  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }

  return next.toISOString();
}

/**
 * 检查是否在安静时段
 */
export function isQuietHours(quietStart: string, quietEnd: string): boolean {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startHour, startMinute] = quietStart.split(':').map(Number);
  const [endHour, endMinute] = quietEnd.split(':').map(Number);

  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;

  // 处理跨午夜的情况
  if (startMinutes > endMinutes) {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

/**
 * 获取安静时段结束时间
 */
export function getQuietHoursEnd(quietEnd: string): string {
  const now = new Date();
  const [hour, minute] = quietEnd.split(':').map(Number);
  const end = new Date();
  end.setHours(hour, minute, 0, 0);

  if (end <= now) {
    end.setDate(end.getDate() + 1);
  }

  return end.toISOString();
}
