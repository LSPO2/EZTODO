/**
 * Task card component
 */

import React, { useState } from 'react'
import type { Task } from '../../lib/repositories'
import { useTaskStore } from '../../stores'

interface TaskCardProps {
  task: Task
  isSelected?: boolean
  onSelect?: (task: Task) => void
  onEdit?: (task: Task) => void
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  isSelected = false,
  onSelect,
  onEdit,
}) => {
  const { completeTask, uncompleteTask, deleteTask } = useTaskStore()
  const [isCompleting, setIsCompleting] = useState(false)

  const handleToggleComplete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsCompleting(true)
    try {
      if (task.status === 'done') {
        await uncompleteTask(task.id)
      } else {
        await completeTask(task.id)
      }
    } finally {
      setIsCompleting(false)
    }
  }

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (window.confirm('确定要删除这个任务吗？')) {
      await deleteTask(task.id)
    }
  }

  const handleClick = () => {
    onSelect?.(task)
  }

  const handleDoubleClick = () => {
    onEdit?.(task)
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'p1': return '#e74c3c'
      case 'p2': return '#e67e22'
      case 'p3': return '#f1c40f'
      case 'p4': return '#3498db'
      default: return '#bdc3c7'
    }
  }

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'p1': return '🔴'
      case 'p2': return '🟠'
      case 'p3': return '🟡'
      case 'p4': return '🔵'
      default: return '⚪'
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null
    const date = new Date(dateStr)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    if (date < today) {
      return '已逾期'
    } else if (date >= today && date < tomorrow) {
      return '今天'
    } else {
      return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
    }
  }

  const isOverdue = task.dueAt && new Date(task.dueAt) < new Date() && task.status !== 'done'

  return (
    <div
      className={`task-card ${isSelected ? 'selected' : ''} ${task.priority}`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      style={{
        borderLeftColor: getPriorityColor(task.priority),
        opacity: isCompleting ? 0.6 : 1,
      }}
    >
      <div className="header">
        <div
          className={`checkbox ${task.status === 'done' ? 'done' : ''}`}
          onClick={handleToggleComplete}
        />
        <div className={`title ${task.status === 'done' ? 'done' : ''}`}>
          {task.title}
        </div>
        {task.priority !== 'none' && (
          <span className="priority">{getPriorityIcon(task.priority)}</span>
        )}
      </div>
      <div className="meta">
        {task.scheduledDate && (
          <span className="tag">📅 {formatDate(task.scheduledDate)}</span>
        )}
        {task.dueAt && (
          <span className={`tag ${isOverdue ? 'overdue' : ''}`}>
            ⏰ {formatDate(task.dueAt)}
          </span>
        )}
        {task.status === 'done' && (
          <span className="tag completed">✓ 已完成</span>
        )}
      </div>
      <div className="actions">
        <button className="btn-delete" onClick={handleDelete}>
          🗑️
        </button>
      </div>
    </div>
  )
}
