/**
 * AI Confirm Card component
 * Shows parsed task results for user confirmation
 */

import React, { useState } from 'react'

export interface ParsedTask {
  title: string
  note?: string
  scheduledDate?: string
  scheduledAt?: string
  dueAt?: string
  reminders?: string[]
  priority?: string
  project?: string
  tags?: string[]
  subtasks?: ParsedTask[]
  recurrence?: any
  confidence?: string
  uncertainFields?: string[]
}

interface AIConfirmCardProps {
  tasks: ParsedTask[]
  confidence: string
  warnings: string[]
  onConfirm: (tasks: ParsedTask[]) => void
  onCancel: () => void
}

export const AIConfirmCard: React.FC<AIConfirmCardProps> = ({
  tasks,
  confidence,
  warnings,
  onConfirm,
  onCancel,
}) => {
  const [editedTasks, setEditedTasks] = useState<ParsedTask[]>(tasks)
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  const handleTaskChange = (index: number, field: string, value: any) => {
    const newTasks = [...editedTasks]
    newTasks[index] = { ...newTasks[index], [field]: value }
    setEditedTasks(newTasks)
  }

  const handleConfirm = () => {
    onConfirm(editedTasks)
  }

  const getConfidenceColor = (conf: string) => {
    switch (conf) {
      case 'high': return '#27ae60'
      case 'medium': return '#f39c12'
      case 'low': return '#e74c3c'
      default: return '#95a5a6'
    }
  }

  const getConfidenceLabel = (conf: string) => {
    switch (conf) {
      case 'high': return '高置信度'
      case 'medium': return '中置信度'
      case 'low': return '低置信度'
      default: return '未知'
    }
  }

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return null
    try {
      const date = new Date(dateStr)
      return date.toLocaleString('zh-CN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return dateStr
    }
  }

  const getPriorityIcon = (priority?: string) => {
    switch (priority) {
      case 'p1': return '🔴'
      case 'p2': return '🟠'
      case 'p3': return '🟡'
      case 'p4': return '🔵'
      default: return '⚪'
    }
  }

  return (
    <div className="ai-confirm-card">
      <div className="ai-card-header">
        <div className="ai-card-title">
          <span className="ai-icon">🤖</span>
          <h3>AI 解析结果</h3>
        </div>
        <div
          className="confidence-badge"
          style={{ background: getConfidenceColor(confidence) }}
        >
          {getConfidenceLabel(confidence)}
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="ai-warnings">
          {warnings.map((warning, i) => (
            <div key={i} className="warning-item">
              ⚠️ {warning}
            </div>
          ))}
        </div>
      )}

      <div className="ai-tasks-list">
        {editedTasks.map((task, index) => (
          <div
            key={index}
            className={`ai-task-item ${expandedIndex === index ? 'expanded' : ''}`}
          >
            <div
              className="ai-task-header"
              onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
            >
              <div className="ai-task-main">
                <span className="ai-task-icon">
                  {task.subtasks && task.subtasks.length > 0 ? '📋' : '✅'}
                </span>
                <span className="ai-task-title">{task.title}</span>
                {task.priority && (
                  <span className="ai-task-priority">{getPriorityIcon(task.priority)}</span>
                )}
              </div>
              <div className="ai-task-meta">
                {task.scheduledDate && (
                  <span className="ai-task-date">📅 {task.scheduledDate}</span>
                )}
                {task.scheduledAt && (
                  <span className="ai-task-time">⏰ {formatDateTime(task.scheduledAt)}</span>
                )}
                {task.dueAt && (
                  <span className="ai-task-due">🔔 {formatDateTime(task.dueAt)}</span>
                )}
              </div>
            </div>

            {expandedIndex === index && (
              <div className="ai-task-details">
                <div className="ai-task-field">
                  <label>标题</label>
                  <input
                    type="text"
                    value={task.title}
                    onChange={(e) => handleTaskChange(index, 'title', e.target.value)}
                  />
                </div>

                {task.note && (
                  <div className="ai-task-field">
                    <label>备注</label>
                    <textarea
                      value={task.note}
                      onChange={(e) => handleTaskChange(index, 'note', e.target.value)}
                    />
                  </div>
                )}

                <div className="ai-task-field">
                  <label>计划日期</label>
                  <input
                    type="date"
                    value={task.scheduledDate || ''}
                    onChange={(e) => handleTaskChange(index, 'scheduledDate', e.target.value)}
                  />
                </div>

                <div className="ai-task-field">
                  <label>截止时间</label>
                  <input
                    type="datetime-local"
                    value={task.dueAt || ''}
                    onChange={(e) => handleTaskChange(index, 'dueAt', e.target.value)}
                  />
                </div>

                <div className="ai-task-field">
                  <label>优先级</label>
                  <select
                    value={task.priority || 'none'}
                    onChange={(e) => handleTaskChange(index, 'priority', e.target.value)}
                  >
                    <option value="none">无优先级</option>
                    <option value="p1">P1 - 紧急重要</option>
                    <option value="p2">P2 - 重要不紧急</option>
                    <option value="p3">P3 - 紧急不重要</option>
                    <option value="p4">P4 - 不紧急不重要</option>
                  </select>
                </div>

                {task.subtasks && task.subtasks.length > 0 && (
                  <div className="ai-task-subtasks">
                    <label>子任务</label>
                    <ul>
                      {task.subtasks.map((sub, i) => (
                        <li key={i}>{sub.title}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {task.uncertainFields && task.uncertainFields.length > 0 && (
                  <div className="ai-task-uncertain">
                    <label>不确定字段</label>
                    <div className="uncertain-tags">
                      {task.uncertainFields.map((field, i) => (
                        <span key={i} className="uncertain-tag">{field}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="ai-card-actions">
        <button className="btn-cancel" onClick={onCancel}>
          取消
        </button>
        <button className="btn-confirm" onClick={handleConfirm}>
          ✓ 确认创建 {editedTasks.length} 个任务
        </button>
      </div>
    </div>
  )
}
