/**
 * Quick add task component
 */

import React, { useState, useRef } from 'react'
import { useTaskStore } from '../../stores'

interface QuickAddProps {
  onTaskCreated?: () => void
}

export const QuickAdd: React.FC<QuickAddProps> = ({ onTaskCreated }) => {
  const { createTask } = useTaskStore()
  const [title, setTitle] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    setIsCreating(true)
    try {
      await createTask({ title: title.trim() })
      setTitle('')
      onTaskCreated?.()
    } finally {
      setIsCreating(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <form className="quick-add" onSubmit={handleSubmit}>
      <input
        ref={inputRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="添加任务... (按 Enter 保存)"
        disabled={isCreating}
        autoFocus
      />
      <button
        type="submit"
        className="btn-add"
        disabled={!title.trim() || isCreating}
      >
        {isCreating ? '添加中...' : '添加'}
      </button>
    </form>
  )
}
