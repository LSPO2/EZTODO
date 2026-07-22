/**
 * Main application layout
 */

import React, { useEffect, useState } from 'react'
import { Sidebar } from './sidebar'
import { Toolbar } from './toolbar'
import { TaskList, TaskDetail } from '../task'
import { AIQuickAdd } from '../ai'
import { ViewHeader } from '../view'
import { TrashPage } from '../trash'
import { DataPage } from '../data'
import { useTaskStore, useProjectStore, useTagStore } from '../../stores'
import type { Task } from '../../lib/repositories'

type Page = 'tasks' | 'trash' | 'data'

export const AppLayout: React.FC = () => {
  const { loadTasks, currentTask, setCurrentTask, currentView, tasks } = useTaskStore()
  const { loadProjects } = useProjectStore()
  const { loadTags } = useTagStore()
  const [showDetail, setShowDetail] = useState(false)
  const [currentPage, setCurrentPage] = useState<Page>('tasks')

  // Load initial data
  useEffect(() => {
    loadTasks()
    loadProjects()
    loadTags()
  }, [])

  const handleTaskSelect = (task: Task) => {
    setCurrentTask(task)
    setShowDetail(true)
  }

  const handleTaskEdit = (task: Task) => {
    setCurrentTask(task)
    setShowDetail(true)
  }

  const handleCloseDetail = () => {
    setShowDetail(false)
    setCurrentTask(null)
  }

  const handleTaskCreated = () => {
    loadTasks()
  }

  const handleNavigate = (page: string) => {
    setCurrentPage(page as Page)
  }

  return (
    <div className="app-layout">
      <Sidebar onNavigate={handleNavigate} />

      <div className="main-content">
        {currentPage === 'tasks' && (
          <>
            <Toolbar />
            <div className="content-area">
              <ViewHeader view={currentView} taskCount={tasks.length} />
              <AIQuickAdd onTaskCreated={handleTaskCreated} />
              <div className="task-area">
                <TaskList
                  onTaskSelect={handleTaskSelect}
                  onTaskEdit={handleTaskEdit}
                />
                {showDetail && currentTask && (
                  <TaskDetail
                    task={currentTask}
                    onClose={handleCloseDetail}
                  />
                )}
              </div>
            </div>
          </>
        )}

        {currentPage === 'trash' && (
          <div className="content-area">
            <TrashPage />
          </div>
        )}

        {currentPage === 'data' && (
          <div className="content-area">
            <DataPage />
          </div>
        )}
      </div>
    </div>
  )
}
