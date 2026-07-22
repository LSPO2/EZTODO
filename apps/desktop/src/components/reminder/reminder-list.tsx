/**
 * Reminder list component
 */

import React, { useState, useEffect } from 'react'
import type { ReminderInfo } from '../../lib/reminder'
import { reminderScheduler } from '../../lib/reminder'
import { getRelativeTime, formatTime } from '../../lib/time'

interface ReminderListProps {
  taskId: string
  onReminderAdd?: () => void
}

export const ReminderList: React.FC<ReminderListProps> = ({
  taskId,
  onReminderAdd,
}) => {
  const [reminders, setReminders] = useState<ReminderInfo[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [newReminderTime, setNewReminderTime] = useState('')

  useEffect(() => {
    loadReminders()
  }, [taskId])

  const loadReminders = async () => {
    setIsLoading(true)
    try {
      const taskReminders = await reminderScheduler.getTaskReminders(taskId)
      setReminders(taskReminders)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddReminder = async () => {
    if (!newReminderTime) return

    try {
      await reminderScheduler.addReminder(taskId, newReminderTime)
      setNewReminderTime('')
      await loadReminders()
      onReminderAdd?.()
    } catch (error) {
      console.error('Failed to add reminder:', error)
    }
  }

  const handleRemoveReminder = async (reminderId: string) => {
    try {
      await reminderScheduler.removeReminder(reminderId)
      await loadReminders()
    } catch (error) {
      console.error('Failed to remove reminder:', error)
    }
  }

  const handleConfirmReminder = async (reminderId: string) => {
    try {
      await reminderScheduler.confirmReminder(reminderId)
      await loadReminders()
    } catch (error) {
      console.error('Failed to confirm reminder:', error)
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return '等待触发'
      case 'triggered': return '已触发'
      case 'confirmed': return '已确认'
      case 'snoozed': return '已稍后'
      case 'cancelled': return '已取消'
      default: return status
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#3498db'
      case 'triggered': return '#e74c3c'
      case 'confirmed': return '#27ae60'
      case 'snoozed': return '#f39c12'
      case 'cancelled': return '#95a5a6'
      default: return '#95a5a6'
    }
  }

  if (isLoading) {
    return <div className="reminder-loading">加载中...</div>
  }

  return (
    <div className="reminder-list">
      <div className="reminder-header">
        <h4>提醒</h4>
        <span className="reminder-count">{reminders.length} 个提醒</span>
      </div>

      <div className="reminder-items">
        {reminders.map((reminder) => (
          <div key={reminder.id} className={`reminder-item ${reminder.status}`}>
            <div className="reminder-info">
              <div className="reminder-time">
                {getRelativeTime(reminder.remindAt)} {formatTime(reminder.remindAt)}
              </div>
              <div
                className="reminder-status"
                style={{ color: getStatusColor(reminder.status) }}
              >
                {getStatusLabel(reminder.status)}
              </div>
            </div>
            <div className="reminder-actions">
              {reminder.status === 'pending' && (
                <button
                  className="btn-confirm"
                  onClick={() => handleConfirmReminder(reminder.id)}
                  title="确认"
                >
                  ✓
                </button>
              )}
              <button
                className="btn-remove"
                onClick={() => handleRemoveReminder(reminder.id)}
                title="删除"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="reminder-add">
        <input
          type="datetime-local"
          value={newReminderTime}
          onChange={(e) => setNewReminderTime(e.target.value)}
          className="reminder-input"
        />
        <button
          className="btn-add-reminder"
          onClick={handleAddReminder}
          disabled={!newReminderTime}
        >
          + 添加提醒
        </button>
      </div>
    </div>
  )
}
