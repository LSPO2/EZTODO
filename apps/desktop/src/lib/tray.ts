/**
 * System tray module
 */

import { TrayIcon } from '@tauri-apps/api/tray'
import { Menu } from '@tauri-apps/api/menu'
import { hideToTray, showFromTray, isWindowVisible } from './window'

let trayIcon: TrayIcon | null = null

/**
 * Initialize system tray
 */
export async function initializeTray(): Promise<void> {
  try {
    // Create tray menu
    const menu = await createTrayMenu()

    // Create tray icon
    trayIcon = await TrayIcon.new({
      id: 'eztodo-tray',
      icon: 'icons/tray.ico',
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
async function handleTrayClick(): Promise<void> {
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
  // TODO: Open quick add dialog
  console.log('Quick add triggered from tray')
}

/**
 * Handle show today from tray menu
 */
async function handleShowToday(): Promise<void> {
  await showFromTray()
  // TODO: Navigate to today view
  console.log('Show today triggered from tray')
}

/**
 * Handle sync from tray menu
 */
async function handleSync(): Promise<void> {
  // TODO: Trigger sync
  console.log('Sync triggered from tray')
}

/**
 * Handle settings from tray menu
 */
async function handleSettings(): Promise<void> {
  await showFromTray()
  // TODO: Open settings
  console.log('Settings triggered from tray')
}

/**
 * Handle quit from tray menu
 */
async function handleQuit(): Promise<void> {
  // Show confirmation dialog
  const confirmed = window.confirm('退出后将无法收到本地提醒，确定要退出吗？')

  if (confirmed) {
    // TODO: Perform cleanup
    console.log('Quitting application')
    // In Tauri, we can use process.exit or app.quit
    // For now, just hide to tray
    await hideToTray()
  }
}

/**
 * Update tray icon
 */
export async function updateTrayIcon(iconPath: string): Promise<void> {
  if (trayIcon) {
    await trayIcon.setIcon(iconPath)
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
