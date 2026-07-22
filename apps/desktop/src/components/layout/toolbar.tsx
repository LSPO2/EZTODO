/**
 * Toolbar component
 */

import React, { useState } from 'react'
import { useTaskStore } from '../../stores'
import { FilterBar, SortMenu } from '../view'
import type { SortField, SortDirection } from '../../lib/repositories'

export const Toolbar: React.FC = () => {
  const { searchTasks, loadTasks, currentView, filters, setFilters } = useTaskStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [sortField, setSortField] = useState<SortField>('sortOrder')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      setIsSearching(true)
      await searchTasks(searchQuery)
      setIsSearching(false)
    } else {
      loadTasks()
    }
  }

  const handleClearSearch = () => {
    setSearchQuery('')
    loadTasks()
  }

  const handleSortChange = (field: SortField, direction: SortDirection) => {
    setSortField(field)
    setSortDirection(direction)
    // TODO: Apply sorting to task list
  }

  const getViewTitle = () => {
    switch (currentView) {
      case 'inbox': return '📥 收件箱'
      case 'today': return '📅 今天'
      case 'week': return '📆 未来 7 天'
      case 'overdue': return '⚠️ 已逾期'
      case 'no-date': return '📋 无日期任务'
      case 'completed': return '✅ 已完成'
      case 'trash': return '🗑️ 回收站'
      default: return '📋 EZTODO'
    }
  }

  return (
    <div className="toolbar">
      <div className="toolbar-title">
        <h2>{getViewTitle()}</h2>
      </div>

      <form className="toolbar-search" onSubmit={handleSearch}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="🔍 搜索任务..."
          disabled={isSearching}
        />
        {searchQuery && (
          <button
            type="button"
            className="btn-clear"
            onClick={handleClearSearch}
          >
            ✕
          </button>
        )}
      </form>

      <div className="toolbar-actions">
        <FilterBar
          filters={filters}
          onFiltersChange={setFilters}
        />
        <SortMenu
          sortField={sortField}
          sortDirection={sortDirection}
          onSortChange={handleSortChange}
        />
      </div>
    </div>
  )
}
