/**
 * AI related types and interfaces
 */

/** AI confidence level */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

/** AI parse status */
export type ParseStatus = 'pending' | 'processing' | 'completed' | 'failed';

/** AI capture interface */
export interface AICapture {
  /** UUID v7 */
  id: string;
  /** Original input text */
  originalText: string;
  /** Parse status */
  status: ParseStatus;
  /** Confidence level */
  confidence: ConfidenceLevel | null;
  /** Parsed tasks */
  parsedTasks: ParsedTask[] | null;
  /** Warnings */
  warnings: string[] | null;
  /** Error message if failed */
  error: string | null;
  /** Creation timestamp */
  createdAt: string;
  /** Completion timestamp */
  completedAt: string | null;
}

/** Parsed task from AI */
export interface ParsedTask {
  /** Task title */
  title: string;
  /** Task note */
  note: string | null;
  /** Scheduled date */
  scheduledDate: string | null;
  /** Scheduled time */
  scheduledAt: string | null;
  /** Due time */
  dueAt: string | null;
  /** Is all day */
  isAllDay: boolean;
  /** Priority */
  priority: string | null;
  /** Project suggestion */
  project: string | null;
  /** Tags */
  tags: string[] | null;
  /** Subtasks */
  subtasks: ParsedTask[] | null;
  /** Recurrence rule */
  recurrence: string | null;
  /** Reminders */
  reminders: string[] | null;
  /** Estimated minutes */
  estimatedMinutes: number | null;
  /** Confidence for this specific task */
  confidence: ConfidenceLevel;
  /** Uncertain fields */
  uncertainFields: string[] | null;
}

/** AI parse request */
export interface AIParseRequest {
  /** User input text */
  text: string;
  /** Current time (ISO 8601) */
  currentTime: string;
  /** Timezone (IANA) */
  timezone: string;
  /** User default settings */
  defaults?: {
    priority?: string;
    project?: string;
    tags?: string[];
  };
}

/** AI parse response */
export interface AIParseResponse {
  /** Capture ID */
  captureId: string;
  /** Parse status */
  status: ParseStatus;
  /** Confidence level */
  confidence: ConfidenceLevel | null;
  /** Parsed tasks */
  tasks: ParsedTask[] | null;
  /** Warnings */
  warnings: string[] | null;
  /** Error message if failed */
  error: string | null;
}
