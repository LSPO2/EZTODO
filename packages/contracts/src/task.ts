/**
 * Task related types and interfaces
 */

/** Task status */
export type TaskStatus = 'todo' | 'done' | 'cancelled';

/** Task priority */
export type TaskPriority = 'p1' | 'p2' | 'p3' | 'p4' | 'none';

/** Task source */
export type TaskSource = 'manual' | 'ai' | 'import' | 'api';

/** Base task interface */
export interface Task {
  /** UUID v7 */
  id: string;
  /** Parent task ID */
  parentId: string | null;
  /** Project ID */
  projectId: string | null;
  /** Task title */
  title: string;
  /** Task note/description */
  note: string | null;
  /** Task status */
  status: TaskStatus;
  /** Task priority */
  priority: TaskPriority;
  /** Sort order within parent/project */
  sortOrder: number;
  /** Scheduled date (YYYY-MM-DD) for all-day tasks */
  scheduledDate: string | null;
  /** Scheduled datetime (ISO 8601 UTC) */
  scheduledAt: string | null;
  /** Due datetime (ISO 8601 UTC) */
  dueAt: string | null;
  /** Whether this is an all-day task */
  isAllDay: boolean;
  /** Timezone (IANA format) */
  timezone: string;
  /** Estimated minutes to complete */
  estimatedMinutes: number | null;
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
  /** Completion timestamp */
  completedAt: string | null;
  /** Soft delete timestamp */
  deletedAt: string | null;
  /** Revision for sync */
  revision: number;
  /** Task source */
  source: TaskSource;
  /** AI capture ID if source is 'ai' */
  sourceCaptureId: string | null;
}

/** Task with subtasks */
export interface TaskWithChildren extends Task {
  children: TaskWithChildren[];
}

/** Create task request */
export interface CreateTaskRequest {
  title: string;
  parentId?: string;
  projectId?: string;
  note?: string;
  priority?: TaskPriority;
  scheduledDate?: string;
  scheduledAt?: string;
  dueAt?: string;
  isAllDay?: boolean;
  timezone?: string;
  estimatedMinutes?: number;
}

/** Update task request */
export interface UpdateTaskRequest {
  title?: string;
  parentId?: string;
  projectId?: string;
  note?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  sortOrder?: number;
  scheduledDate?: string;
  scheduledAt?: string;
  dueAt?: string;
  isAllDay?: boolean;
  timezone?: string;
  estimatedMinutes?: number;
}
