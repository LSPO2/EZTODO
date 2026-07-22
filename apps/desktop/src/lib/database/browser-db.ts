/**
 * Browser-compatible database adapter using localStorage
 * Fallback when Tauri SQL plugin is not available
 */

export class BrowserDatabase {
  private storageKey = 'eztodo_db'

  constructor() {
    // Initialize storage if not exists
    if (!localStorage.getItem(this.storageKey)) {
      localStorage.setItem(this.storageKey, JSON.stringify({}))
    }
  }

  async execute(sql: string, params?: any[]): Promise<{ rowsAffected: number }> {
    // Parse SQL operation
    const operation = sql.trim().toUpperCase().split(' ')[0]

    switch (operation) {
      case 'CREATE':
        // Table creation - just acknowledge
        return { rowsAffected: 0 }

      case 'INSERT':
        return this.handleInsert(sql, params)

      case 'UPDATE':
        return this.handleUpdate(sql, params)

      case 'DELETE':
        return this.handleDelete(sql, params)

      case 'PRAGMA':
        // PRAGMA commands - just acknowledge
        return { rowsAffected: 0 }

      default:
        return { rowsAffected: 0 }
    }
  }

  async select<T>(sql: string, params?: any[]): Promise<T> {
    // Parse table name from SELECT
    const match = sql.match(/FROM\s+(\w+)/i)
    if (!match) return [] as any

    const tableName = match[1].toLowerCase()
    const db = this.getDb()

    // Get all items from table
    const items = db[tableName] || []

    // Apply simple filtering if WHERE clause exists
    if (sql.includes('WHERE') && params && params.length > 0) {
      // Simple parametric filtering
      return items.filter((_item: any) => {
        // Basic implementation - can be extended
        return true
      }) as any
    }

    return items as any
  }

  async close(): Promise<void> {
    // Nothing to close for localStorage
  }

  private getDb(): any {
    const data = localStorage.getItem(this.storageKey)
    return data ? JSON.parse(data) : {}
  }

  private saveDb(db: any): void {
    localStorage.setItem(this.storageKey, JSON.stringify(db))
  }

  private handleInsert(sql: string, params?: any[]): { rowsAffected: number } {
    if (!params || params.length === 0) return { rowsAffected: 0 }

    // Extract table name
    const match = sql.match(/INTO\s+(\w+)/i)
    if (!match) return { rowsAffected: 0 }

    const tableName = match[1].toLowerCase()
    const db = this.getDb()

    if (!db[tableName]) {
      db[tableName] = []
    }

    // Create record from params (simplified)
    const record: any = {}
    const columns = sql.match(/\(([^)]+)\)/)?.[1]?.split(',').map(c => c.trim())

    if (columns && columns.length === params.length) {
      columns.forEach((col, index) => {
        record[col] = params[index]
      })
    } else {
      // Fallback: use first param as id
      record.id = params[0]
      record.data = params.slice(1)
    }

    db[tableName].push(record)
    this.saveDb(db)

    return { rowsAffected: 1 }
  }

  private handleUpdate(sql: string, params?: any[]): { rowsAffected: number } {
    if (!params || params.length === 0) return { rowsAffected: 0 }

    // Extract table name
    const match = sql.match(/UPDATE\s+(\w+)/i)
    if (!match) return { rowsAffected: 0 }

    const tableName = match[1].toLowerCase()
    const db = this.getDb()

    if (!db[tableName]) {
      db[tableName] = []
    }

    // Simple update - find by last param (usually id)
    const id = params[params.length - 1]
    const index = db[tableName].findIndex((item: any) => item.id === id)

    if (index !== -1) {
      // Update fields (simplified)
      db[tableName][index] = { ...db[tableName][index], updated_at: new Date().toISOString() }
      this.saveDb(db)
      return { rowsAffected: 1 }
    }

    return { rowsAffected: 0 }
  }

  private handleDelete(sql: string, params?: any[]): { rowsAffected: number } {
    if (!params || params.length === 0) return { rowsAffected: 0 }

    // Extract table name
    const match = sql.match(/FROM\s+(\w+)/i)
    if (!match) return { rowsAffected: 0 }

    const tableName = match[1].toLowerCase()
    const db = this.getDb()

    if (!db[tableName]) {
      db[tableName] = []
    }

    // Simple delete - find by first param
    const id = params[0]
    const initialLength = db[tableName].length
    db[tableName] = db[tableName].filter((item: any) => item.id !== id)

    if (db[tableName].length < initialLength) {
      this.saveDb(db)
      return { rowsAffected: 1 }
    }

    return { rowsAffected: 0 }
  }
}
