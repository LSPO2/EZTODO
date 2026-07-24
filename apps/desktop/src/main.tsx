/**
 * EZTODO Desktop Application Entry Point
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { isTauriEnvironment } from './lib/environment'

// Check if running in Tauri
const isTauri = isTauriEnvironment()

// Initialize application (only in Tauri)
async function initializeApp() {
  if (!isTauri) {
    console.log('Running in browser mode (Tauri APIs disabled)')
    return
  }

  try {
    // Dynamic imports for Tauri-only modules
    const { initializeWindow } = await import('./lib/window')
    const { initializeTray } = await import('./lib/tray')
    const { initializeShortcuts } = await import('./lib/shortcuts')
    const { reminderScheduler } = await import('./lib/reminder')

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

// Initialize app
initializeApp()

// Render app
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
