/**
 * Subtask list component
 */

import React, { useState, useEffect } from 'react'
import type { Task } from '../../lib/repositories'
import { useTaskStore } from '../../stores'

interface SubtaskListProps {
  parentTask: Task
  onTaskSelect?: (task: Task) => void
}

export const SubtaskList: React.FC<SubtaskListProps> = ({
  parentTask,
  onTaskSelect,
}) => {
  const { tasks } = useTaskStore()
  const [subtasks, setSubtasks] = useState<Task[]>([])
  const [isExpanded, setIsExpanded] = useState(true)

  useEffect(() => {
    // Filter tasks that have this task as parent
    const children = tasks.filter((t) => t.parentId === parentTask.id)
    setSubtasks(children)
  }, [parentTask.id, tasks])

  const completedCount = subtasks.filter((t) => t.status === 'done').length
  const totalCount = subtasks.length

  if (totalCount === 0) {
    return null
  }

  return (
    <div className="subtask-list">
      <div className="subtask-header" onClick={() => setIsExpanded(!isExpanded)}>
        <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
        <span className="subtask-title">子任务</span>
        <span className="subtask-progress">
          {completedCount}/{totalCount}
        </span>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${(completedCount / totalCount) * 100}%` }}
          />
        </div>
      </div>

      {isExpanded && (
        <div className="subtask-items">
          {subtasks.map((subtask) => (
            <div
              key={subtask.id}
              className={`subtask-item ${subtask.status === 'done' ? 'completed' : ''}`}
              onClick={() => onTaskSelect?.(subtask)}
            >
              <div className={`subtask-checkbox ${subtask.status === 'done' ? 'done' : ''}`} />
              <span className="subtask-name">{subtask.title}</span>
              {subtask.priority !== 'none' && (
                <span className="subtask-priority">
                  {subtask.priority === 'p1' ? '🔴' :
                   subtask.priority === 'p2' ? '🟠' :
                   subtask.priority === 'p3' ? '🟡' :
                   subtask.priority === 'p4' ? '🔵' : '⚪'}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
