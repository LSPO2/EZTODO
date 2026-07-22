/**
 * Window management module
 */

import { getCurrentWindow } from '@tauri-apps/api/window'

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

  console.log('Window management initialized')
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
