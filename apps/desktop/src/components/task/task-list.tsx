/**
 * Task list component
 */

import React from 'react'
import { TaskCard } from './task-card'
import { useTaskStore } from '../../stores'
import type { Task } from '../../lib/repositories'

interface TaskListProps {
  onTaskSelect?: (task: Task) => void
  onTaskEdit?: (task: Task) => void
}

export const TaskList: React.FC<TaskListProps> = ({
  onTaskSelect,
  onTaskEdit,
}) => {
  const { tasks, isLoading, error, currentTask } = useTaskStore()

  if (isLoading) {
    return (
      <div className="task-list-loading">
        <div className="spinner" />
        <span>加载中...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="task-list-error">
        <span className="error-icon">⚠️</span>
        <span>{error}</span>
      </div>
    )
  }

  if (tasks.length === 0) {
    return (
      <div className="task-list-empty">
        <div className="empty-icon">📝</div>
        <h3>暂无任务</h3>
        <p>点击上方输入框添加新任务</p>
      </div>
    )
  }

  // Group tasks by parent/child
  const rootTasks = tasks.filter((t) => !t.parentId)
  const childTasks = tasks.filter((t) => t.parentId)

  const getChildren = (parentId: string) => {
    return childTasks.filter((t) => t.parentId === parentId)
  }

  return (
    <div className="task-list">
      {rootTasks.map((task) => (
        <div key={task.id} className="task-group">
          <TaskCard
            task={task}
            isSelected={currentTask?.id === task.id}
            onSelect={onTaskSelect}
            onEdit={onTaskEdit}
          />
          {getChildren(task.id).length > 0 && (
            <div className="subtasks">
              {getChildren(task.id).map((child) => (
                <TaskCard
                  key={child.id}
                  task={child}
                  isSelected={currentTask?.id === child.id}
                  onSelect={onTaskSelect}
                  onEdit={onTaskEdit}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
