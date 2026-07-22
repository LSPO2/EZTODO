/**
 * Database initialization and migration module
 */

import Database from '@tauri-apps/plugin-sql';

let db: Database | null = null;

/**
 * Get database instance (singleton)
 */
export async function getDatabase(): Promise<Database> {
  if (!db) {
    db = await Database.load('sqlite:eztodo.db');
    await initializeDatabase(db);
  }
  return db;
}

/**
 * Initialize database with PRAGMA settings
 */
async function initializeDatabase(database: Database): Promise<void> {
  // Enable foreign keys
  await database.execute('PRAGMA foreign_keys = ON');

  // Enable WAL mode for better performance
  await database.execute('PRAGMA journal_mode = WAL')

  // Set busy timeout
  await database.execute('PRAGMA busy_timeout = 5000')

  // Run migrations
  await runMigrations(database)
}

/**
 * Run database migrations
 */
async function runMigrations(database: Database): Promise<void> {
  // Create schema_version table if not exists
  await database.execute(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now')),
      description TEXT
    )
  `)

  // Get current version
  const result = await database.select<{ version: number }[]>(
    'SELECT MAX(version) as version FROM schema_version'
  )
  const currentVersion = result[0]?.version || 0

  // Run pending migrations
  const migrations = getMigrations()
  for (const migration of migrations) {
    if (migration.version > currentVersion) {
      console.log(`Running migration ${migration.version}: ${migration.description}`)

      // Execute migration in transaction
      await database.execute('BEGIN TRANSACTION')
      try {
        for (const sql of migration.statements) {
          await database.execute(sql)
        }
        await database.execute(
          'INSERT INTO schema_version (version, description) VALUES ($1, $2)',
          [migration.version, migration.description]
        )
        await database.execute('COMMIT')
        console.log(`Migration ${migration.version} completed`)
      } catch (error) {
        await database.execute('ROLLBACK')
        console.error(`Migration ${migration.version} failed:`, error)
        throw error
      }
    }
  }
}

/**
 * Get all migrations in order
 */
function getMigrations(): Migration[] {
  return [
    {
      version: 1,
      description: 'Create core tables',
      statements: [
        // Projects table
        `CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          color TEXT,
          icon TEXT,
          sort_order INTEGER DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT
        )`,

        // Tasks table
        `CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          parent_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
          project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
          title TEXT NOT NULL,
          note TEXT,
          status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'done', 'cancelled')),
          priority TEXT DEFAULT 'none' CHECK (priority IN ('p1', 'p2', 'p3', 'p4', 'none')),
          sort_order INTEGER DEFAULT 0,
          scheduled_date TEXT,
          scheduled_at TEXT,
          due_at TEXT,
          is_all_day INTEGER DEFAULT 0,
          timezone TEXT DEFAULT 'Asia/Shanghai',
          estimated_minutes INTEGER,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          completed_at TEXT,
          deleted_at TEXT,
          revision INTEGER DEFAULT 1,
          source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'ai', 'import', 'api')),
          source_capture_id TEXT
        )`,

        // Tags table
        `CREATE TABLE IF NOT EXISTS tags (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          color TEXT,
          created_at TEXT NOT NULL
        )`,

        // Task tags junction table
        `CREATE TABLE IF NOT EXISTS task_tags (
          task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
          tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
          PRIMARY KEY (task_id, tag_id)
        )`,

        // Reminders table
        `CREATE TABLE IF NOT EXISTS reminders (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
          remind_at TEXT NOT NULL,
          status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'triggered', 'confirmed', 'snoozed', 'cancelled')),
          snoozed_until TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )`,

        // Recurrence rules table
        `CREATE TABLE IF NOT EXISTS recurrence_rules (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
          frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly', 'custom')),
          interval INTEGER DEFAULT 1,
          days_of_week TEXT,
          day_of_month INTEGER,
          month_of_year INTEGER,
          start_date TEXT NOT NULL,
          end_date TEXT,
          max_occurrences INTEGER,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )`,

        // Task events table
        `CREATE TABLE IF NOT EXISTS task_events (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          event_type TEXT NOT NULL CHECK (event_type IN ('created', 'updated', 'completed', 'deleted')),
          changes TEXT,
          created_at TEXT NOT NULL
        )`,
      ],
    },
    {
      version: 2,
      description: 'Create sync tables',
      statements: [
        // Sync outbox table
        `CREATE TABLE IF NOT EXISTS sync_outbox (
          id TEXT PRIMARY KEY,
          operation_id TEXT NOT NULL UNIQUE,
          entity_type TEXT NOT NULL CHECK (entity_type IN ('task', 'reminder', 'recurrence_rule', 'project', 'tag')),
          entity_id TEXT NOT NULL,
          operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
          payload TEXT NOT NULL,
          base_revision INTEGER,
          created_at TEXT NOT NULL,
          synced_at TEXT
        )`,

        // Sync state table
        `CREATE TABLE IF NOT EXISTS sync_state (
          id TEXT PRIMARY KEY,
          device_id TEXT NOT NULL,
          last_cursor TEXT,
          last_sync_at TEXT,
          server_version INTEGER DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )`,
      ],
    },
    {
      version: 3,
      description: 'Create settings and AI tables',
      statements: [
        // Settings table
        `CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )`,

        // AI captures table
        `CREATE TABLE IF NOT EXISTS ai_captures (
          id TEXT PRIMARY KEY,
          original_text TEXT NOT NULL,
          status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
          confidence TEXT CHECK (confidence IN ('high', 'medium', 'low')),
          parsed_tasks TEXT,
          warnings TEXT,
          error TEXT,
          created_at TEXT NOT NULL,
          completed_at TEXT
        )`,

        // Import jobs table (P1)
        `CREATE TABLE IF NOT EXISTS import_jobs (
          id TEXT PRIMARY KEY,
          file_name TEXT NOT NULL,
          file_type TEXT NOT NULL CHECK (file_type IN ('csv', 'json')),
          status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
          total_count INTEGER,
          success_count INTEGER,
          error_count INTEGER,
          errors TEXT,
          created_at TEXT NOT NULL,
          completed_at TEXT
        )`,
      ],
    },
    {
      version: 4,
      description: 'Create indexes',
      statements: [
        // Task indexes
        `CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status) WHERE deleted_at IS NULL`,
        `CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON tasks(parent_id) WHERE deleted_at IS NULL`,
        `CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id) WHERE deleted_at IS NULL`,
        `CREATE INDEX IF NOT EXISTS idx_tasks_scheduled_date ON tasks(scheduled_date) WHERE deleted_at IS NULL`,
        `CREATE INDEX IF NOT EXISTS idx_tasks_due_at ON tasks(due_at) WHERE deleted_at IS NULL`,
        `CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON tasks(deleted_at) WHERE deleted_at IS NOT NULL`,
        `CREATE INDEX IF NOT EXISTS idx_tasks_updated_at ON tasks(updated_at)`,

        // Reminder indexes
        `CREATE INDEX IF NOT EXISTS idx_reminders_task_id ON reminders(task_id)`,
        `CREATE INDEX IF NOT EXISTS idx_reminders_remind_at ON reminders(remind_at) WHERE status = 'pending'`,

        // Sync outbox index
        `CREATE INDEX IF NOT EXISTS idx_sync_outbox_synced ON sync_outbox(synced_at) WHERE synced_at IS NULL`,

        // Task events index
        `CREATE INDEX IF NOT EXISTS idx_task_events_task_id ON task_events(task_id)`,
      ],
    },
  ]
}

/**
 * Close database connection
 */
export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.close()
    db = null
  }
}

/**
 * Migration type definition
 */
interface Migration {
  version: number
  description: string
  statements: string[]
}
