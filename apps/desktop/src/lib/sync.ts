/**
 * Client-side sync module
 * Handles synchronization with the server
 */

import { getDatabase } from './database'

export type SyncState = 'idle' | 'pushing' | 'pulling' | 'applying' | 'retrying' | 'error' | 'conflict'

export interface SyncStatus {
  state: SyncState
  lastSyncAt: string | null
  pendingOperations: number
  error: string | null
}

export interface SyncConfig {
  apiUrl: string
  syncInterval: number  // ms
  maxRetries: number
  retryDelay: number  // ms
}

export class SyncManager {
  private config: SyncConfig
  private state: SyncState = 'idle'
  private accessToken: string | null = null
  private syncTimer: ReturnType<typeof setInterval> | null = null
  private retryCount = 0
  private lastSyncAt: string | null = null

  constructor(config: SyncConfig) {
    this.config = config
  }

  /**
   * Set authentication tokens
   */
  setTokens(accessToken: string, _refreshToken: string): void {
    this.accessToken = accessToken
  }

  /**
   * Clear authentication tokens
   */
  clearTokens(): void {
    this.accessToken = null
  }

  /**
   * Get current sync status
   */
  async getStatus(): Promise<SyncStatus> {
    const db = await getDatabase()
    const result = await db.select<{ count: number }[]>(
      `SELECT COUNT(*) as count FROM sync_outbox WHERE synced_at IS NULL`
    )

    return {
      state: this.state,
      lastSyncAt: this.lastSyncAt,
      pendingOperations: result[0]?.count || 0,
      error: null,
    }
  }

  /**
   * Start automatic sync
   */
  startAutoSync(): void {
    if (this.syncTimer) {
      return
    }

    this.syncTimer = setInterval(() => {
      this.sync()
    }, this.config.syncInterval)

    console.log('Auto sync started')
  }

