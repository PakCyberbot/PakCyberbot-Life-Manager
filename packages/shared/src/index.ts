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
  /** data: URI — auto-fetched from Wikipedia by title on creation, or manually uploaded; null if
   * removed/unavailable. See structure.md's Goals section. */
  imageUrl?: string | null;
}

export interface Milestone extends BaseRow {
  goalId: ID;
  title: string;
  dueDate?: string | null;
  completed: number; // 0 | 1 (SQLite has no boolean type)
}

// ---------------------------------------------------------------------------
// Tasks — live inside a Goal, not a standalone module (see structure.md).
// ---------------------------------------------------------------------------

export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskStatus = 'todo' | 'in-progress' | 'done';
/** What a task's optional single link points at: a local path, or a Library item. */
export type TaskLinkType = 'file' | 'folder' | 'book' | 'video' | 'url';

export interface Task extends BaseRow {
  title: string;
  notes?: string | null;
  dueDate?: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  /** Optional — a task with no goal is a "quick task" (see GoalsScreen's Quick Tasks section),
   * assignable into a goal (and optionally one of its milestones) at any point later. */
  linkedGoalId?: ID | null;
  /** Nests this task under one specific milestone of linkedGoalId (rather than the goal directly).
   * Only meaningful when linkedGoalId is also set. Milestone-linked tasks contribute to that goal's
   * auto-computed progress alongside its milestones — see useMilestonesStore's syncGoalProgress. */
  linkedMilestoneId?: ID | null;
  linkType?: TaskLinkType | null;
  /** For linkType 'file'/'folder': the local path. */
  linkPath?: string | null;
  /** For linkType 'file'/'folder': the machine it was added from — same hostname-gating as File Manager. */
  linkHostname?: string | null;
  /** For linkType 'book'/'video': the linked Book/Video's id — jump to it in Library. */
  linkTargetId?: ID | null;
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

/** An event is "archived" the instant it's in the past — computed fresh from startAt/endAt every
 * time this is called, never stored as a flag. A stored flag would need something to flip it (a
 * background job, a check on every boot) and could drift out of sync; a computed check is always
 * correct with zero upkeep. Shared by both apps' Calendar screens so "what counts as past" can
 * never quietly diverge between them. */
export function isPastEvent(e: CalendarEvent, now: Date): boolean {
  return new Date(e.endAt ?? e.startAt).getTime() < now.getTime();
}

/** "Today"/"Tomorrow"/"Yesterday" read far more naturally in a dated list than a bare date,
 * falling back to the weekday name within the next week and a plain formatted date beyond that.
 * Both dates are first reduced to local day-keys (never raw instants) before diffing, so this
 * can't be thrown off by time-of-day — only the calendar day itself matters here. Shared by both
 * apps' Calendar screens for the Upcoming/Archived event lists. */
export function relativeDayLabel(iso: string, now: Date): string {
  const eventKey = toLocalDateKey(new Date(iso));
  const todayKey = toLocalDateKey(now);
  const diffDays = Math.round((new Date(eventKey).getTime() - new Date(todayKey).getTime()) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays > 1 && diffDays < 7) return new Date(iso).toLocaleDateString(undefined, { weekday: 'long' });
  return formatDate(iso);
}

// ---------------------------------------------------------------------------
// Money — a personal savings total + a wishlist, not full bookkeeping.
// (Account/Transaction/Budget below are the original accounts/transactions/
// budgets model — kept as dormant types/tables, no longer surfaced in the
// UI. See structure.md's Money section for why.)
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

export type SavingsEntryType = 'add' | 'expense';

export interface SavingsEntry extends BaseRow {
  amount: number; // always positive; `type` determines sign
  type: SavingsEntryType;
  note?: string | null;
  date: string; // ISO date
}

export type WishlistCategory = 'purchase' | 'trip' | 'subscription' | 'investment' | 'other';
export type WishlistStatus = 'planned' | 'done' | 'cancelled';

export interface WishlistItem extends BaseRow {
  title: string;
  category: WishlistCategory;
  estimatedCost?: number | null;
  notes?: string | null;
  status: WishlistStatus;
  /** The SavingsEntry created when this item was marked 'done', so undoing removes exactly that
   * transaction. Null until purchased, cleared again when un-done. */
  purchaseEntryId?: ID | null;
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
  /** Set automatically to a goal's title when a Task links this book — see structure.md's Goals/Tasks section. */
  category?: string | null;
  /** 1 once the desktop user has turned on "Sync to mobile" for this book — the PDF's bytes were
   * uploaded to a Books/ subfolder in the same Drive folder the database syncs through. Turning it
   * back off only stops tracking (leaves driveFileId set); it never deletes the Drive copy. */
  syncedToDrive?: number;
  /** The Drive file id of this book's uploaded PDF, once synced — lets mobile download its own
   * local copy via Drive's alt=media endpoint. Null until the first successful sync. */
  driveFileId?: string | null;
}

export interface Quote extends BaseRow {
  text: string;
  author?: string | null;
}

/** Library — saved article/web-page links, distinct from Books/Videos: just a URL worth exploring
 * later, with a preview image/favicon fetched once at add time (same fetch-and-inline convention
 * as everything else's thumbnails — see structure.md's Library section). */
export type WebLinkStatus = 'to-explore' | 'explored';

/** A quick personal read-time estimate the user picks (or is asked to pick on a mobile share) —
 * not measured, just "do I need 5 minutes or a real sitting for this". Column defaults to 'short'
 * at the database level (see schema.ts/ensureColumn), so every web link that existed before this
 * field was added reads as 'short' automatically — never an unset/undefined state to handle. */
export type WebLinkReadLength = 'short' | 'long';

export interface WebLink extends BaseRow {
  title: string;
  url: string;
  /** data: URI of the fetched og:image (or similar), or null if unavailable. */
  previewImage?: string | null;
  /** data: URI of the fetched favicon, or null if unavailable. */
  favicon?: string | null;
  notes?: string | null;
  status: WebLinkStatus;
  readLength: WebLinkReadLength;
}

// ---------------------------------------------------------------------------
// News & Updates
// ---------------------------------------------------------------------------

/** 'blog' is a live-preview site (no RSS/AI digest) — see structure.md's News section. */
export type NewsCategoryType = 'custom' | 'global-politics' | 'country' | 'city' | 'blog';
export type AiProviderId = 'gemini' | 'openai' | 'anthropic';

export interface NewsCategory extends BaseRow {
  type: NewsCategoryType;
  name: string;
  /** Only meaningful for 'custom' — how the AI should judge relevance/write summaries. */
  prompt?: string | null;
  /** The country or city name — only meaningful for 'country'/'city'. */
  locationValue?: string | null;
  /** The blog/site's address — only meaningful for 'blog'. */
  url?: string | null;
  /** data: URI of the fetched og:image, or null if unavailable — only meaningful for 'blog'. */
  previewImage?: string | null;
  /** data: URI of the fetched favicon, or null if unavailable — only meaningful for 'blog'. */
  previewFavicon?: string | null;
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
  /** data: URI of a user-supplied poster/thumbnail image, fetched and inlined once at add time. */
  thumbnail?: string | null;
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
  /** Set automatically to a goal's title when a Task links this video — see structure.md's Goals/Tasks section. */
  category?: string | null;
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

/** "YYYY-MM-DD" from a Date's own *local* calendar day — never use `toISOString().slice(0,10)`
 * for this, which converts to UTC first and silently shifts the date by a day for any non-UTC
 * timezone. Confirmed as the real cause of a family of Calendar bugs: the wrong day highlighted
 * as "today", a newly-added timed event saving under the day *before* the one actually clicked,
 * and an event's displayed time showing its UTC hour instead of its local one — see CLAUDE.md's
 * Calendar section. Use this (or a real Date's own local getters) anywhere "what calendar day is
 * this instant on, for the viewer" is the actual question. */
export function toLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ---------------------------------------------------------------------------
// Time Table — a recurring weekly routine, distinct from Calendar's
// date-specific events (see structure.md)
// ---------------------------------------------------------------------------

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

export interface DaySchedule extends BaseRow {
  /** 0 = Sunday .. 6 = Saturday. */
  dayOfWeek: number;
  wakeTime: string; // 'HH:MM'
  sleepTime: string; // 'HH:MM'
}

export interface TimeSlot extends BaseRow {
  dayOfWeek: number;
  startTime: string; // 'HH:MM'
  endTime: string; // 'HH:MM'
  label: string;
  notes?: string | null;
  color: string;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** Minutes from `start` to `end`, wrapping past midnight if `end` is numerically earlier (e.g. sleeping at 01:00). */
export function minutesBetween(start: string, end: string): number {
  const startMin = toMinutes(start);
  let endMin = toMinutes(end);
  if (endMin <= startMin) endMin += 24 * 60;
  return endMin - startMin;
}

export function formatMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

// ---------------------------------------------------------------------------
// Health — Exercise Schedule, Doctor Appointments, Food & Nutrition, Body Metrics
// ---------------------------------------------------------------------------

export type ExerciseCategory = 'strength' | 'cardio' | 'flexibility' | 'other';

export interface Exercise extends BaseRow {
  name: string;
  category: ExerciseCategory;
  /** Comma-separated day-of-week numbers, e.g. "1,3,5" — repeats weekly, like Time Table. */
  daysOfWeek: string;
  durationMinutes?: number | null;
  sets?: number | null;
  reps?: number | null;
  notes?: string | null;
  /** Optional reference video (e.g. a YouTube demo) to look up proper form — never required. */
  videoUrl?: string | null;
  /** data: URI of the fetched thumbnail, or null if unavailable/not a video with one. */
  videoThumbnail?: string | null;
}

export interface DoctorAppointment extends BaseRow {
  doctorName: string;
  specialty?: string | null;
  appointmentAt: string; // ISO datetime
  reason?: string | null;
  notes?: string | null;
}

export interface Food extends BaseRow {
  name: string;
  quantity: string;
  price?: number | null;
  /** Everything below is AI-generated shortly after creation, same async pattern as Entertainment. */
  benefits?: string | null;
  caloriesEstimate?: string | null;
  considerations?: string | null;
  aiGeneratedAt?: string | null;
  aiProvider?: string | null;
}

export interface BodyMetric extends BaseRow {
  date: string; // ISO date
  weight: number;
  unit: string; // 'kg' | 'lb', free text so either works
  notes?: string | null;
}

// ---------------------------------------------------------------------------
// Toggleable sections
// ---------------------------------------------------------------------------

/** Every module screen that can be individually shown/hidden from Settings.
 * Dashboard and Settings itself are deliberately excluded — always-on, since
 * disabling Settings would leave no way back in to re-enable anything.
 * 'tasks' isn't listed — tasks live inside Goals now, not a standalone screen. */
export const TOGGLEABLE_SECTIONS = [
  'goals',
  'calendar',
  'timeTable',
  'money',
  'library',
  'news',
  'entertainment',
  'earningWays',
  'jobs',
  'fileManager',
  'health',
] as const;

export type ToggleableSectionId = (typeof TOGGLEABLE_SECTIONS)[number];
