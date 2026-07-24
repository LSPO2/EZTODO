import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Task } from '../repositories'
import { calculateReminderTime, ReminderScheduler } from '../reminder'

const mocks = vi.hoisted(() => ({ execute: vi.fn(), select: vi.fn() }))

vi.mock('../repositories/sql-repository', () => ({
  getSqlRepository: vi.fn().mockResolvedValue(mocks),
}))

const task = (dueAt: string): Task => ({
  id: 'task-1', parentId: null, projectId: null, title: '提交报告', note: null,
  status: 'todo', priority: 'p2', sortOrder: 0, scheduledDate: null, scheduledAt: null,
  dueAt, isAllDay: false, timezone: 'Asia/Shanghai', estimatedMinutes: null,
  createdAt: '', updatedAt: '', completedAt: null, deletedAt: null, revision: 1,
  source: 'manual', sourceCaptureId: null,
})

describe('ReminderScheduler planned reminder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.execute.mockResolvedValue({ rowsAffected: 1 })
    mocks.select.mockResolvedValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calculates reminder time relative to the deadline', () => {
    expect(calculateReminderTime('2026-08-02T12:00:00.000Z', 8 * 60))
      .toBe('2026-08-02T04:00:00.000Z')
  })

  it('replaces the persisted task reminder and schedules the selected offset', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-02T08:00:00.000Z'))
    const scheduler = new ReminderScheduler()

    await scheduler.setTaskReminder(task('2026-08-02T12:00:00.000Z'), 60)

    expect(mocks.execute).toHaveBeenNthCalledWith(1, 'DELETE FROM reminders WHERE task_id = $1', ['task-1'])
    expect(mocks.execute).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO reminders'),
      ['reminder-task-1-due', 'task-1', '2026-08-02T11:00:00.000Z', '2026-08-02T08:00:00.000Z']
    )
    scheduler.stop()
  })

  it('persists independent start and deadline reminders', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-02T08:00:00.000Z'))
    const scheduler = new ReminderScheduler()
    await scheduler.setTaskReminders(task('2026-08-02T12:00:00.000Z'), [
      { kind: 'start', remindAt: '2026-08-02T09:00:00.000Z' },
      { kind: 'due', remindAt: '2026-08-02T11:30:00.000Z' },
    ])

    expect(mocks.execute).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO reminders'), [
      'reminder-task-1-start', 'task-1', '2026-08-02T09:00:00.000Z', '2026-08-02T08:00:00.000Z',
    ])
    expect(mocks.execute).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO reminders'), [
      'reminder-task-1-due', 'task-1', '2026-08-02T11:30:00.000Z', '2026-08-02T08:00:00.000Z',
    ])
    scheduler.stop()
  })
  it('removes the reminder when the user chooses no reminder', async () => {
    const scheduler = new ReminderScheduler()
    await scheduler.setTaskReminder(task('2026-08-02T12:00:00.000Z'), null)
    expect(mocks.execute).toHaveBeenCalledTimes(1)
    expect(mocks.execute).toHaveBeenCalledWith('DELETE FROM reminders WHERE task_id = $1', ['task-1'])
  })
})
