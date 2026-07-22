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

// Initialize application
async function initializeApp() {
  try {
    // Initialize window management
    await initializeWindow()

    // Initialize system tray
    await initializeTray()

    // Initialize keyboard shortcuts
    await initializeShortcuts()

    console.log('Application initialized successfully')
  } catch (error) {
    console.error('Failed to initialize application:', error)
  }
}

// Initialize app before rendering
initializeApp()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
