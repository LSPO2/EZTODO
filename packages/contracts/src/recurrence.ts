/**
 * Recurrence rule related types and interfaces
 */

/** Recurrence frequency */
export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

/** Recurrence rule interface */
export interface RecurrenceRule {
  /** UUID v7 */
  id: string;
  /** Task ID */
  taskId: string;
  /** Recurrence frequency */
  frequency: RecurrenceFrequency;
  /** Interval (e.g., every 2 days) */
  interval: number;
  /** Days of week for weekly recurrence (0=Sunday, 6=Saturday) */
  daysOfWeek: number[] | null;
  /** Day of month for monthly recurrence */
  dayOfMonth: number | null;
  /** Month of year for yearly recurrence */
  monthOfYear: number | null;
  /** Start date */
  startDate: string;
  /** End date (null for infinite) */
  endDate: string | null;
  /** Maximum occurrences (null for infinite) */
  maxOccurrences: number | null;
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
}

/** Create recurrence rule request */
export interface CreateRecurrenceRuleRequest {
  taskId: string;
  frequency: RecurrenceFrequency;
  interval?: number;
  daysOfWeek?: number[];
  dayOfMonth?: number;
  monthOfYear?: number;
  startDate: string;
  endDate?: string;
  maxOccurrences?: number;
}

/** Update recurrence rule request */
export interface UpdateRecurrenceRuleRequest {
  frequency?: RecurrenceFrequency;
  interval?: number;
  daysOfWeek?: number[];
  dayOfMonth?: number;
  monthOfYear?: number;
  startDate?: string;
  endDate?: string;
  maxOccurrences?: number;
}
