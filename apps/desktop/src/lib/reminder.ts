/**
 * Reminder scheduler module
 * Manages task reminders and notifications
 * Uses Repository pattern for data access
 */

import { getRepositories } from './repositories'
import type { Task } from './repositories'
import { getSqlRepository } from './repositories/sql-repository'
import { addMinutes, addHours, addDays, isQuietHours, getQuietHoursEnd } from './time'

export type ReminderStatus = 'pending' | 'triggered' | 'confirmed' | 'snoozed' | 'cancelled'
export type SnoozeDuration = '10m' | '1h' | 'tomorrow'

export interface ReminderInfo {
  id: string
  taskId: string
  taskTitle: string
  remindAt: string
  status: ReminderStatus
  snoozedUntil?: string
}

export interface ReminderConfig {
  quietHoursStart: string
  quietHoursEnd: string
  enableQuietHours: boolean
}

type TriggerCallback = (reminder: ReminderInfo) => void

export class ReminderScheduler {
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map()
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

    // Load and schedule reminders
    await this.loadAndScheduleReminders()

    // Periodic check every 30 seconds to handle system sleep recovery
    // After sleep, setTimeout may have fired late or not at all
    this.checkInterval = setInterval(async () => {
      if (!this.isRunning) return
      await this.checkDueReminders()
    }, 30_000)

    // Check for missed reminders on resume
    this.setupSystemListeners()