  /**
   * Stop automatic sync
   */
  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
      this.syncTimer = null
    }

    console.log('Auto sync stopped')
  }

  /**
   * Perform sync
   */
  async sync(): Promise<void> {
    if (!this.accessToken) {
      console.log('No access token, skipping sync')
      return
    }

    if (this.state !== 'idle') {
      console.log('Sync already in progress')
      return
    }

    try {
      // Push local changes
      await this.pushLocalChanges()

      // Pull remote changes
      await this.pullRemoteChanges()

      this.lastSyncAt = new Date().toISOString()
      this.retryCount = 0
      this.state = 'idle'
    } catch (error) {
      console.error('Sync failed:', error)
      this.state = 'error'

      // Retry logic
      if (this.retryCount < this.config.maxRetries) {
        this.retryCount++
        this.state = 'retrying'
        setTimeout(() => {
          this.state = 'idle'
          this.sync()
        }, this.config.retryDelay * this.retryCount)
      }
    }
  }

  /**
   * Push local changes to server
   */
  private async pushLocalChanges(): Promise<void> {
    this.state = 'pushing'

    const db = await getDatabase()

    // Get pending operations
    const operations = await db.select<any[]>(
      `SELECT * FROM sync_outbox WHERE synced_at IS NULL ORDER BY created_at ASC LIMIT 100`
    )

    if (operations.length === 0) {
      return
    }

    // Call sync push API
    const response = await fetch(`${this.config.apiUrl}/api/v1/sync/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify({
        operations: operations.map(op => ({
          operation_id: op.operation_id,
          entity_type: op.entity_type,
          entity_id: op.entity_id,
          operation: op.operation,
          payload: JSON.parse(op.payload),
          base_revision: op.base_revision,
        })),
      }),
    })

    if (!response.ok) {
      throw new Error(`Push failed: ${response.statusText}`)
    }

    const result = await response.json()

    // Mark accepted operations as synced
    const now = new Date().toISOString()
    for (const operationId of result.accepted) {
      await db.execute(
        `UPDATE sync_outbox SET synced_at = $1 WHERE operation_id = $2`,
        [now, operationId]
      )
    }

    console.log(`Pushed ${result.accepted.length} operations`)
  }

  /**
   * Pull remote changes from server
   */
  private async pullRemoteChanges(): Promise<void> {
    this.state = 'pulling'

    const db = await getDatabase()

    // Get last cursor
    const cursorResult = await db.select<{ value: string }[]>(
      `SELECT value FROM settings WHERE key = 'sync_cursor'`
    )
    const cursor = cursorResult[0]?.value || '0'

    // Call sync pull API
    const response = await fetch(
      `${this.config.apiUrl}/api/v1/sync/pull?cursor=${cursor}&limit=100`,
      {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Pull failed: ${response.statusText}`)
    }

    const result = await response.json()

    // Apply remote changes
    this.state = 'applying'
    for (const operation of result.operations) {
      await this.applyRemoteOperation(operation)
    }

    // Update cursor
    await db.execute(
      `INSERT INTO settings (key, value, updated_at) VALUES ('sync_cursor', $1, $2)
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = $2`,
      [String(result.next_cursor), new Date().toISOString()]
    )

    console.log(`Pulled ${result.operations.length} operations`)
  }

  /**
   * Apply a remote operation to local database
   */
  private async applyRemoteOperation(operation: any): Promise<void> {
    const db = await getDatabase()

    switch (operation.entity_type) {
      case 'task':
        await this.applyTaskOperation(db, operation)
        break
      case 'project':
        await this.applyProjectOperation(db, operation)
        break
      case 'tag':
        await this.applyTagOperation(db, operation)
        break
      default:
        console.warn(`Unknown entity type: ${operation.entity_type}`)
    }
  }

  /**
   * Apply task operation
   */
  private async applyTaskOperation(db: any, operation: any): Promise<void> {
    const { entity_id, operation: op, payload } = operation

    switch (op) {
      case 'create':
        await db.execute(
          `INSERT OR IGNORE INTO tasks (id, title, note, status, priority, ...)
           VALUES ($1, $2, $3, $4, $5, ...)`,
          [entity_id, payload.title, payload.note, payload.status, payload.priority]
        )
        break

      case 'update':
        await db.execute(
          `UPDATE tasks SET title = $1, note = $2, status = $3, priority = $4, ...
           WHERE id = $5`,
          [payload.title, payload.note, payload.status, payload.priority, entity_id]
        )
        break

      case 'delete':
        await db.execute(
          `UPDATE tasks SET deleted_at = $1 WHERE id = $2`,
          [new Date().toISOString(), entity_id]
        )
        break
    }
  }

  /**
   * Apply project operation
   */
  private async applyProjectOperation(_db: any, _operation: any): Promise<void> {
    // Similar to task operation
  }

  /**
   * Apply tag operation
   */
  private async applyTagOperation(_db: any, _operation: any): Promise<void> {
    // Similar to task operation
  }

  /**
   * Login and start sync
   */
  async login(username: string, password: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.apiUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          password,
          device_name: 'EZTODO Desktop',
          platform: 'windows',
          app_version: '0.1.0',
        }),
      })

      if (!response.ok) {
        return false
      }

      const result = await response.json()
      this.setTokens(result.access_token, result.refresh_token)

      // Start auto sync
      this.startAutoSync()

      // Initial sync
      await this.sync()

      return true
    } catch (error) {
      console.error('Login failed:', error)
      return false
    }
  }

  /**
   * Logout and stop sync
   */
  async logout(): Promise<void> {
    // Stop auto sync
    this.stopAutoSync()

    // Call logout API
    if (this.accessToken) {
      try {
        await fetch(`${this.config.apiUrl}/api/v1/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
          },
        })
      } catch (error) {
        console.error('Logout API failed:', error)
      }
    }

    // Clear tokens
    this.clearTokens()

    // Reset state
    this.state = 'idle'
    this.lastSyncAt = null
    this.retryCount = 0
  }
}

// Create global instance
export const syncManager = new SyncManager({
  apiUrl: 'http://localhost:8000',
  syncInterval: 5 * 60 * 1000,  // 5 minutes
  maxRetries: 3,
  retryDelay: 1000,
})
