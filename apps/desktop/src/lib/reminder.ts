/**
 * Reminder scheduler module.
 * Persists independent start/deadline reminders and keeps their timers aligned.
 */

import type { Task } from './repositories'
import { getSqlRepository } from './repositories/sql-repository'
import { addMinutes, addHours, addDays, isQuietHours, getQuietHoursEnd } from './time'

export type ReminderStatus = 'pending' | 'triggered' | 'confirmed' | 'snoozed' | 'cancelled'
export type SnoozeDuration = '10m' | '1h' | 'tomorrow'
export type ReminderKind = 'start' | 'due'

export interface ReminderInfo {
  id: string
  taskId: string
  taskTitle: string
  remindAt: string
  status: ReminderStatus
  kind?: ReminderKind
  snoozedUntil?: string
}

export interface PlannedReminderInput {
  kind: ReminderKind
  remindAt: string
}

export interface TaskReminderPlans {
  start: string | null
  due: string | null
}

export interface ReminderConfig {
  quietHoursStart: string
  quietHoursEnd: string
  enableQuietHours: boolean
}

export const REMINDER_PRESETS = [
  { label: '前一天', minutes: 24 * 60 },
  { label: '前8小时', minutes: 8 * 60 },
  { label: '前2小时', minutes: 2 * 60 },
  { label: '前一小时', minutes: 60 },
  { label: '前半小时', minutes: 30 },
] as const

export function calculateReminderTime(baseAt: string, offsetMinutes: number): string {
  return new Date(new Date(baseAt).getTime() - offsetMinutes * 60_000).toISOString()
}

type TriggerCallback = (reminder: ReminderInfo) => void

type ReminderRow = {
  id: string
  task_id: string
  task_title?: string
  remind_at: string
  status: ReminderStatus
  snoozed_until?: string | null
}

export class ReminderScheduler {
  private timers = new Map<string, ReturnType<typeof setTimeout>>()
  private timerOwners = new Map<string, string>()
  private config: ReminderConfig
  private onTriggerCallback: TriggerCallback | null = null
  private isRunning = false
  private checkInterval: ReturnType<typeof setInterval> | null = null

  constructor(config?: Partial<ReminderConfig>) {
    this.config = {
      enableQuietHours: false,
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
      ...config,
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) return
    this.isRunning = true
    await this.loadAndScheduleReminders()
    this.checkInterval = setInterval(() => {
      if (this.isRunning) void this.checkDueReminders()
    }, 30_000)
    this.setupSystemListeners()
    console.log('Reminder scheduler started')
  }

  stop(): void {
    this.isRunning = false
    for (const timer of this.timers.values()) clearTimeout(timer)
    this.timers.clear()
    this.timerOwners.clear()
    if (this.checkInterval) clearInterval(this.checkInterval)
    this.checkInterval = null
    console.log('Reminder scheduler stopped')
  }

  onTrigger(callback: TriggerCallback): void {
    this.onTriggerCallback = callback
  }

  private getKind(id: string): ReminderKind | undefined {
    if (id.endsWith('-start')) return 'start'
    if (id.endsWith('-due') || id.startsWith('reminder-')) return 'due'
    return undefined
  }

  private rowToReminder(row: ReminderRow): ReminderInfo {
    return {
      id: row.id,
      taskId: row.task_id,
      taskTitle: row.task_title ?? '',
      remindAt: row.snoozed_until ?? row.remind_at,
      status: row.status,
      kind: this.getKind(row.id),
      snoozedUntil: row.snoozed_until ?? undefined,
    }
  }

  private cancelTimer(reminderId: string): void {
    const timer = this.timers.get(reminderId)
    if (timer) clearTimeout(timer)
    this.timers.delete(reminderId)
    this.timerOwners.delete(reminderId)
  }

  private scheduleReminder(reminder: ReminderInfo): void {
    this.cancelTimer(reminder.id)
    const delay = new Date(reminder.remindAt).getTime() - Date.now()
    if (delay <= 0) {
      this.triggerReminder(reminder)
      return
    }
    const timer = setTimeout(() => {
      this.timers.delete(reminder.id)
      this.timerOwners.delete(reminder.id)
      this.triggerReminder(reminder)
    }, delay)
    this.timers.set(reminder.id, timer)
    this.timerOwners.set(reminder.id, reminder.taskId)
  }

