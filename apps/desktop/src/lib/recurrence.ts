/**
 * Recurrence rules engine
 * Handles recurring task generation and management
 */

import { getDatabase } from './database'
import { v4 as uuidv4 } from 'uuid'

export type RecurrenceFrequency = 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly' | 'custom'

export interface RecurrenceConfig {
  frequency: RecurrenceFrequency
  interval?: number        // 间隔（如每2天）
  daysOfWeek?: number[]    // 星期几 [0=周日, 1=周一, ..., 6=周六]
  dayOfMonth?: number      // 每月几号
  monthOfYear?: number     // 每年几月
  startDate: string        // 开始日期 YYYY-MM-DD
  endDate?: string         // 结束日期 YYYY-MM-DD
  maxOccurrences?: number  // 最大次数
}

export interface RecurrenceRule {
  id: string
  taskId: string
  config: RecurrenceConfig
  createdAt: string
  updatedAt: string
}

/**
 * 获取下一个重复日期
 */
export function getNextOccurrence(config: RecurrenceConfig, currentDate: string): string | null {
  const current = new Date(currentDate)

  // 检查是否已超过结束日期
  if (config.endDate) {
    const end = new Date(config.endDate)
    if (current >= end) {
      return null
    }
  }

  let next: Date

  switch (config.frequency) {
    case 'daily':
      next = new Date(current)
      next.setDate(next.getDate() + (config.interval || 1))
      break

    case 'weekdays':
      next = new Date(current)
      do {
        next.setDate(next.getDate() + 1)
      } while (next.getDay() === 0 || next.getDay() === 6)
      break

    case 'weekly':
      next = getNextWeeklyOccurrence(config, current)
      break

    case 'monthly':
      next = getNextMonthlyOccurrence(config, current)
      break

    case 'yearly':
      next = getNextYearlyOccurrence(config, current)
      break

    case 'custom':
      next = new Date(current)
      next.setDate(next.getDate() + (config.interval || 1))
      break

    default:
      return null
  }

  // 检查是否超过结束日期
  if (config.endDate) {
    const end = new Date(config.endDate)
    if (next > end) {
      return null
    }
  }

  return next.toISOString().split('T')[0]
}

/**
 * 获取下一个每周重复日期
 */
function getNextWeeklyOccurrence(config: RecurrenceConfig, current: Date): Date {
  const daysOfWeek = config.daysOfWeek || [current.getDay()]
  const next = new Date(current)

  // 查找下一个匹配的星期几
  do {
    next.setDate(next.getDate() + 1)
  } while (!daysOfWeek.includes(next.getDay()))

  return next
}

// Helper to avoid unused variable warning
void getNextWeeklyOccurrence

/**
 * 获取下一个每月重复日期
 */
function getNextMonthlyOccurrence(config: RecurrenceConfig, current: Date): Date {
  const dayOfMonth = config.dayOfMonth || current.getDate()
  const next = new Date(current)

  // 移动到下个月
  next.setMonth(next.getMonth() + 1)

  // 设置为指定日期，如果该月没有这一天，则使用最后一天
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
  next.setDate(Math.min(dayOfMonth, lastDay))

  return next
}

/**
 * 获取下一个每年重复日期
 */
function getNextYearlyOccurrence(config: RecurrenceConfig, current: Date): Date {
  const monthOfYear = config.monthOfYear || current.getMonth()
  const dayOfMonth = config.dayOfMonth || current.getDate()
  const next = new Date(current)

  // 移动到下一年
  next.setFullYear(next.getFullYear() + 1)
  next.setMonth(monthOfYear)

  // 处理闰年2月29日
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
  next.setDate(Math.min(dayOfMonth, lastDay))

  return next
}

/**
 * 生成多个重复日期
 */
export function generateOccurrences(config: RecurrenceConfig, count: number): string[] {
  const occurrences: string[] = []
  let currentDate = config.startDate

  for (let i = 0; i < count; i++) {
    occurrences.push(currentDate)

    const next = getNextOccurrence(config, currentDate)
    if (!next) {
      break
    }
    currentDate = next
  }

  return occurrences
}

/**
 * 检查日期是否是重复日期
 */
export function isRecurrenceDate(config: RecurrenceConfig, date: string): boolean {
  const target = new Date(date)
  const start = new Date(config.startDate)

  // 在开始日期之前
  if (target < start) {
    return false
  }

  // 检查结束日期
  if (config.endDate) {
    const end = new Date(config.endDate)
    if (target > end) {
      return false
    }
  }

  // 根据频率检查
  switch (config.frequency) {
    case 'daily':
      return isDailyRecurrence(config, target, start)

    case 'weekdays':
      return isWeekday(target)

    case 'weekly':
      return isWeeklyRecurrence(config, target, start)

    case 'monthly':
      return isMonthlyRecurrence(config, target, start)

    case 'yearly':
      return isYearlyRecurrence(config, target, start)

    case 'custom':
      return isCustomRecurrence(config, target, start)

    default:
      return false
  }
}

