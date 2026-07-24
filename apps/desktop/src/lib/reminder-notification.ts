import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow, UserAttentionType } from '@tauri-apps/api/window'
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification'
import type { ReminderInfo } from './reminder'

/** Deliver a native Windows reminder and make the taskbar button demand attention. */
export async function deliverReminderNotification(reminder: ReminderInfo): Promise<void> {
  let allowed = await isPermissionGranted()
  if (!allowed) allowed = (await requestPermission()) === 'granted'

  if (allowed) {
    sendNotification({
      title: reminder.kind === 'start' ? 'EZTODO 开始提醒' : reminder.kind === 'due' ? 'EZTODO 截止提醒' : 'EZTODO 任务提醒',
      body: reminder.taskTitle,
    })
  }

  await Promise.allSettled([
    invoke('play_reminder_sound'),
    getCurrentWindow().requestUserAttention(UserAttentionType.Critical),
  ])
}
