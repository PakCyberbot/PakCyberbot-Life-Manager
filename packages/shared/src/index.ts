// Shared types + tiny utils used by every package/app in the monorepo.
// Kept dependency-free on purpose so it can be imported from main process,
// renderer, and (later) mobile/web without pulling in platform-specific code.

export type ID = string;

/** Every row in the database carries these three fields (see structure.md §8). */
export interface BaseRow {
  id: ID;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

export type GoalType = 'short-term' | 'long-term' | 'okr';
export type GoalStatus = 'active' | 'completed' | 'paused' | 'abandoned';

export interface Goal extends BaseRow {
  title: string;
  description?: string | null;
  category?: string | null;
  type: GoalType;
  targetDate?: string | null;
  status: GoalStatus;
  progressPct: number;
}

export interface Milestone extends BaseRow {
  goalId: ID;
  title: string;
  dueDate?: string | null;
  completed: number; // 0 | 1 (SQLite has no boolean type)
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskStatus = 'todo' | 'in-progress' | 'done';

export interface Task extends BaseRow {
  title: string;
  notes?: string | null;
  dueDate?: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  linkedGoalId?: ID | null;
}

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

export interface CalendarEvent extends BaseRow {
  title: string;
  description?: string | null;
  startAt: string; // ISO date or date-time
  endAt?: string | null;
  allDay: number; // 0 | 1
  color: string;
  linkedGoalId?: ID | null;
  linkedTaskId?: ID | null;
}

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

export type AccountType = 'cash' | 'bank' | 'credit' | 'investment';

export interface Account extends BaseRow {
  name: string;
  type: AccountType;
  currency: string;
  startingBalance: number;
}

export type TransactionType = 'income' | 'expense' | 'transfer';

export interface Transaction extends BaseRow {
  accountId: ID;
  amount: number; // always positive; `type` determines sign
  type: TransactionType;
  category?: string | null;
  date: string; // ISO date
  note?: string | null;
}

export interface Budget extends BaseRow {
  category: string;
  monthlyLimit: number;
}

// ---------------------------------------------------------------------------
// Library (Books & Videos)
// ---------------------------------------------------------------------------

export type BookStatus = 'to-read' | 'reading' | 'finished';

export interface Book extends BaseRow {
  title: string;
  filePath?: string | null;
  /** Machine the filePath was added from — see structure.md's Library section. */
  hostname?: string | null;
  /** data: URI of the rendered first page, or null if not yet rendered. */
  coverImage?: string | null;
  bookmarkPage: number;
  status: BookStatus;
  notes?: string | null;
}

export interface Quote extends BaseRow {
  text: string;
  author?: string | null;
}

export type VideoStatus = 'to-watch' | 'watching' | 'watched';
export type VideoKind = 'video' | 'playlist';

export interface Video extends BaseRow {
  title: string;
  url: string;
  kind: VideoKind;
  /** data: URI of the fetched thumbnail, or null if unavailable. */
  thumbnail?: string | null;
  status: VideoStatus;
  notes?: string | null;
}

// ---------------------------------------------------------------------------
// Utils
// ---------------------------------------------------------------------------

export function newId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function formatDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function isSameMonth(iso: string, reference: Date): boolean {
  const d = new Date(iso);
  return d.getFullYear() === reference.getFullYear() && d.getMonth() === reference.getMonth();
}

export function startOfMonth(reference: Date): Date {
  return new Date(reference.getFullYear(), reference.getMonth(), 1);
}
