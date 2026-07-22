/**
 * AI Quick Add component
 * Supports both normal and AI task creation
 */

import React, { useState, useRef } from 'react'
import { AIConfirmCard } from './ai-confirm-card'
import type { ParsedTask } from './ai-confirm-card'
import { useTaskStore } from '../../stores'

interface AIQuickAddProps {
  onTaskCreated?: () => void
}

export const AIQuickAdd: React.FC<AIQuickAddProps> = ({ onTaskCreated }) => {
  const { createTask } = useTaskStore()
  const [input, setInput] = useState('')
  const [isAIMode, setIsAIMode] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [parsedTasks, setParsedTasks] = useState<ParsedTask[] | null>(null)
  const [parseResult, setParseResult] = useState<{
    confidence: string
    warnings: string[]
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    if (isAIMode) {
      await handleAIParse()
    } else {
      await handleNormalCreate()
    }
  }

  const handleNormalCreate = async () => {
    setIsLoading(true)
    setError(null)

    try {
      await createTask({ title: input.trim() })
      setInput('')
      onTaskCreated?.()
    } catch (err) {
      setError('创建任务失败')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAIParse = async () => {
    setIsLoading(true)
    setError(null)
    setParsedTasks(null)

    try {
      // Call AI parse API
      const response = await fetch('http://localhost:8000/api/v1/ai/parse-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // TODO: Add auth token
        },
        body: JSON.stringify({
          text: input,
          current_time: new Date().toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      })

      if (!response.ok) {
        throw new Error('AI 解析请求失败')
      }

      const result = await response.json()

      // Check confidence
      if (result.confidence === 'high') {
        // Auto-create high confidence tasks
        await handleConfirmCreate(result.tasks)
      } else {
        // Show confirmation card for medium/low confidence
        setParsedTasks(result.tasks)
        setParseResult({
          confidence: result.confidence,
          warnings: result.warnings || [],
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 解析失败')
      // Fallback to normal creation
      await handleNormalCreate()
    } finally {
      setIsLoading(false)
    }
  }

  const handleConfirmCreate = async (tasks: ParsedTask[]) => {
    setIsLoading(true)

    try {
      for (const task of tasks) {
        await createTask({
          title: task.title,
          note: task.note,
          priority: task.priority as any,
          scheduledDate: task.scheduledDate,
          scheduledAt: task.scheduledAt,
          dueAt: task.dueAt,
        })
      }

      // Clear state
      setInput('')
      setParsedTasks(null)
      setParseResult(null)
      onTaskCreated?.()

      // Show success notification
      showNotification(`已创建 ${tasks.length} 个任务`)
    } catch (err) {
      setError('创建任务失败')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    setParsedTasks(null)
    setParseResult(null)
    setError(null)
  }

  const showNotification = (message: string) => {
    // TODO: Implement proper notification
    console.log(message)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
    if (e.key === 'Escape') {
      handleCancel()
    }
  }

  return (
    <div className="ai-quick-add">
      <form className="quick-add-form" onSubmit={handleSubmit}>
        <div className="quick-add-input-wrapper">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isAIMode ? "输入自然语言，AI 自动解析..." : "添加任务..."}
            disabled={isLoading}
            className="quick-add-input"
          />

          <div className="quick-add-actions">
            <button
              type="button"
              className={`ai-toggle ${isAIMode ? 'active' : ''}`}
              onClick={() => setIsAIMode(!isAIMode)}
              title={isAIMode ? '切换到普通模式' : '切换到 AI 模式'}
            >
              🤖
            </button>

            <button
              type="submit"
              className="btn-add"
              disabled={!input.trim() || isLoading}
            >
              {isLoading ? '...' : isAIMode ? 'AI 创建' : '添加'}
            </button>
          </div>
        </div>

        {error && (
          <div className="quick-add-error">
            ⚠️ {error}
          </div>
        )}
      </form>

      {parsedTasks && parseResult && (
        <AIConfirmCard
          tasks={parsedTasks}
          confidence={parseResult.confidence}
          warnings={parseResult.warnings}
          onConfirm={handleConfirmCreate}
          onCancel={handleCancel}
        />
      )}

      {isLoading && isAIMode && (
        <div className="ai-loading">
          <div className="ai-loading-spinner" />
          <span>AI 正在解析...</span>
        </div>
      )}
    </div>
  )
}
