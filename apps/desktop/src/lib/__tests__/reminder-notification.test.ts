import { beforeEach, describe, expect, it, vi } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import { isPermissionGranted, sendNotification } from '@tauri-apps/plugin-notification'
import { deliverReminderNotification } from '../reminder-notification'

const windowMocks = vi.hoisted(() => ({ requestUserAttention: vi.fn() }))

vi.mock('@tauri-apps/api/window', () => ({
  UserAttentionType: { Critical: 1, Informational: 2 },
  getCurrentWindow: () => ({ requestUserAttention: windowMocks.requestUserAttention }),
}))

describe('deliverReminderNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isPermissionGranted).mockResolvedValue(true)
    windowMocks.requestUserAttention.mockResolvedValue(undefined)
  })

  it('uses a native notification, system sound and taskbar attention request', async () => {
    await deliverReminderNotification({
      id: 'reminder-task-1', taskId: 'task-1', taskTitle: '提交报告',
      remindAt: '2026-08-02T11:00:00.000Z', status: 'pending', kind: 'start',
    })

    expect(sendNotification).toHaveBeenCalledWith({ title: 'EZTODO 开始提醒', body: '提交报告' })
    expect(invoke).toHaveBeenCalledWith('play_reminder_sound')
    expect(windowMocks.requestUserAttention).toHaveBeenCalledWith(1)
  })
})
