/**
 * Keyboard shortcuts module
 */

import { register, unregister, isRegistered } from '@tauri-apps/plugin-global-shortcut'

export interface ShortcutConfig {
  id: string
  key: string
  description: string
  action: () => void
  global?: boolean
}

// Default shortcuts
const defaultShortcuts: ShortcutConfig[] = [
  {
    id: 'new-task',
    key: 'Ctrl+N',
    description: '新建任务',
    action: () => {
      // TODO: Open new task dialog
      console.log('New task shortcut triggered')
    },
  },
  {
    id: 'search',
    key: 'Ctrl+K',
    description: '全局搜索',
    action: () => {
      // TODO: Focus search input
      console.log('Search shortcut triggered')
    },
  },
  {
    id: 'save',
    key: 'Ctrl+Enter',
    description: '保存任务',
    action: () => {
      // TODO: Save current task
      console.log('Save shortcut triggered')
    },
  },
  {
    id: 'close',
    key: 'Escape',
    description: '关闭面板',
    action: () => {
      // TODO: Close current panel/dialog
      console.log('Close shortcut triggered')
    },
  },
]

// Global shortcuts (work even when app is not focused)
const globalShortcuts: ShortcutConfig[] = [
  {
    id: 'global-quick-add',
    key: 'Ctrl+Shift+A',
    description: '全局快速添加',
    action: () => {
      // TODO: Open quick add window
      console.log('Global quick add triggered')
    },
    global: true,
  },
]

const registeredShortcuts: Map<string, ShortcutConfig> = new Map()

/**
 * Initialize keyboard shortcuts
 */
export async function initializeShortcuts(): Promise<void> {
  // Register local shortcuts
  for (const shortcut of defaultShortcuts) {
    await registerShortcut(shortcut)
  }

  // Register global shortcuts
  for (const shortcut of globalShortcuts) {
    await registerGlobalShortcut(shortcut)
  }

  console.log('Keyboard shortcuts initialized')
}

/**
 * Register a local keyboard shortcut
 */
export async function registerShortcut(shortcut: ShortcutConfig): Promise<void> {
  try {
    // Add event listener
    document.addEventListener('keydown', (e) => {
      const keys = shortcut.key.split('+')
      const ctrl = keys.includes('Ctrl')
      const shift = keys.includes('Shift')
      const alt = keys.includes('Alt')
      const key = keys[keys.length - 1]

      if (
        e.ctrlKey === ctrl &&
        e.shiftKey === shift &&
        e.altKey === alt &&
        e.key === key
      ) {
        e.preventDefault()
        shortcut.action()
      }
    })

    registeredShortcuts.set(shortcut.id, shortcut)
    console.log(`Registered shortcut: ${shortcut.key} (${shortcut.description})`)
  } catch (error) {
    console.error(`Failed to register shortcut ${shortcut.key}:`, error)
  }
}

/**
 * Register a global keyboard shortcut
 */
export async function registerGlobalShortcut(shortcut: ShortcutConfig): Promise<void> {
  try {
    // Check if already registered
    const isAlreadyRegistered = await isRegistered(shortcut.key)
    if (isAlreadyRegistered) {
      console.warn(`Global shortcut ${shortcut.key} is already registered`)
      return
    }

    // Register global shortcut
    await register(shortcut.key, shortcut.action)
    registeredShortcuts.set(shortcut.id, shortcut)
    console.log(`Registered global shortcut: ${shortcut.key} (${shortcut.description})`)
  } catch (error) {
    console.error(`Failed to register global shortcut ${shortcut.key}:`, error)
  }
}

/**
 * Unregister a shortcut
 */
export async function unregisterShortcut(id: string): Promise<void> {
  const shortcut = registeredShortcuts.get(id)
  if (shortcut) {
    if (shortcut.global) {
      await unregister(shortcut.key)
    }
    registeredShortcuts.delete(id)
    console.log(`Unregistered shortcut: ${shortcut.key}`)
  }
}

/**
 * Update shortcut configuration
 */
export async function updateShortcut(
  id: string,
  newKey: string
): Promise<void> {
  const shortcut = registeredShortcuts.get(id)
  if (shortcut) {
    // Unregister old shortcut
    await unregisterShortcut(id)

    // Register with new key
    const updatedShortcut = { ...shortcut, key: newKey }
    if (shortcut.global) {
      await registerGlobalShortcut(updatedShortcut)
    } else {
      await registerShortcut(updatedShortcut)
    }
  }
}

/**
 * Get all registered shortcuts
 */
export function getShortcuts(): ShortcutConfig[] {
  return Array.from(registeredShortcuts.values())
}

/**
 * Check if a shortcut key is available
 */
export function isShortcutAvailable(key: string): boolean {
  for (const shortcut of registeredShortcuts.values()) {
    if (shortcut.key === key) {
      return false
    }
  }
  return true
}

/**
 * Handle shortcut conflicts
 */
export function checkShortcutConflict(key: string): ShortcutConfig | null {
  for (const shortcut of registeredShortcuts.values()) {
    if (shortcut.key === key) {
      return shortcut
    }
  }
  return null
}