  private async loadAndScheduleReminders(): Promise<void> {
    try {
      const db = await getSqlRepository()
      const rows = await db.select(
        `SELECT r.id, r.task_id, r.remind_at, r.status, r.snoozed_until, t.title AS task_title
         FROM reminders r JOIN tasks t ON t.id = r.task_id
         WHERE r.status IN ('pending', 'snoozed') AND t.status = 'todo' AND t.deleted_at IS NULL`
      ) as ReminderRow[]
      for (const row of rows) this.scheduleReminder(this.rowToReminder(row))
    } catch (error) {
      console.error('Failed to load reminders:', error)
    }
  }

  private async checkDueReminders(): Promise<void> {
    try {
      const db = await getSqlRepository()
      const rows = await db.select(
        `SELECT r.id, r.task_id, r.remind_at, r.status, r.snoozed_until, t.title AS task_title
         FROM reminders r JOIN tasks t ON t.id = r.task_id
         WHERE r.status IN ('pending', 'snoozed') AND t.status = 'todo' AND t.deleted_at IS NULL
           AND COALESCE(r.snoozed_until, r.remind_at) <= $1`,
        [new Date().toISOString()]
      ) as ReminderRow[]
      for (const row of rows) {
        if (!this.timers.has(row.id)) this.triggerReminder(this.rowToReminder(row))
      }
    } catch {
      // Non-fatal: retry on the next interval.
    }
  }

  async syncTask(task: Task): Promise<void> {
    this.cancelTask(task.id)
    if (task.status !== 'todo' || task.deletedAt) return
    try {
      const db = await getSqlRepository()
      const rows = await db.select(
        `SELECT id, task_id, remind_at, status, snoozed_until FROM reminders
         WHERE task_id = $1 AND status IN ('pending', 'snoozed') ORDER BY updated_at`,
        [task.id]
      ) as ReminderRow[]
      for (const row of rows) this.scheduleReminder({ ...this.rowToReminder(row), taskTitle: task.title })
    } catch {
      // Persisted reminders remain available for the next scheduler reload.
    }
  }

  async setTaskReminders(task: Task, reminders: PlannedReminderInput[]): Promise<void> {
    this.cancelTask(task.id)
    const db = await getSqlRepository()
    await db.execute('DELETE FROM reminders WHERE task_id = $1', [task.id])
    if (task.status !== 'todo' || task.deletedAt) return

    const now = new Date().toISOString()
    for (const input of reminders) {
      const reminder: ReminderInfo = {
        id: `reminder-${task.id}-${input.kind}`,
        taskId: task.id,
        taskTitle: task.title,
        remindAt: input.remindAt,
        status: 'pending',
        kind: input.kind,
      }
      await db.execute(
        `INSERT INTO reminders (id, task_id, remind_at, status, created_at, updated_at)
         VALUES ($1, $2, $3, 'pending', $4, $4)`,
        [reminder.id, task.id, reminder.remindAt, now]
      )
      this.scheduleReminder(reminder)
    }
  }

  /** Compatibility wrapper for the previous single deadline-reminder API. */
  async setTaskReminder(task: Task, offsetMinutes: number | null): Promise<void> {
    const reminders = offsetMinutes !== null && task.dueAt
      ? [{ kind: 'due' as const, remindAt: calculateReminderTime(task.dueAt, offsetMinutes) }]
      : []
    await this.setTaskReminders(task, reminders)
  }

  async getTaskReminderPlans(taskId: string): Promise<TaskReminderPlans> {
    try {
      const db = await getSqlRepository()
      const rows = await db.select(
        `SELECT id, remind_at FROM reminders WHERE task_id = $1 AND status IN ('pending', 'snoozed')
         ORDER BY updated_at`,
        [taskId]
      ) as Array<{ id: string; remind_at: string }>
      const plans: TaskReminderPlans = { start: null, due: null }
      for (const row of rows) {
        if (row.id.endsWith('-start')) plans.start = row.remind_at
        else plans.due = row.remind_at
      }
      return plans
    } catch {
      return { start: null, due: null }
    }
  }

