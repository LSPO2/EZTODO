/**
 * Reminder scheduler module
 * Manages task reminders and notifications
 */

import { getDatabase } from './database'
import { v4 as uuidv4 } from 'uuid'
import { addMinutes, addHours, addDays, isQuietHours, getQuietHoursEnd } from './time'

export type ReminderStatus = 'pending' | 'triggered' | 'confirmed' | 'snoozed' | 'cancelled'
export type SnoozeDuration = '10m' | '1h' | 'tomorrow'

export interface ReminderInfo {
  id: string
  taskId: string
  taskTitle: string
  remindAt: string       // ISO 8601 UTC
  status: ReminderStatus
  snoozedUntil?: string
  createdAt: string
  updatedAt: string
}

export interface ReminderConfig {
  quietHoursStart?: string  // HH:mm
  quietHoursEnd?: string    // HH:mm
  enableQuietHours: boolean
}

type TriggerCallback = (reminder: ReminderInfo) => void

export class ReminderScheduler {
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map()
  private config: ReminderConfig
  private onTriggerCallback: TriggerCallback | null = null
  private isRunning = false

  constructor(config?: Partial<ReminderConfig>) {
    this.config = {
      enableQuietHours: false,
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
      ...config,
    }
  }

  /**
   * 启动提醒调度器
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return
    }

    this.isRunning = true
    console.log('Reminder scheduler started')

    // 加载所有待触发的提醒
    await this.loadPendingReminders()

    // 监听系统事件
    this.setupSystemListeners()
  }

  /**
   * 停止提醒调度器
   */
  stop(): void {
    this.isRunning = false

    // 清除所有定时器
    for (const timer of this.timers.values()) {
      clearTimeout(timer)
    }
    this.timers.clear()

    console.log('Reminder scheduler stopped')
  }

  /**
   * 设置触发回调
   */
  onTrigger(callback: TriggerCallback): void {
    this.onTriggerCallback = callback
  }

  /**
   * 加载待触发的提醒
   */
  private async loadPendingReminders(): Promise<void> {
    const db = await getDatabase()
    const now = new Date().toISOString()

    const reminders = await db.select(
      `SELECT r.*, t.title as task_title
       FROM reminders r
       JOIN tasks t ON r.task_id = t.id
       WHERE r.status = 'pending' AND r.remind_at > $1
       ORDER BY r.remind_at ASC`,
      [now]
    )

    for (const reminder of reminders) {
      this.scheduleReminder({
        id: reminder.id,
        taskId: reminder.task_id,
        taskTitle: reminder.task_title,
        remindAt: reminder.remind_at,
        status: reminder.status,
        snoozedUntil: reminder.snoozed_until,
        createdAt: reminder.created_at,
        updatedAt: reminder.updated_at,
      })
    }

    console.log(`Loaded ${reminders.length} pending reminders`)
  }

  /**
   * 调度单个提醒
   */
  private scheduleReminder(reminder: ReminderInfo): void {
    const now = new Date()
    const remindAt = new Date(reminder.remindAt)
    const delayMs = remindAt.getTime() - now.getTime()

    if (delayMs <= 0) {
      // 已经过期，立即触发
      this.triggerReminder(reminder)
      return
    }

    // 设置定时器
    const timer = setTimeout(() => {
      this.triggerReminder(reminder)
    }, delayMs)

    this.timers.set(reminder.id, timer)
  }

  /**
   * 触发提醒
   */
  private async triggerReminder(reminder: ReminderInfo): Promise<void> {
    // 检查是否在安静时段
    if (this.config.enableQuietHours && this.config.quietHoursStart && this.config.quietHoursEnd) {
      if (isQuietHours(this.config.quietHoursStart, this.config.quietHoursEnd)) {
        // 延后到安静时段结束
        const quietEnd = getQuietHoursEnd(this.config.quietHoursEnd)
        await this.snoozeReminder(reminder.id, quietEnd)
        return
      }
    }

    // 更新状态为已触发
    await this.updateReminderStatus(reminder.id, 'triggered')

    // 调用回调
    if (this.onTriggerCallback) {
      this.onTriggerCallback(reminder)
    }

    // 从定时器中移除
    this.timers.delete(reminder.id)

    console.log(`Reminder triggered: ${reminder.taskTitle}`)
  }

