/**
 * Task detail panel component
 */

import React, { useState, useEffect } from 'react'
import type { Task, UpdateTaskRequest } from '../../lib/repositories'
import { useTaskStore } from '../../stores'
import { SubtaskList } from './subtask-list'
import { AddSubtask } from './add-subtask'
import { ReminderList } from '../reminder/reminder-list'
import { RecurrenceEditor } from '../reminder/recurrence-editor'

interface TaskDetailProps {
  task: Task
  onClose: () => void
}

export const TaskDetail: React.FC<TaskDetailProps> = ({ task, onClose }) => {
  const { updateTask, deleteTask, loadTasks } = useTaskStore()
  const [formData, setFormData] = useState<UpdateTaskRequest>({})
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setFormData({
      title: task.title,
      note: task.note || '',
      priority: task.priority,
      scheduledDate: task.scheduledDate || '',
      dueAt: task.dueAt || '',
      isAllDay: task.isAllDay,
    })
  }, [task])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await updateTask(task.id, formData)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (window.confirm('确定要删除这个任务吗？')) {
      await deleteTask(task.id)
      onClose()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    }
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSave()
    }
  }

  const handleSubtaskAdded = () => {
    loadTasks()
  }

  return (
    <div className="task-detail" onKeyDown={handleKeyDown}>
      <div className="detail-header">
        <h2>{task.title}</h2>
        <div className="header-actions">
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>
      </div>

      <div className="detail-section">
        <h4>基本信息</h4>
        <div className="detail-row">
          <label>标题</label>
          <input
            type="text"
            value={formData.title || ''}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            onBlur={handleSave}
          />
        </div>
        <div className="detail-row">
          <label>优先级</label>
          <select
            value={formData.priority || 'none'}
            onChange={(e) => {
              setFormData({ ...formData, priority: e.target.value as any })
              handleSave()
            }}
          >
            <option value="none">⚪ 无优先级</option>
            <option value="p1">🔴 P1 - 紧急重要</option>
            <option value="p2">🟠 P2 - 重要不紧急</option>
            <option value="p3">🟡 P3 - 紧急不重要</option>
            <option value="p4">🔵 P4 - 不紧急不重要</option>
          </select>
        </div>
      </div>

      <div className="detail-section">
        <h4>时间</h4>
        <div className="detail-row">
          <label>计划日期</label>
          <input
            type="date"
            value={formData.scheduledDate || ''}
            onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
            onBlur={handleSave}
          />
        </div>
        <div className="detail-row">
          <label>截止时间</label>
          <input
            type="datetime-local"
            value={formData.dueAt || ''}
            onChange={(e) => setFormData({ ...formData, dueAt: e.target.value })}
            onBlur={handleSave}
          />
        </div>
        <div className="detail-row">
          <label>全天任务</label>
          <input
            type="checkbox"
            checked={formData.isAllDay || false}
            onChange={(e) => {
              setFormData({ ...formData, isAllDay: e.target.checked })
              handleSave()
            }}
          />
        </div>
      </div>

      <div className="detail-section">
        <h4>备注</h4>
        <textarea
          value={formData.note || ''}
          onChange={(e) => setFormData({ ...formData, note: e.target.value })}
          onBlur={handleSave}
          placeholder="添加备注..."
          rows={4}
        />
      </div>

      <div className="detail-section">
        <ReminderList taskId={task.id} />
      </div>

      <div className="detail-section">
        <RecurrenceEditor taskId={task.id} />
      </div>

      <div className="detail-section">
        <h4>子任务</h4>
        <SubtaskList
          parentTask={task}
          onTaskSelect={() => {
            // TODO: Navigate to subtask
          }}
        />
        <AddSubtask
          parentTask={task}
          onSubtaskAdded={handleSubtaskAdded}
        />
      </div>

      <div className="detail-section">
        <h4>任务信息</h4>
        <div className="detail-row">
          <label>状态</label>
          <span className={`status ${task.status}`}>
            {task.status === 'todo' ? '待办' : task.status === 'done' ? '已完成' : '已取消'}
          </span>
        </div>
        <div className="detail-row">
          <label>创建时间</label>
          <span>{new Date(task.createdAt).toLocaleString('zh-CN')}</span>
        </div>
        {task.completedAt && (
          <div className="detail-row">
            <label>完成时间</label>
            <span>{new Date(task.completedAt).toLocaleString('zh-CN')}</span>
          </div>
        )}
      </div>

      <div className="detail-actions">
        <button className="btn-save" onClick={handleSave} disabled={isSaving}>
          {isSaving ? '保存中...' : '保存'}
        </button>
        <button className="btn-delete" onClick={handleDelete}>
          删除任务
        </button>
      </div>
    </div>
  )
}
