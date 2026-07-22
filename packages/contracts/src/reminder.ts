/**
 * Reminder related types and interfaces
 */

/** Reminder status */
export type ReminderStatus = 'pending' | 'triggered' | 'confirmed' | 'snoozed' | 'cancelled';

/** Snooze duration */
export type SnoozeDuration = '10m' | '1h' | 'tomorrow';

/** Reminder interface */
export interface Reminder {
  /** UUID v7 */
  id: string;
  /** Task ID */
  taskId: string;
  /** Reminder datetime (ISO 8601 UTC) */
  remindAt: string;
  /** Reminder status */
  status: ReminderStatus;
  /** Snooze until (ISO 8601 UTC) */
  snoozedUntil: string | null;
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
}

/** Create reminder request */
export interface CreateReminderRequest {
  taskId: string;
  remindAt: string;
}

/** Update reminder request */
export interface UpdateReminderRequest {
  remindAt?: string;
  status?: ReminderStatus;
  snoozedUntil?: string;
}

/** Snooze reminder request */
export interface SnoozeReminderRequest {
  duration: SnoozeDuration;
}