  /**
   * 添加提醒
   */
  async addReminder(taskId: string, remindAt: string): Promise<ReminderInfo> {
    const db = await getDatabase()
    const now = new Date().toISOString()
    const id = uuidv4()

    // 获取任务标题
    const task = await db.select(
      `SELECT title FROM tasks WHERE id = $1`,
      [taskId]
    )

    if (task.length === 0) {
      throw new Error(`Task not found: ${taskId}`)
    }

    await db.execute(
      `INSERT INTO reminders (id, task_id, remind_at, status, created_at, updated_at)
       VALUES ($1, $2, $3, 'pending', $4, $4)`,
      [id, taskId, remindAt, now]
    )

    const reminder: ReminderInfo = {
      id,
      taskId,
      taskTitle: task[0].title,
      remindAt,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    }

    // 调度提醒
    this.scheduleReminder(reminder)

    return reminder
  }

  /**
   * 移除提醒
   */
  async removeReminder(reminderId: string): Promise<void> {
    const db = await getDatabase()

    // 清除定时器
    const timer = this.timers.get(reminderId)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(reminderId)
    }

    // 从数据库删除
    await db.execute('DELETE FROM reminders WHERE id = $1', [reminderId])
  }

  /**
   * 更新提醒
   */
  async updateReminder(reminderId: string, updates: Partial<ReminderInfo>): Promise<void> {
    const db = await getDatabase()
    const now = new Date().toISOString()

    const fields: string[] = []
    const values: unknown[] = []
    let paramIndex = 1

    if (updates.remindAt !== undefined) {
      fields.push(`remind_at = $${paramIndex++}`)
      values.push(updates.remindAt)
    }
    if (updates.status !== undefined) {
      fields.push(`status = $${paramIndex++}`)
      values.push(updates.status)
    }
    if (updates.snoozedUntil !== undefined) {
      fields.push(`snoozed_until = $${paramIndex++}`)
      values.push(updates.snoozedUntil)
    }

    fields.push(`updated_at = $${paramIndex++}`)
    values.push(now)

    values.push(reminderId)
    await db.execute(
      `UPDATE reminders SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
      values
    )

    // 如果时间改变，重新调度
    if (updates.remindAt) {
      const timer = this.timers.get(reminderId)
      if (timer) {
        clearTimeout(timer)
        this.timers.delete(reminderId)
      }

      const reminder = await this.getReminderById(reminderId)
      if (reminder && reminder.status === 'pending') {
        this.scheduleReminder(reminder)
      }
    }
  }

  /**
   * 确认提醒
   */
  async confirmReminder(reminderId: string): Promise<void> {
    await this.updateReminderStatus(reminderId, 'confirmed')

    // 从定时器中移除
    const timer = this.timers.get(reminderId)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(reminderId)
    }
  }

  /**
   * 稍后提醒
   */
  async snoozeReminder(reminderId: string, durationOrTime: SnoozeDuration | string): Promise<void> {
    let snoozedUntil: string

    if (typeof durationOrTime === 'string' && durationOrTime.includes(':')) {
      // 指定时间
      snoozedUntil = durationOrTime
    } else {
      // 持续时间
      const now = new Date()
      switch (durationOrTime as SnoozeDuration) {
        case '10m':
          snoozedUntil = addMinutes(now.toISOString(), 10)
          break
        case '1h':
          snoozedUntil = addHours(now.toISOString(), 1)
          break
        case 'tomorrow':
          snoozedUntil = addDays(now.toISOString(), 1)
          break
        default:
          snoozedUntil = addMinutes(now.toISOString(), 10)
      }
    }

    await this.updateReminder(reminderId, {
      status: 'snoozed',
      snoozedUntil,
    })

    // 调度稍后的提醒
    const reminder = await this.getReminderById(reminderId)
    if (reminder) {
      const timer = setTimeout(() => {
        this.triggerReminder(reminder)
      }, new Date(snoozedUntil).getTime() - Date.now())

      this.timers.set(reminderId, timer)
    }
  }

  /**
   * 取消提醒
   */
  async cancelReminder(reminderId: string): Promise<void> {
    await this.updateReminderStatus(reminderId, 'cancelled')

    // 从定时器中移除
    const timer = this.timers.get(reminderId)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(reminderId)
    }
  }

  /**
   * 更新提醒状态
   */
  private async updateReminderStatus(reminderId: string, status: ReminderStatus): Promise<void> {
    const db = await getDatabase()
    const now = new Date().toISOString()

    await db.execute(
      `UPDATE reminders SET status = $1, updated_at = $2 WHERE id = $3`,
      [status, now, reminderId]
    )
  }

  /**
   * 获取提醒详情
   */
  private async getReminderById(reminderId: string): Promise<ReminderInfo | null> {
    const db = await getDatabase()

    const result = await db.select(
      `SELECT r.*, t.title as task_title
       FROM reminders r
       JOIN tasks t ON r.task_id = t.id
       WHERE r.id = $1`,
      [reminderId]
    )

    if (result.length === 0) {
      return null
    }

    const row = result[0]
    return {
      id: row.id,
      taskId: row.task_id,
      taskTitle: row.task_title,
      remindAt: row.remind_at,
      status: row.status,
      snoozedUntil: row.snoozed_until,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  /**
   * 获取任务的所有提醒
   */
  async getTaskReminders(taskId: string): Promise<ReminderInfo[]> {
    const db = await getDatabase()

    const result = await db.select(
      `SELECT r.*, t.title as task_title
       FROM reminders r
       JOIN tasks t ON r.task_id = t.id
       WHERE r.task_id = $1
       ORDER BY r.remind_at ASC`,
      [taskId]
    )

    return result.map((row: any) => ({
      id: row.id,
      taskId: row.task_id,
      taskTitle: row.task_title,
      remindAt: row.remind_at,
      status: row.status,
      snoozedUntil: row.snoozed_until,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
  }

  /**
   * 系统恢复时扫描错过的提醒
   */
  async onSystemResume(): Promise<void> {
    console.log('System resumed, scanning for missed reminders...')

    const db = await getDatabase()
    const now = new Date().toISOString()

    // 查找所有已过期但未触发的提醒
    const missedReminders = await db.select(
      `SELECT r.*, t.title as task_title
       FROM reminders r
       JOIN tasks t ON r.task_id = t.id
       WHERE r.status = 'pending' AND r.remind_at <= $1
       ORDER BY r.remind_at ASC`,
      [now]
    )

    console.log(`Found ${missedReminders.length} missed reminders`)

    // 触发错过的提醒
    for (const row of missedReminders) {
      const reminder: ReminderInfo = {
        id: row.id,
        taskId: row.task_id,
        taskTitle: row.task_title,
        remindAt: row.remind_at,
        status: row.status,
        snoozedUntil: row.snoozed_until,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }

      await this.triggerReminder(reminder)
    }
  }

  /**
   * 时区改变时重新计算提醒
   */
  async onTimezoneChange(): Promise<void> {
    console.log('Timezone changed, recalculating reminders...')

    // 停止当前调度
    this.stop()

    // 重新加载并调度
    await this.start()
  }

  /**
   * 设置系统事件监听
   */
  private setupSystemListeners(): void {
    // 监听系统睡眠/唤醒
    if (typeof window !== 'undefined') {
      // 使用 Page Visibility API 检测页面可见性变化
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.onSystemResume()
        }
      })
    }
  }

  /**
   * 获取即将触发的提醒
   */
  async getUpcomingReminders(limit = 10): Promise<ReminderInfo[]> {
    const db = await getDatabase()
    const now = new Date().toISOString()

    const result = await db.select(
      `SELECT r.*, t.title as task_title
       FROM reminders r
       JOIN tasks t ON r.task_id = t.id
       WHERE r.status = 'pending' AND r.remind_at > $1
       ORDER BY r.remind_at ASC
       LIMIT $2`,
      [now, limit]
    )

    return result.map((row: any) => ({
      id: row.id,
      taskId: row.task_id,
      taskTitle: row.task_title,
      remindAt: row.remind_at,
      status: row.status,
      snoozedUntil: row.snoozed_until,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
  }

  /**
   * 清理过期的提醒
   */
  async cleanupOldReminders(daysToKeep = 30): Promise<number> {
    const db = await getDatabase()
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - daysToKeep)

    const result = await db.execute(
      `DELETE FROM reminders WHERE status IN ('confirmed', 'cancelled', 'triggered') AND updated_at < $1`,
      [cutoff.toISOString()]
    )

    return result.rowsAffected
  }
}

// 创建全局实例
export const reminderScheduler = new ReminderScheduler()