  async getTaskReminderOffset(task: Task): Promise<number | null> {
    if (!task.dueAt) return null
    const plans = await this.getTaskReminderPlans(task.id)
    if (!plans.due) return null
    return Math.round((new Date(task.dueAt).getTime() - new Date(plans.due).getTime()) / 60_000)
  }

  cancelTask(taskId: string): void {
    for (const [reminderId, ownerId] of this.timerOwners) {
      if (ownerId === taskId) this.cancelTimer(reminderId)
    }
  }

  private triggerReminder(reminder: ReminderInfo): void {
    if (this.config.enableQuietHours && isQuietHours(this.config.quietHoursStart, this.config.quietHoursEnd)) {
      const delay = new Date(getQuietHoursEnd(this.config.quietHoursEnd)).getTime() - Date.now()
      const timer = setTimeout(() => this.triggerReminder(reminder), delay)
      this.timers.set(reminder.id, timer)
      this.timerOwners.set(reminder.id, reminder.taskId)
      return
    }
    void this.persistReminderStatus(reminder.id, 'triggered')
    this.onTriggerCallback?.(reminder)
  }

  private async persistReminderStatus(reminderId: string, status: ReminderStatus): Promise<void> {
    try {
      const db = await getSqlRepository()
      await db.execute(
        'UPDATE reminders SET status = $1, updated_at = $2 WHERE id = $3',
        [status, new Date().toISOString(), reminderId]
      )
    } catch {
      // Non-fatal: reminder has already reached the user.
    }
  }

  private setupSystemListeners(): void {
    if (typeof document === 'undefined') return
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void this.loadAndScheduleReminders()
    })
  }

  async snoozeReminder(taskId: string, duration: SnoozeDuration): Promise<void> {
    const now = new Date().toISOString()
    const snoozedUntil = duration === '10m'
      ? addMinutes(now, 10)
      : duration === '1h' ? addHours(now, 1) : addDays(now, 1)
    const db = await getSqlRepository()
    const rows = await db.select(
      `SELECT id FROM reminders WHERE task_id = $1 ORDER BY updated_at DESC LIMIT 1`,
      [taskId]
    ) as Array<{ id: string }>
    const reminderId = rows[0]?.id ?? `reminder-${taskId}-due`
    await db.execute(
      `UPDATE reminders SET status = 'snoozed', snoozed_until = $1, updated_at = $2 WHERE id = $3`,
      [snoozedUntil, now, reminderId]
    )
    this.scheduleReminder({ id: reminderId, taskId, taskTitle: '稍后提醒的任务', remindAt: snoozedUntil, status: 'snoozed', snoozedUntil })
  }

  async getTaskReminders(taskId: string): Promise<ReminderInfo[]> {
    try {
      const db = await getSqlRepository()
      const rows = await db.select(
        'SELECT id, task_id, remind_at, status, snoozed_until FROM reminders WHERE task_id = $1',
        [taskId]
      ) as ReminderRow[]
      return rows.map(row => this.rowToReminder(row))
    } catch {
      return []
    }
  }

  async addReminder(taskId: string, remindAt: string): Promise<ReminderInfo> {
    const id = `reminder-${taskId}-custom-${Date.now()}`
    const now = new Date().toISOString()
    const db = await getSqlRepository()
    await db.execute(
      `INSERT INTO reminders (id, task_id, remind_at, status, created_at, updated_at)
       VALUES ($1, $2, $3, 'pending', $4, $4)`,
      [id, taskId, remindAt, now]
    )
    return { id, taskId, taskTitle: '', remindAt, status: 'pending' }
  }

  async removeReminder(reminderId: string): Promise<void> {
    this.cancelTimer(reminderId)
    const db = await getSqlRepository()
    await db.execute('DELETE FROM reminders WHERE id = $1', [reminderId])
  }

  async confirmReminder(reminderId: string): Promise<void> {
    this.cancelTimer(reminderId)
    await this.persistReminderStatus(reminderId, 'confirmed')
  }
}

export const reminderScheduler = new ReminderScheduler()
