# P0-1 Acceptance Evidence

> Updated: 2026-07-23
> Status: implementation and static verification complete; Tauri runtime verification remains required.

## Data-access boundary

Application, import/export, backup, trash, recurrence, reminder, sync, and database utility modules no longer import `getDatabase()` directly.

- Domain CRUD uses `Repositories` from `lib/repositories`.
- Legacy SQL-shaped operational functions use `SqlRepository` from `lib/repositories/sql-repository.ts`.
- `SqlRepository` is a repository-layer compatibility adapter; it owns the concrete database singleton boundary while the affected modules retain their existing public APIs.
- Browser mode uses `BrowserRepository`; Tauri mode creates `SQLiteRepository`. Tauri initialization failures are surfaced by the application error page and do not fall back to browser storage.

## Migration

`local-storage-migration.ts` now:

1. parses storage as `unknown` and validates entity records;
2. migrates projects, tags, tasks, settings, and task-tag links through repository interfaces;
3. maps legacy project/task IDs so task parent relationships are preserved;
4. reports structured errors (`entity`, `legacyId`, `field`, `reason`);
5. leaves legacy storage intact on every failure;
6. writes the version marker only when migration has zero errors.

An empty legacy store is a successful no-op. Browser mode sees existing legacy IDs through `BrowserRepository`; SQLite mode inserts missing records.

## Verification

- Repository/browser tests: passed.
- Migration tests: 11 tests, including a fake empty target Repository that asserts project/task writes and parent mapping.
- Frontend suite: 62 tests.
- Required final gates are recorded only after their actual execution.

## Remaining runtime verification

- Run the Tauri application on a clean profile and a profile containing legacy `eztodo_db` data.
- Confirm SQLite initialization, migration persistence after restart, and the visible retry screen on initialization failure.