/**
 * Toolbar component
 */

import React, { useState } from 'react'
import { useTaskStore } from '../../stores'

export const Toolbar: React.FC = () => {
  const { currentView, filters, setFilters } = useTaskStore()
  const [searchQuery, setSearchQuery] = useState('')

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    setFilters({ ...filters, search: searchQuery || undefined })
  }

  return (
    <div className="toolbar">
      <div className="toolbar-title">
        <h2>
          {currentView === 'inbox' && '📥 收件箱'}
          {currentView === 'today' && '📅 今天'}
          {currentView === 'week' && '📆 未来 7 天'}
          {currentView === 'overdue' && '⚠️ 已逾期'}
          {currentView === 'no-date' && '📋 无日期'}
          {currentView === 'completed' && '✅ 已完成'}
          {currentView === 'trash' && '🗑️ 回收站'}
        </h2>
      </div>

      <form className="toolbar-search" onSubmit={handleSearch}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="🔍 搜索..."
          style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', width: '200px' }}
        />
      </form>
    </div>
  )
}
