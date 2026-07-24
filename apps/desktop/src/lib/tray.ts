/**
 * System tray module
 */

import { TrayIcon, type TrayIconEvent } from '@tauri-apps/api/tray'
import { Menu } from '@tauri-apps/api/menu'
import { defaultWindowIcon } from '@tauri-apps/api/app'
import { Image } from '@tauri-apps/api/image'
import { emit } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { hideToTray, showFromTray, isWindowVisible } from './window'

let trayIcon: TrayIcon | null = null

/**
 * Initialize system tray
 */
export async function initializeTray(): Promise<void> {
  try {
    // Create tray menu
    const menu = await createTrayMenu()
    const icon = await defaultWindowIcon()

    if (!icon) {
      throw new Error('Default application icon is unavailable')
    }

    // Create tray icon
    trayIcon = await TrayIcon.new({
      id: 'eztodo-tray',
      icon,
      menu,
      menuOnLeftClick: false,
      tooltip: 'EZTODO',
      action: handleTrayClick,
    })

    console.log('System tray initialized')
  } catch (error) {
    console.error('Failed to initialize tray:', error)
  }
}

/**
 * Create tray menu
 */
async function createTrayMenu(): Promise<Menu> {
  return Menu.new({
    items: [
      {
        id: 'quick-add',
        text: '快速添加',
        action: handleQuickAdd,
      },
      {
        id: 'today',
        text: '今天',
        action: handleShowToday,
      },
      {
        id: 'sync',
        text: '同步',
        action: handleSync,
      },
      {
        id: 'settings',
        text: '设置',
        action: handleSettings,
      },
      {
        id: 'quit',
        text: '退出',
        action: handleQuit,
      },
    ],
  })
}

/**
 * Handle tray icon click
 */
async function handleTrayClick(event: TrayIconEvent): Promise<void> {
  if (event.type !== 'Click' || event.button !== 'Left' || event.buttonState !== 'Up') {
    return
  }

  const isVisible = await isWindowVisible()

  if (isVisible) {
    await hideToTray()
  } else {
    await showFromTray()
  }
}

/**
 * Handle quick add from tray menu
 */
async function handleQuickAdd(): Promise<void> {
  await showFromTray()
  await emit('tray:quick-add')
}

/**
 * Handle show today from tray menu
 */
async function handleShowToday(): Promise<void> {
  await showFromTray()
  await emit('tray:show-today')
}

/**
 * Handle sync from tray menu
 */
async function handleSync(): Promise<void> {
  await emit('tray:sync')
}

/**
 * Handle settings from tray menu
 */
async function handleSettings(): Promise<void> {
  await showFromTray()
  await emit('tray:settings')
}

/**
 * Handle quit from tray menu
 */
async function handleQuit(): Promise<void> {
  // Destroy the window to actually quit the application
  const window = getCurrentWindow()
  await window.destroy()
}

/**
 * Update tray icon
 */
export async function updateTrayIcon(iconPath: string): Promise<void> {
  if (trayIcon) {
    const icon = await Image.fromPath(iconPath)
    await trayIcon.setIcon(icon)
  }
}

/**
 * Update tray tooltip
 */
export async function updateTrayTooltip(tooltip: string): Promise<void> {
  if (trayIcon) {
    await trayIcon.setTooltip(tooltip)
  }
}

/**
 * Show notification from tray
 */
export async function showTrayNotification(title: string, body: string): Promise<void> {
  // Use Tauri notification plugin
  const { sendNotification } = await import('@tauri-apps/plugin-notification')
  sendNotification({ title, body })
}
