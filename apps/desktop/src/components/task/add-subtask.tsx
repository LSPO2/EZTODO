/**
 * Add subtask component
 */

import React, { useState } from 'react'
import { useTaskStore } from '../../stores'
import type { Task } from '../../lib/repositories'

interface AddSubtaskProps {
  parentTask: Task
  onSubtaskAdded?: () => void
}

export const AddSubtask: React.FC<AddSubtaskProps> = ({
  parentTask,
  onSubtaskAdded,
}) => {
  const { createTask } = useTaskStore()
  const [title, setTitle] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    setIsCreating(true)
    try {
      await createTask({
        title: title.trim(),
        parentId: parentTask.id,
        projectId: parentTask.projectId || undefined,
        priority: parentTask.priority,
      })
      setTitle('')
      onSubtaskAdded?.()
    } finally {
      setIsCreating(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
    if (e.key === 'Escape') {
      setTitle('')
    }
  }

  return (
    <form className="add-subtask" onSubmit={handleSubmit}>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="添加子任务..."
        disabled={isCreating}
        className="subtask-input"
      />
      <button
        type="submit"
        className="btn-add-subtask"
        disabled={!title.trim() || isCreating}
      >
        {isCreating ? '...' : '+'}
      </button>
    </form>
  )
}
