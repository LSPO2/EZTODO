/**
 * EZTODO Desktop Application Entry Point
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initializeWindow } from './lib/window'
import { initializeTray } from './lib/tray'
import { initializeShortcuts } from './lib/shortcuts'
import { reminderScheduler } from './lib/reminder'

// Initialize application
async function initializeApp() {
  try {
    // Initialize window management
    await initializeWindow()

    // Initialize system tray
    await initializeTray()

    // Initialize keyboard shortcuts
    await initializeShortcuts()

    // Initialize reminder scheduler
    await reminderScheduler.start()

    // Set up reminder notification handler
    reminderScheduler.onTrigger((reminder) => {
      // Show notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('EZTODO 提醒', {
          body: reminder.taskTitle,
          icon: '/favicon.ico',
        })
      }
    })

    console.log('Application initialized successfully')
  } catch (error) {
    console.error('Failed to initialize application:', error)
  }
}

// Request notification permission
if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission()
}

// Initialize app before rendering
initializeApp()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
