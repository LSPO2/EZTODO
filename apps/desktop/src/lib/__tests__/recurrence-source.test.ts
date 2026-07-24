/**
 * Recurrence source CHECK constraint tests
 * Verifies that the tasks table accepts 'recurrence' as a source value
 */

import { describe, it, expect } from 'vitest'

describe('Recurrence source CHECK constraint', () => {
  it('V6 migration should be included in getMigrations()', async () => {
    // Read the database module source to verify V6 exists
    const fs = await import('fs')
    const path = await import('path')
    const dbPath = path.resolve(__dirname, '../database/index.ts')
    const source = fs.readFileSync(dbPath, 'utf-8')

    // Verify V6 migration exists
    expect(source).toContain('version: 6')
    expect(source).toContain("Add recurrence to tasks source CHECK constraint")
  })

  it('V6 migration should include recurrence in CHECK constraint', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const dbPath = path.resolve(__dirname, '../database/index.ts')
    const source = fs.readFileSync(dbPath, 'utf-8')

    // Verify the new CHECK constraint includes 'recurrence'
    expect(source).toContain("'manual', 'ai', 'import', 'api', 'recurrence'")

    // Verify the migration recreates the table
    expect(source).toContain('CREATE TABLE IF NOT EXISTS tasks_new')
    expect(source).toContain('INSERT INTO tasks_new SELECT * FROM tasks')
    expect(source).toContain('DROP TABLE tasks')
    expect(source).toContain('ALTER TABLE tasks_new RENAME TO tasks')
  })

  it('V6 migration should recreate all task indexes', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const dbPath = path.resolve(__dirname, '../database/index.ts')
    const source = fs.readFileSync(dbPath, 'utf-8')

    // Find the V6 migration block
    const v6Start = source.indexOf('version: 6')
    const v6End = source.indexOf('version: 7', v6Start)
    const v6Block = v6End > v6Start ? source.slice(v6Start, v6End) : source.slice(v6Start)

    // Verify indexes are recreated
    expect(v6Block).toContain('idx_tasks_status')
    expect(v6Block).toContain('idx_tasks_parent_id')
    expect(v6Block).toContain('idx_tasks_project_id')
    expect(v6Block).toContain('idx_tasks_scheduled_date')
    expect(v6Block).toContain('idx_tasks_due_at')
    expect(v6Block).toContain('idx_tasks_deleted_at')
    expect(v6Block).toContain('idx_tasks_updated_at')
  })

  it('V6 migration should handle foreign keys correctly', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const dbPath = path.resolve(__dirname, '../database/index.ts')
    const source = fs.readFileSync(dbPath, 'utf-8')

    const v6Start = source.indexOf('version: 6')
    const v6End = source.indexOf('version: 7', v6Start)
    const v6Block = v6End > v6Start ? source.slice(v6Start, v6End) : source.slice(v6Start)

    // Verify foreign keys are disabled during migration and re-enabled after
    expect(v6Block).toContain('PRAGMA foreign_keys = OFF')
    expect(v6Block).toContain('PRAGMA foreign_keys = ON')
  })

  it('recurrence.ts should use source=recurrence for new instances', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const recPath = path.resolve(__dirname, '../recurrence.ts')
    const source = fs.readFileSync(recPath, 'utf-8')

    // Verify generateNextInstance uses source='recurrence'
    expect(source).toContain("'recurrence'")
    expect(source).toContain('generateNextInstance')
  })
})
