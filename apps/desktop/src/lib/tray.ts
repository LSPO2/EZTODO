/**
 * System tray module
 */

import { TrayIcon, type TrayIconEvent } from '@tauri-apps/api/tray'
import { Menu } from '@tauri-apps/api/menu'
import { defaultWindowIcon } from '@tauri-apps/api/app'
import { Image } from '@tauri-apps/api/image'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { confirmWindowClose, showFromTray } from './window'
import { requestTrayNavigation } from './tray-navigation'

const TRAY_ID = 'eztodo-tray'
let trayIcon: TrayIcon | null = null
let trayInitialization: Promise<void> | null = null

/**
 * Initialize system tray
 */
export async function initializeTray(): Promise<void> {
  if (trayIcon) return
  if (trayInitialization) return trayInitialization

  trayInitialization = initializeTrayOnce()
  try {
    await trayInitialization
  } finally {
    trayInitialization = null
  }
}

async function initializeTrayOnce(): Promise<void> {
  try {
    const existingTray = await TrayIcon.getById(TRAY_ID)
    if (existingTray) {
      trayIcon = existingTray
      console.log('Using existing system tray')
      return
    }
    // Create tray menu
    const menu = await createTrayMenu()
    const icon = await defaultWindowIcon()

    if (!icon) {
      throw new Error('Default application icon is unavailable')
    }

    // Create tray icon
    trayIcon = await TrayIcon.new({
      id: TRAY_ID,
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

  // A tray click should be idempotent. Windows can emit multiple click
  // notifications for one physical interaction, so toggling visibility here
  // causes the window to hide and immediately show again.
  await handleQuickAdd()
}

/**
 * Handle quick add from tray menu
 */
async function handleQuickAdd(): Promise<void> {
  await showFromTray()
  requestTrayNavigation('quick-add')
}

/**
 * Handle show today from tray menu
 */
async function handleShowToday(): Promise<void> {
  await showFromTray()
  requestTrayNavigation('today')
}

/**
 * Handle settings from tray menu
 */
async function handleSettings(): Promise<void> {
  await showFromTray()
  requestTrayNavigation('settings')
}

/**
 * Handle quit from tray menu
 */
async function handleQuit(): Promise<void> {
  if (!(await confirmWindowClose())) return
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
