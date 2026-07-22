/**
 * Sync related types and interfaces
 */

/** Sync operation type */
export type SyncOperationType = 'create' | 'update' | 'delete';

/** Sync entity type */
export type SyncEntityType = 'task' | 'reminder' | 'recurrence_rule' | 'project' | 'tag';

/** Sync status */
export type SyncStatus = 'pending' | 'synced' | 'conflict';

/** Sync operation interface */
export interface SyncOperation {
  /** UUID v7 */
  id: string;
  /** Operation type */
  type: SyncOperationType;
  /** Entity type */
  entityType: SyncEntityType;
  /** Entity ID */
  entityId: string;
  /** Local base revision */
  baseRevision: number;
  /** Operation payload */
  payload: Record<string, unknown>;
  /** Creation timestamp */
  createdAt: string;
  /** Sync status */
  status: SyncStatus;
}

/** Sync state interface */
export interface SyncState {
  /** Device ID */
  deviceId: string;
  /** Last sync cursor */
  lastCursor: string | null;
  /** Last sync timestamp */
  lastSyncAt: string | null;
  /** Server version */
  serverVersion: number;
}

/** Sync pull request */
export interface SyncPullRequest {
  /** Last cursor */
  cursor: string | null;
  /** Limit */
  limit?: number;
}

/** Sync pull response */
export interface SyncPullResponse {
  /** Operations */
  operations: SyncOperation[];
  /** Next cursor */
  nextCursor: string | null;
  /** Has more */
  hasMore: boolean;
}

/** Sync push request */
export interface SyncPushRequest {
  /** Operations to push */
  operations: SyncOperation[];
}

/** Sync push response */
export interface SyncPushResponse {
  /** Accepted operations */
  accepted: string[];
  /** Rejected operations with reasons */
  rejected: Array<{
    id: string;
    reason: string;
  }>;
  /** New server version */
  serverVersion: number;
}