    console.log('Reminder scheduler started')
  }

  /**
   * Check for reminders that are due now but haven't been triggered.
   * Handles system sleep recovery where setTimeout may have been delayed.
   */
  private async checkDueReminders(): Promise<void> {
    try {
      const repos = await getRepositories()
      const tasks = await repos.tasks.findByView('today')
      const now = new Date()

      for (const task of tasks) {
        if (!task.dueAt || task.status !== 'todo' || task.deletedAt) continue

        const dueAt = new Date(task.dueAt)
        const remindAt = new Date(dueAt.getTime() - 30 * 60 * 1000)

        // If reminder time has passed and we don't have a timer for it
        if (remindAt <= now && !this.timers.has(task.id)) {
          this.triggerReminder({
            id: `reminder-${task.id}`,
            taskId: task.id,
            taskTitle: task.title,
            remindAt: remindAt.toISOString(),
            status: 'pending',
          })
        }
      }
    } catch {
      // Non-fatal: will retry on next interval
    }
  }

  stop(): void {
    this.isRunning = false
    for (const timer of this.timers.values()) {
      clearTimeout(timer)
    }
    this.timers.clear()
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
    }
    console.log('Reminder scheduler stopped')
  }

  onTrigger(callback: TriggerCallback): void {
    this.onTriggerCallback = callback
  }

  private async loadAndScheduleReminders(): Promise<void> {
    try {
      const repos = await getRepositories()
      const tasks = await repos.tasks.findByView('today')

      // Schedule reminders for tasks with due dates
      for (const task of tasks) {
        if (task.dueAt && task.status === 'todo') {
          this.syncTask(task)
        }
      }
    } catch (error) {
      console.error('Failed to load reminders:', error)
    }
  }

  /**
   * Keep the in-memory timer for a task aligned with its current persisted
   * state. Calling this repeatedly is safe: an existing timer is replaced.
   */
  syncTask(task: Task): void {
    this.cancelTask(task.id)
    if (!task.dueAt || task.status !== 'todo' || task.deletedAt) return

    const now = new Date()
    const dueAt = new Date(task.dueAt)
    const remindAt = new Date(dueAt.getTime() - 30 * 60 * 1000) // 30 minutes before

    if (remindAt > now) {
      const delay = remindAt.getTime() - now.getTime()
      const timer = setTimeout(() => {
        this.triggerReminder({
          id: `reminder-${task.id}`,
          taskId: task.id,
          taskTitle: task.title,
          remindAt: remindAt.toISOString(),
          status: 'pending',
        })
      }, delay)

      this.timers.set(task.id, timer)
    }
  }


  /**
   * Cancel every scheduled timer owned by a task, including snoozed timers.
   */
  cancelTask(taskId: string): void {
    for (const key of [taskId, `snoozed-${taskId}`]) {
      const timer = this.timers.get(key)
      if (timer) clearTimeout(timer)
      this.timers.delete(key)
    }
  }
  private triggerReminder(reminder: ReminderInfo): void {
    // Check quiet hours
    if (this.config.enableQuietHours && isQuietHours(this.config.quietHoursStart, this.config.quietHoursEnd)) {
      const quietEnd = getQuietHoursEnd(this.config.quietHoursEnd)
      const delay = new Date(quietEnd).getTime() - Date.now()
      setTimeout(() => this.triggerReminder(reminder), delay)
      return
    }

    // Notification is handled by the onTriggerCallback (registered in main.tsx)
    // to avoid double-firing. Do NOT create a browser Notification here.

    // Persist triggered status to reminders table
    this.persistReminderStatus(reminder.taskId, 'triggered')

    // Call callback (main.tsx handles the actual notification display)
    if (this.onTriggerCallback) {
      this.onTriggerCallback(reminder)
    }
  }

  private async persistReminderStatus(taskId: string, status: ReminderStatus): Promise<void> {
    try {
      const db = await getSqlRepository()
      const now = new Date().toISOString()
      // Update existing reminder or insert new one
      await db.execute(
        `INSERT INTO reminders (id, task_id, remind_at, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $5)
         ON CONFLICT(task_id) DO UPDATE SET status = $4, updated_at = $5`,
        [`reminder-${taskId}`, taskId, now, status, now]
      )
    } catch {
      // Non-fatal: reminder still works in-memory
    }
  }

  private setupSystemListeners(): void {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.loadAndScheduleReminders()
        }
      })
    }
  }

  async snoozeReminder(taskId: string, duration: SnoozeDuration): Promise<void> {
    let snoozedUntil: string
    const now = new Date()

    switch (duration) {
      case '10m':
        snoozedUntil = addMinutes(now.toISOString(), 10)
        break
      case '1h':
        snoozedUntil = addHours(now.toISOString(), 1)
        break
      case 'tomorrow':
        snoozedUntil = addDays(now.toISOString(), 1)
        break
    }

    const snoozedDate = new Date(snoozedUntil)

    // Persist snooze state
    await this.persistReminderStatus(taskId, 'snoozed')

    // Reschedule
    const delay = snoozedDate.getTime() - Date.now()
    const timer = setTimeout(() => {
      this.triggerReminder({
        id: `snoozed-${taskId}`,
        taskId,
        taskTitle: 'Snoozed reminder',
        remindAt: snoozedUntil,
        status: 'snoozed',
      })
    }, delay)

    this.timers.set(`snoozed-${taskId}`, timer)
  }

  async getTaskReminders(taskId: string): Promise<ReminderInfo[]> {
    try {
      const db = await getSqlRepository()
      const rows = await db.select(
        `SELECT id, task_id, remind_at, status, snoozed_until FROM reminders WHERE task_id = $1`,
        [taskId]
      )
      return rows.map((r: any) => ({
        id: r.id,
        taskId: r.task_id,
        taskTitle: '',
        remindAt: r.remind_at,
        status: r.status,
        snoozedUntil: r.snoozed_until,
      }))
    } catch {
      return []
    }
  }

  async addReminder(taskId: string, remindAt: string): Promise<ReminderInfo> {
    const id = `reminder-${taskId}-${Date.now()}`
    const now = new Date().toISOString()
    try {
      const db = await getSqlRepository()
      await db.execute(
        `INSERT INTO reminders (id, task_id, remind_at, status, created_at, updated_at)
         VALUES ($1, $2, $3, 'pending', $4, $4)`,
        [id, taskId, remindAt, now]
      )
    } catch {
      // Non-fatal
    }
    return { id, taskId, taskTitle: '', remindAt, status: 'pending' }
  }

  async removeReminder(reminderId: string): Promise<void> {
    try {
      const db = await getSqlRepository()
      await db.execute('DELETE FROM reminders WHERE id = $1', [reminderId])
    } catch {
      // Non-fatal
    }
  }

  async confirmReminder(taskId: string): Promise<void> {
    this.cancelTask(taskId)
    await this.persistReminderStatus(taskId, 'confirmed')
  }
}

export const reminderScheduler = new ReminderScheduler()
