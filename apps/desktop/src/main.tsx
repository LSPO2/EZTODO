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

    // Deliver a native Windows notification, play a system sound and flash the taskbar.
    const { deliverReminderNotification } = await import('./lib/reminder-notification')
    reminderScheduler.onTrigger((reminder) => {
      void deliverReminderNotification(reminder).catch((error) => {
        console.error('Failed to deliver reminder notification:', error)
      })
    })

    console.log('Application initialized successfully')
  } catch (error) {
    console.error('Failed to initialize application:', error)
  }
}


// Initialize app
initializeApp()

// Render app
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
