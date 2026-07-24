/**
 * Window management module
 */

import { getCurrentWindow, LogicalSize, LogicalPosition } from '@tauri-apps/api/window'

type WindowCloseGuard = () => Promise<boolean>
let windowCloseGuard: WindowCloseGuard | null = null

export function registerWindowCloseGuard(guard: WindowCloseGuard): () => void {
  windowCloseGuard = guard
  return () => { if (windowCloseGuard === guard) windowCloseGuard = null }
}

export async function confirmWindowClose(): Promise<boolean> {
  return windowCloseGuard ? windowCloseGuard() : true
}

export interface WindowState {
  width: number
  height: number
  x: number
  y: number
  maximized: boolean
}

/**
 * Initialize window management
 */
export async function initializeWindow(): Promise<void> {
  // Handle DPI scaling
  await handleDpiScaling()

  // Prevent multiple instances
  await preventMultipleInstances()

  // Restore saved window state
  await restoreWindowState()

  // Set up close-to-tray behavior
  setupCloseToTray()

  // Save window state on resize/move
  setupWindowStateSaving()

  console.log('Window management initialized')
}

const WINDOW_STATE_KEY = 'eztodo_window_state'

/**
 * Save current window state to localStorage
 */
async function saveWindowState(): Promise<void> {
  try {
    const state = await getWindowState()
    localStorage.setItem(WINDOW_STATE_KEY, JSON.stringify(state))
  } catch {
    // Non-fatal
  }
}

/**
 * Restore saved window state from localStorage
 */
async function restoreWindowState(): Promise<void> {
  try {
    const saved = localStorage.getItem(WINDOW_STATE_KEY)
    if (!saved) return

    const state: WindowState = JSON.parse(saved)
    const window = getCurrentWindow()

    // Restore size (with minimum bounds check)
    if (state.width >= 800 && state.height >= 600) {
      await window.setSize(new LogicalSize(state.width, state.height))
    }

    // Restore position
    if (state.x >= 0 && state.y >= 0) {
      await window.setPosition(new LogicalPosition(state.x, state.y))
    }

    // Restore maximized state
    if (state.maximized) {
      await window.maximize()
    }
  } catch {
    // Non-fatal: use default window size
  }
}

/**
 * Set up close-to-tray behavior
 * When user clicks the close button, hide to tray instead of closing
 */
function setupCloseToTray(): void {
  const window = getCurrentWindow()
  window.onCloseRequested(async (event) => {
    event.preventDefault()
    if (!(await confirmWindowClose())) return
    await hideToTray()
  })
}

/**
 * Save window state on resize and move events
 */
function setupWindowStateSaving(): void {
  const window = getCurrentWindow()

  // Debounce state saving to avoid excessive writes
  let saveTimeout: ReturnType<typeof setTimeout> | null = null
  const debouncedSave = () => {
    if (saveTimeout) clearTimeout(saveTimeout)
    saveTimeout = setTimeout(() => { saveWindowState() }, 500)
  }

  window.onResized(debouncedSave)
  window.onMoved(debouncedSave)
}

/**
 * Handle DPI scaling
 */
async function handleDpiScaling(): Promise<void> {
  const window = getCurrentWindow()
  const scaleFactor = await window.scaleFactor()

  // Apply DPI-specific styles
  document.documentElement.style.setProperty('--scale-factor', String(scaleFactor))

  if (scaleFactor >= 1.5) {
    document.documentElement.classList.add('high-dpi')
  }
}

/**
 * Prevent multiple application instances
 */
async function preventMultipleInstances(): Promise<void> {
  // This is handled by Tauri's single-instance plugin
  // If another instance is detected, it will focus the existing window
  console.log('Single instance protection enabled')
}

/**
 * Center window on screen
 */
export async function centerWindow(): Promise<void> {
  const window = getCurrentWindow()
  await window.center()
}

/**
 * Minimize window
 */
export async function minimizeWindow(): Promise<void> {
  const window = getCurrentWindow()
  await window.minimize()
}

/**
 * Maximize/restore window
 */
export async function toggleMaximize(): Promise<void> {
  const window = getCurrentWindow()
  const isMaximized = await window.isMaximized()

  if (isMaximized) {
    await window.unmaximize()
  } else {
    await window.maximize()
  }
}

/**
 * Hide window to tray
 */
export async function hideToTray(): Promise<void> {
  const window = getCurrentWindow()
  await window.hide()
}

/**
 * Show window from tray
 */
export async function showFromTray(): Promise<void> {
  const window = getCurrentWindow()
  await window.show()
  await window.setFocus()
}

/**
 * Check if window is visible
 */
export async function isWindowVisible(): Promise<boolean> {
  const window = getCurrentWindow()
  return window.isVisible()
}

/**
 * Set window title
 */
export async function setWindowTitle(title: string): Promise<void> {
  const window = getCurrentWindow()
  await window.setTitle(title)
}

/**
 * Get window state
 */
export async function getWindowState(): Promise<WindowState> {
  const window = getCurrentWindow()
  const size = await window.outerSize()
  const position = await window.outerPosition()
  const isMaximized = await window.isMaximized()

  return {
    width: size.width,
    height: size.height,
    x: position.x,
    y: position.y,
    maximized: isMaximized,
  }
}
