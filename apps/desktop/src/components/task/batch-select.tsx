/**
 * Batch selection hook
 */

import { useState, useEffect } from 'react'
import type { Task } from '../../lib/repositories'

interface BatchSelectOptions {
  tasks: Task[]
  onSelectionChange?: (ids: string[]) => void
}

export function useBatchSelect({ tasks, onSelectionChange }: BatchSelectOptions) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isSelectMode, setIsSelectMode] = useState(false)
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null)

  useEffect(() => {
    // Exit select mode if no tasks selected
    if (isSelectMode && selectedIds.length === 0) {
      setIsSelectMode(false)
    }
  }, [selectedIds, isSelectMode])

  const handleToggleSelectMode = () => {
    if (isSelectMode) {
      setSelectedIds([])
      onSelectionChange?.([])
    }
    setIsSelectMode(!isSelectMode)
  }

  const handleSelectTask = (task: Task, index: number, event: React.MouseEvent) => {
    if (!isSelectMode) {
      setIsSelectMode(true)
    }

    let newSelectedIds = [...selectedIds]

    if (event.ctrlKey || event.metaKey) {
      // Toggle selection
      const idx = newSelectedIds.indexOf(task.id)
      if (idx === -1) {
        newSelectedIds.push(task.id)
      } else {
        newSelectedIds.splice(idx, 1)
      }
    } else if (event.shiftKey && lastSelectedIndex !== null) {
      // Range selection
      const start = Math.min(lastSelectedIndex, index)
      const end = Math.max(lastSelectedIndex, index)
      const rangeIds = tasks.slice(start, end + 1).map((t) => t.id)
      newSelectedIds = [...new Set([...newSelectedIds, ...rangeIds])]
    } else {
      // Single selection
      const idx = newSelectedIds.indexOf(task.id)
      if (idx === -1) {
        newSelectedIds.push(task.id)
      } else {
        newSelectedIds.splice(idx, 1)
      }
    }

    setLastSelectedIndex(index)
    setSelectedIds(newSelectedIds)
    onSelectionChange?.(newSelectedIds)
  }

  const handleSelectAll = () => {
    const newIds = selectedIds.length === tasks.length ? [] : tasks.map((t) => t.id)
    setSelectedIds(newIds)
    onSelectionChange?.(newIds)
  }

  const handleClearSelection = () => {
    setSelectedIds([])
    setIsSelectMode(false)
    onSelectionChange?.([])
  }

  const isAllSelected = tasks.length > 0 && selectedIds.length === tasks.length
  const isSomeSelected = selectedIds.length > 0 && selectedIds.length < tasks.length

  return {
    selectedIds,
    isSelectMode,
    handleToggleSelectMode,
    handleSelectTask,
    handleSelectAll,
    handleClearSelection,
    isAllSelected,
    isSomeSelected,
  }
}

/**
 * Batch select toolbar component
 */
interface BatchToolbarProps {
  selectedCount: number
  totalCount: number
  isAllSelected: boolean
  isSomeSelected: boolean
  onSelectAll: () => void
  onClearSelection: () => void
  onComplete: () => void
  onDelete: () => void
  onMove: () => void
  onChangePriority: () => void
}

export const BatchToolbar: React.FC<BatchToolbarProps> = ({
  selectedCount,
  totalCount,
  isAllSelected,
  isSomeSelected,
  onSelectAll,
  onClearSelection,
  onComplete,
  onDelete,
  onMove,
  onChangePriority,
}) => {
  if (selectedCount === 0) {
    return null
  }

  return (
    <div className="batch-toolbar">
      <div className="batch-info">
        <label className="batch-checkbox">
          <input
            type="checkbox"
            checked={isAllSelected}
            ref={(input) => {
              if (input) {
                input.indeterminate = isSomeSelected
              }
            }}
            onChange={onSelectAll}
          />
          <span className="checkmark" />
        </label>
        <span className="batch-count">
          已选择 {selectedCount} / {totalCount} 个任务
        </span>
        <button className="btn-clear" onClick={onClearSelection}>
          ✕ 清除选择
        </button>
      </div>

      <div className="batch-actions">
        <button className="btn-batch" onClick={onComplete} title="批量完成">
          ✅ 完成
        </button>
        <button className="btn-batch" onClick={onDelete} title="批量删除">
          🗑️ 删除
        </button>
        <button className="btn-batch" onClick={onMove} title="移动到项目">
          📁 移动
        </button>
        <button className="btn-batch" onClick={onChangePriority} title="修改优先级">
          🔴 优先级
        </button>
      </div>
    </div>
  )
}