/**
 * 检查每日重复
 */
function isDailyRecurrence(config: RecurrenceConfig, target: Date, start: Date): boolean {
  const interval = config.interval || 1
  const diffDays = Math.floor((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  return diffDays % interval === 0
}

/**
 * 检查是否是工作日
 */
function isWeekday(date: Date): boolean {
  const day = date.getDay()
  return day >= 1 && day <= 5
}

/**
 * 检查每周重复
 */
function isWeeklyRecurrence(config: RecurrenceConfig, target: Date, start: Date): boolean {
  const daysOfWeek = config.daysOfWeek || [start.getDay()]
  if (!daysOfWeek.includes(target.getDay())) {
    return false
  }

  const diffWeeks = Math.floor((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7))
  const interval = config.interval || 1
  return diffWeeks % interval === 0
}

/**
 * 检查每月重复
 */
function isMonthlyRecurrence(config: RecurrenceConfig, target: Date, start: Date): boolean {
  const dayOfMonth = config.dayOfMonth || start.getDate()

  // 检查日期
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  const targetDay = Math.min(dayOfMonth, lastDay)

  if (target.getDate() !== targetDay) {
    return false
  }

  // 检查月份间隔
  const diffMonths = (target.getFullYear() - start.getFullYear()) * 12 + target.getMonth() - start.getMonth()
  const interval = config.interval || 1
  return diffMonths % interval === 0
}

/**
 * 检查每年重复
 */
function isYearlyRecurrence(config: RecurrenceConfig, target: Date, start: Date): boolean {
  const monthOfYear = config.monthOfYear ?? start.getMonth()
  const dayOfMonth = config.dayOfMonth || start.getDate()

  // 检查月份和日期
  if (target.getMonth() !== monthOfYear) {
    return false
  }

  // 处理闰年2月29日
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  const targetDay = Math.min(dayOfMonth, lastDay)

  if (target.getDate() !== targetDay) {
    return false
  }

  // 检查年份间隔
  const diffYears = target.getFullYear() - start.getFullYear()
  const interval = config.interval || 1
  return diffYears % interval === 0
}

/**
 * 检查自定义重复
 */
function isCustomRecurrence(config: RecurrenceConfig, target: Date, start: Date): boolean {
  const interval = config.interval || 1
  const diffDays = Math.floor((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  return diffDays % interval === 0
}

/**
 * 创建重复规则
 */
export async function createRecurrenceRule(
  taskId: string,
  config: RecurrenceConfig
): Promise<RecurrenceRule> {
  const db = await getDatabase()
  const now = new Date().toISOString()
  const id = uuidv4()

  await db.execute(
    `INSERT INTO recurrence_rules (
      id, task_id, frequency, interval, days_of_week, day_of_month,
      month_of_year, start_date, end_date, max_occurrences, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      id, taskId, config.frequency, config.interval || 1,
      config.daysOfWeek ? JSON.stringify(config.daysOfWeek) : null,
      config.dayOfMonth || null, config.monthOfYear || null,
      config.startDate, config.endDate || null, config.maxOccurrences || null,
      now, now,
    ]
  )

  return {
    id,
    taskId,
    config,
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * 获取任务的重复规则
 */
export async function getRecurrenceRule(taskId: string): Promise<RecurrenceRule | null> {
  const db = await getDatabase()

  const result = await db.select<any[]>(
    `SELECT * FROM recurrence_rules WHERE task_id = $1`,
    [taskId]
  )

  if (result.length === 0) {
    return null
  }

  const row = result[0]
  return {
    id: row.id,
    taskId: row.task_id,
    config: {
      frequency: row.frequency,
      interval: row.interval,
      daysOfWeek: row.days_of_week ? JSON.parse(row.days_of_week) : undefined,
      dayOfMonth: row.day_of_month,
      monthOfYear: row.month_of_year,
      startDate: row.start_date,
      endDate: row.end_date,
      maxOccurrences: row.max_occurrences,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * 更新重复规则
 */
export async function updateRecurrenceRule(
  ruleId: string,
  config: Partial<RecurrenceConfig>
): Promise<void> {
  const db = await getDatabase()
  const now = new Date().toISOString()

  const fields: string[] = []
  const values: unknown[] = []
  let paramIndex = 1

  if (config.frequency !== undefined) {
    fields.push(`frequency = $${paramIndex++}`)
    values.push(config.frequency)
  }
  if (config.interval !== undefined) {
    fields.push(`interval = $${paramIndex++}`)
    values.push(config.interval)
  }
  if (config.daysOfWeek !== undefined) {
    fields.push(`days_of_week = $${paramIndex++}`)
    values.push(JSON.stringify(config.daysOfWeek))
  }
  if (config.dayOfMonth !== undefined) {
    fields.push(`day_of_month = $${paramIndex++}`)
    values.push(config.dayOfMonth)
  }
  if (config.monthOfYear !== undefined) {
    fields.push(`month_of_year = $${paramIndex++}`)
    values.push(config.monthOfYear)
  }
  if (config.startDate !== undefined) {
    fields.push(`start_date = $${paramIndex++}`)
    values.push(config.startDate)
  }
  if (config.endDate !== undefined) {
    fields.push(`end_date = $${paramIndex++}`)
    values.push(config.endDate)
  }
  if (config.maxOccurrences !== undefined) {
    fields.push(`max_occurrences = $${paramIndex++}`)
    values.push(config.maxOccurrences)
  }

  fields.push(`updated_at = $${paramIndex++}`)
  values.push(now)

  values.push(ruleId)
  await db.execute(
    `UPDATE recurrence_rules SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
    values
  )
}

/**
 * 删除重复规则
 */
export async function deleteRecurrenceRule(ruleId: string): Promise<void> {
  const db = await getDatabase()
  await db.execute('DELETE FROM recurrence_rules WHERE id = $1', [ruleId])
}

/**
 * 生成下一个重复任务实例
 */
export async function generateNextInstance(taskId: string): Promise<string | null> {
  const db = await getDatabase()

  // 获取当前任务
  const taskResult = await db.select<any[]>(
    `SELECT * FROM tasks WHERE id = $1`,
    [taskId]
  )

  if (taskResult.length === 0) {
    return null
  }

  const task = taskResult[0]

  // 获取重复规则
  const rule = await getRecurrenceRule(taskId)
  if (!rule) {
    return null
  }

  // 计算下一个日期
  const currentDate = task.scheduled_date || new Date().toISOString().split('T')[0]
  const nextDate = getNextOccurrence(rule.config, currentDate)

  if (!nextDate) {
    return null
  }

  // 创建新任务
  const newTaskId = uuidv4()
  const now = new Date().toISOString()

  await db.execute(
    `INSERT INTO tasks (
      id, parent_id, project_id, title, note, status, priority, sort_order,
      scheduled_date, scheduled_at, due_at, is_all_day, timezone, estimated_minutes,
      created_at, updated_at, completed_at, deleted_at, revision, source, source_capture_id
    ) VALUES ($1, $2, $3, $4, $5, 'todo', $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NULL, NULL, 1, 'recurrence', $16)`,
    [
      newTaskId, task.parent_id, task.project_id, task.title, task.note,
      task.priority, task.sort_order,
      nextDate, task.scheduled_at, task.due_at, task.is_all_day,
      task.timezone, task.estimated_minutes,
      now, now, taskId,
    ]
  )

  // 复制标签
  const tags = await db.select<any[]>(
    `SELECT tag_id FROM task_tags WHERE task_id = $1`,
    [taskId]
  )

  for (const tag of tags) {
    await db.execute(
      `INSERT INTO task_tags (task_id, tag_id) VALUES ($1, $2)`,
      [newTaskId, tag.tag_id]
    )
  }

  // 复制重复规则到新任务
  await createRecurrenceRule(newTaskId, rule.config)

  return newTaskId
}

/**
 * 重置重复父任务的子任务
 */
export async function resetSubtasksForRecurrence(parentId: string): Promise<void> {
  const db = await getDatabase()
  const now = new Date().toISOString()

  // 获取需要重置的子任务（标记为可重置的）
  const subtasks = await db.select<any[]>(
    `SELECT id FROM tasks WHERE parent_id = $1 AND status = 'done'`,
    [parentId]
  )

  // 重置子任务状态
  for (const subtask of subtasks) {
    await db.execute(
      `UPDATE tasks SET status = 'todo', completed_at = NULL, updated_at = $1, revision = revision + 1 WHERE id = $2`,
      [now, subtask.id]
    )
  }
}

/**
 * 跳过本次重复
 */
export async function skipRecurrence(taskId: string): Promise<void> {
  const db = await getDatabase()

  // 标记当前任务为已跳过（使用 cancelled 状态）
  await db.execute(
    `UPDATE tasks SET status = 'cancelled', updated_at = $1, revision = revision + 1 WHERE id = $2`,
    [new Date().toISOString(), taskId]
  )
}

/**
 * 检查是否应该重置子任务
 */
export function shouldResetForRecurrence(_taskId: string): boolean {
  // 这个函数需要根据配置来判断
  // 暂时返回 false，后续可以通过配置来控制
  return false
}
