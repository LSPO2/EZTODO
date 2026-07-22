/**
 * Main application layout
 */

import React, { useEffect, useState } from 'react'
import { Sidebar } from './sidebar'
import { Toolbar } from './toolbar'
import { TaskList, TaskDetail, QuickAdd } from '../task'
import { ViewHeader } from '../view'
import { useTaskStore, useProjectStore, useTagStore } from '../../stores'
import type { Task } from '../../lib/repositories'

export const AppLayout: React.FC = () => {
  const { loadTasks, currentTask, setCurrentTask, currentView, tasks } = useTaskStore()
  const { loadProjects } = useProjectStore()
  const { loadTags } = useTagStore()
  const [showDetail, setShowDetail] = useState(false)

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

  return (
    <div className="app-layout">
      <Sidebar />

      <div className="main-content">
        <Toolbar />

        <div className="content-area">
          <ViewHeader view={currentView} taskCount={tasks.length} />

          <QuickAdd onTaskCreated={handleTaskCreated} />

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
      </div>
    </div>
  )
}
