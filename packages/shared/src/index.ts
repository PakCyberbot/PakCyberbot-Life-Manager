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

// ---------------------------------------------------------------------------
// News & Updates
// ---------------------------------------------------------------------------

export type NewsCategoryType = 'custom' | 'global-politics' | 'country' | 'city';
export type AiProviderId = 'gemini' | 'openai' | 'anthropic';

export interface NewsCategory extends BaseRow {
  type: NewsCategoryType;
  name: string;
  /** Only meaningful for 'custom' — how the AI should judge relevance/write summaries. */
  prompt?: string | null;
  /** The country or city name — only meaningful for 'country'/'city'. */
  locationValue?: string | null;
  lastFetchedAt?: string | null;
}

export interface NewsItem extends BaseRow {
  categoryId: ID;
  title: string;
  summary?: string | null;
  url: string;
  source?: string | null;
  publishedAt?: string | null;
}

// ---------------------------------------------------------------------------
// Entertainment / Leisure
// ---------------------------------------------------------------------------

export type EntertainmentType = 'movie' | 'show' | 'anime' | 'game' | 'book' | 'other';
export type EntertainmentStatus = 'considering' | 'in-progress' | 'completed' | 'dropped';
export type EntertainmentVerdict = 'Worth It' | 'Mixed' | 'Skip';
export type AddictivenessLevel = 'low' | 'medium' | 'high';

export interface Entertainment extends BaseRow {
  title: string;
  type: EntertainmentType;
  status: EntertainmentStatus;
  /** Everything below is AI-generated shortly after creation — all nullable until it lands. */
  verdict?: EntertainmentVerdict | null;
  reasoning?: string | null;
  skillsImproved?: string | null;
  benefits?: string | null;
  timeCostEstimate?: string | null;
  addictiveness?: AddictivenessLevel | null;
  mentalEffects?: string | null;
  aiGeneratedAt?: string | null;
  aiProvider?: string | null;
  /** The user's own take — always available regardless of what the AI said. */
  notes?: string | null;
}

// ---------------------------------------------------------------------------
// Earning Ways
// ---------------------------------------------------------------------------

export type EarningWayCategory = 'freelance' | 'job' | 'business' | 'investment' | 'passive' | 'other';
export type EarningWayStatus = 'idea' | 'exploring' | 'active' | 'paused' | 'stopped';
export type EarningWaySource = 'user' | 'ai';

export interface EarningWay extends BaseRow {
  title: string;
  category: EarningWayCategory;
  status: EarningWayStatus;
  source: EarningWaySource;
  notes?: string | null;
  /** Generated on first detail-view open, cached until "Regenerate". Multi-item fields are newline-separated. */
  guideOverview?: string | null;
  guideSteps?: string | null;
  guideSkillsNeeded?: string | null;
  guideTools?: string | null;
  guideTimeline?: string | null;
  guideIncomePotential?: string | null;
  guidePitfalls?: string | null;
  guideResources?: string | null;
  guideGeneratedAt?: string | null;
  guideProvider?: string | null;
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

export interface JobSearch extends BaseRow {
  label: string;
  /** Comma-separated keywords, e.g. "penetration testing, security engineer". */
  keywords: string;
  /** How the AI should judge fit among matching listings. */
  prompt?: string | null;
  lastFetchedAt?: string | null;
}

export interface JobListing extends BaseRow {
  searchId: ID;
  title: string;
  company?: string | null;
  location?: string | null;
  url: string;
  source: string;
  tags?: string | null;
  aiNote?: string | null;
  postedAt?: string | null;
}

// ---------------------------------------------------------------------------
// File Manager (optional module — see structure.md)
// ---------------------------------------------------------------------------

export interface FileCategory extends BaseRow {
  name: string;
  /** null = top-level category. */
  parentId?: ID | null;
}

export interface FileLink extends BaseRow {
  categoryId: ID;
  label: string;
  path: string;
  isFolder: number; // 0 | 1
  /** Machine the path was added from — opening is only attempted when this matches the current machine. */
  hostname: string;
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

// ---------------------------------------------------------------------------
// Toggleable sections
// ---------------------------------------------------------------------------

/** Every module screen that can be individually shown/hidden from Settings.
 * Dashboard and Settings itself are deliberately excluded — always-on, since
 * disabling Settings would leave no way back in to re-enable anything. */
export const TOGGLEABLE_SECTIONS = [
  'goals',
  'calendar',
  'tasks',
  'money',
  'library',
  'news',
  'entertainment',
  'earningWays',
  'jobs',
  'fileManager',
] as const;

export type ToggleableSectionId = (typeof TOGGLEABLE_SECTIONS)[number];
