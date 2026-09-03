// The renderer-side seam: a thin, generic CRUD shape that the Electron preload
// script exposes on `window.api`. Stores below only ever talk to this shape,
// never to Electron/IPC directly — that's what keeps this package platform-agnostic
// and reusable once a mobile/web shell exists (they'd just implement the same shape
// differently, e.g. calling into @capacitor-community/sqlite instead of IPC).

export interface DbApi {
  list<T>(table: string, where?: Record<string, unknown>): Promise<T[]>;
  get<T>(table: string, id: string): Promise<T | null>;
  create<T>(table: string, row: T): Promise<T>;
  update(table: string, id: string, patch: Record<string, unknown>): Promise<void>;
  /** Soft delete: sets deletedAt, row stays in the DB (recoverable in principle, used everywhere by default). */
  remove(table: string, id: string): Promise<void>;
  /** Genuinely deletes the row — used where nothing should linger after an explicit delete (e.g. Library books/videos,
   * which can carry a sizable data: URI cover/thumbnail). */
  hardRemove(table: string, id: string): Promise<void>;
}

/** Simple key-value app settings (reader path, etc.) — see structure.md. */
export interface SettingsApi {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export interface DetectedReader {
  type: 'adobe' | 'foxit';
  path: string;
}

export interface OpenBookResult {
  ok: boolean;
  error?: string;
}

export interface BookmarkUpdate {
  id: string;
  page: number;
}

/** Main-process only capabilities: filesystem, native dialogs, launching external apps. */
export interface SystemApi {
  hostname(): Promise<string>;
  /** Reads a file as base64, or null if it doesn't exist on this machine. */
  readFileAsBase64(path: string): Promise<string | null>;
  /** Best-effort scan of common install locations for Adobe/Foxit. */
  detectPdfReader(): Promise<DetectedReader | null>;
  /**
   * Opens the PDF in an in-app viewer window (Chromium's built-in PDF
   * renderer). Tracks the page the user scrolls to and, on close, writes it
   * back as the book's bookmark automatically — an `onBookmarkUpdate` event
   * follows so the UI reflects it without a manual refetch.
   */
  openBookInApp(input: { id: string; filePath: string; page: number }): Promise<OpenBookResult>;
  /**
   * Opens the PDF in the configured external reader (or the OS default).
   * Jumps to `page` where the reader supports it, but bookmark tracking is
   * NOT automatic here — there's no way to observe another process's state.
   */
  openBookExternally(input: { filePath: string; page: number; readerPath?: string | null }): Promise<OpenBookResult>;
  /** Opens a URL in the system's default browser. */
  openExternal(url: string): Promise<void>;
  /**
   * Opens a real, scrollable, live page in a dedicated app-controlled window —
   * a genuine top-level navigation, not an embedded iframe (this app's CSP
   * has no frame-src, and most real sites set X-Frame-Options anyway, so
   * neither embedding approach works). Used by News & Updates' "Blogs &
   * Websites" live preview.
   */
  openWebsite(url: string, title?: string | null): Promise<{ ok: boolean; error?: string }>;
  /** Fires whenever an in-app PDF viewer window closes and updates a bookmark. Returns an unsubscribe function. */
  onBookmarkUpdate(callback: (update: BookmarkUpdate) => void): () => void;
  /** Opens a folder in the OS file browser, or a file with its default app. Only ever call this after confirming the path's hostname matches the current one. */
  openLocalPath(path: string): Promise<{ ok: boolean; error?: string }>;
}

export interface PickedFileOrFolder {
  path: string;
  isFolder: boolean;
}

export interface DialogApi {
  pickPdf(): Promise<string | null>;
  pickExecutable(): Promise<string | null>;
  /** `kind` picks a single-purpose native dialog — required because Windows/Linux can't combine
   * openFile+openDirectory into one picker (it silently collapses to directory-only if you try). */
  pickFileOrFolder(kind: 'file' | 'folder'): Promise<PickedFileOrFolder | null>;
}

export interface YouTubeMeta {
  title: string | null;
  /** data: URI, already fetched and inlined so nothing needs a live network call to render. */
  thumbnail: string | null;
}

/** Network calls that must happen in the main process (renderer CSP has no external connect-src). */
export interface MediaApi {
  fetchYouTubeThumbnail(url: string): Promise<YouTubeMeta | null>;
  /** Fetches any image URL and inlines it as a data: URI — always a URL the user pasted themselves, never AI-supplied. */
  fetchImageAsDataUri(url: string): Promise<string | null>;
  /** Looks up a real poster/cover image from Wikipedia's own free API by title (+ type hint) — a real search, never an AI-guessed URL. */
  fetchWikipediaThumbnail(title: string, type: string): Promise<string | null>;
  /** Fetches a page's own og:title/og:image/favicon directly from its HTML — used by Library's Web Links tab
   * and News & Updates' Blogs & Websites, never an AI-guessed preview. */
  fetchWebPreview(url: string): Promise<{ title: string | null; image: string | null; favicon: string | null } | null>;
}

export interface DriveSyncResult {
  ok: boolean;
  error?: string;
}

export interface DrivePullIfNewerResult extends DriveSyncResult {
  /** True when the remote copy wasn't newer than what was last pushed/pulled (or nothing has ever
   * been pushed at all) and no download happened — vs. a real pull, which overwrites local data
   * and reloads the app. */
  skipped?: boolean;
}

export interface DriveConnectResult extends DriveSyncResult {
  email?: string;
}

export interface DriveStatus {
  connected: boolean;
  email: string | null;
  lastPushedAt: string | null;
  lastPulledAt: string | null;
}

/** Google Drive push/pull — see structure.md §9. Requires a Google Client ID/Secret in Settings. */
export interface DriveApi {
  status(): Promise<DriveStatus>;
  connect(): Promise<DriveConnectResult>;
  disconnect(): Promise<void>;
  push(): Promise<DriveSyncResult>;
  /** On success, the app relaunches itself to load the pulled data cleanly. */
  pull(): Promise<DriveSyncResult>;
  /** Auto Sync only: fires when a pull attempted at startup (gated behind the autoSyncEnabled
   * setting) fails to reach Drive — a transient 5s toast, not a blocking error, since the app
   * still boots normally either way. Never fires for a manual Pull (that surfaces its own error
   * inline in the Drive Sync card) or when auto-sync skipped the pull because nothing was newer. */
  onAutoSyncFailed(callback: (message: string) => void): () => void;
  /** Auto Sync's pull-on-startup check: downloads only if Drive's copy is strictly newer than
   * what this device last pushed/pulled (never relaunches/reloads unconditionally on every
   * startup the way a plain pull() would). Desktop runs this main-process-side before any
   * renderer exists and never calls it from here (undefined on desktop's DriveApi); mobile has no
   * separate main process, so its App.tsx calls this directly at startup instead. */
  pullIfNewer?(): Promise<DrivePullIfNewerResult>;
  /** Desktop only: per-book "Sync to mobile" — uploads a PDF's already-base64-encoded bytes into
   * a Books/ subfolder inside the main Drive folder, returning the Drive file id to store on the
   * book row. Undefined on mobile (nothing there ever uploads a book, only downloads one). */
  uploadBookFile?(base64: string, filename: string): Promise<DriveSyncResult & { fileId?: string }>;
  /** Mobile only: downloads a synced book's PDF bytes (by its Drive file id) into this device's
   * own app-private storage, returning the local file path Library then treats like any other
   * locally-added book. Undefined on desktop (books are already local there). */
  downloadBookFile?(driveFileId: string, bookId: string): Promise<DriveSyncResult & { filePath?: string }>;
}

export interface BackupResult {
  ok: boolean;
  path?: string;
  error?: string;
  cancelled?: boolean;
}

/** Manual local export/import — a Google-account-free alternative/complement to Drive sync. */
export interface BackupApi {
  /** Opens a native save dialog; copies the live (freshly flushed) database there. */
  exportDatabase(): Promise<BackupResult>;
  /** Opens a native open dialog; validates the file looks like SQLite, then overwrites the local DB. On success, the app relaunches itself. */
  importDatabase(): Promise<BackupResult>;
}

export interface NewsFetchResult {
  ok: boolean;
  items?: unknown[];
  /** The category row after the fetch — for 'blog' categories this carries the freshly-fetched
   * previewImage/previewFavicon/name, which the store merges into local state. */
  category?: unknown;
  error?: string;
}

/** News & Updates digest fetch — RSS-sourced links + AI ranking, see structure.md. */
export interface NewsApi {
  fetch(categoryId: string): Promise<NewsFetchResult>;
}

export interface EntertainmentVerdictPayload {
  verdict: 'Worth It' | 'Mixed' | 'Skip';
  reasoning: string;
  skillsImproved: string;
  benefits: string;
  timeCostEstimate: string;
  addictiveness: 'low' | 'medium' | 'high';
  mentalEffects: string;
}

export interface EntertainmentVerdictResponse {
  ok: boolean;
  verdict?: EntertainmentVerdictPayload;
  provider?: string;
  error?: string;
}

/** Entertainment "worth it" verdicts, grounded in framework.md §6 — see structure.md. */
export interface EntertainmentApi {
  generateVerdict(title: string, type: string): Promise<EntertainmentVerdictResponse>;
}

export interface EarningWaySuggestionPayload {
  title: string;
  category: string;
  rationale: string;
}

export interface EarningWaySuggestResponse {
  ok: boolean;
  suggestions?: EarningWaySuggestionPayload[];
  error?: string;
}

export interface EarningWayGuidePayload {
  overview: string;
  gettingStartedSteps: string;
  skillsNeeded: string;
  toolsPlatforms: string;
  timelineExpectation: string;
  incomePotential: string;
  commonPitfalls: string;
  resources: string;
}

export interface EarningWayGuideResponse {
  ok: boolean;
  guide?: EarningWayGuidePayload;
  provider?: string;
  error?: string;
}

/** Earning Ways: AI-suggested income ideas + an on-demand A-Z guide per idea — see structure.md. */
export interface EarningWaysApi {
  suggest(): Promise<EarningWaySuggestResponse>;
  generateGuide(title: string, category: string): Promise<EarningWayGuideResponse>;
}

export interface JobsFetchResult {
  ok: boolean;
  jobs?: unknown[];
  error?: string;
}

/** Jobs: real listings from free job APIs/feeds, ranked by the configured AI provider — see structure.md. */
export interface JobsApi {
  fetch(searchId: string): Promise<JobsFetchResult>;
}

export interface FoodInfoPayload {
  benefits: string;
  caloriesEstimate: string;
  considerations: string;
}

export interface FoodInfoResponse {
  ok: boolean;
  info?: FoodInfoPayload;
  provider?: string;
  error?: string;
}

/** Health → Food & Nutrition: AI-generated benefits/calories/considerations on add — see structure.md. */
export interface FoodApi {
  generateInfo(name: string, quantity: string): Promise<FoodInfoResponse>;
}

export interface AiStatus {
  provider: 'gemini' | 'openai' | 'anthropic';
  ok: boolean;
  /** True specifically for a quota/rate-limit-shaped failure, vs. a bad key or network issue. */
  rateLimited: boolean;
  error?: string;
  checkedAt: string;
}

/** Tracks whether the active AI provider is currently usable — no provider exposes a real "remaining credits"
 * number, so this is the honest equivalent: last known success/failure, updated by an explicit check or ambiently
 * after any real AI feature call. See structure.md. */
export interface AiApi {
  /** Cached last-known status, no new network call — cheap to call on mount. */
  getStatus(): Promise<AiStatus | null>;
  /** Makes a fresh (cheap, metadata-only) request to the active provider and updates the cached status. */
  checkStatus(): Promise<AiStatus | null>;
  /** Fires whenever the cached status changes (explicit check, or ambiently after any AI feature call). Returns an unsubscribe function. */
  onStatusChanged(callback: (status: AiStatus | null) => void): () => void;
}

export interface LifeManagerApi {
  db: DbApi;
  settings: SettingsApi;
  system: SystemApi;
  dialog: DialogApi;
  media: MediaApi;
  drive: DriveApi;
  backup: BackupApi;
  news: NewsApi;
  entertainment: EntertainmentApi;
  earningWays: EarningWaysApi;
  jobs: JobsApi;
  food: FoodApi;
  ai: AiApi;
}

declare global {
  interface Window {
    api: LifeManagerApi;
  }
}

export function getApi(): LifeManagerApi {
  if (typeof window === 'undefined' || !window.api) {
    throw new Error(
      'LifeManagerApi is not available on window — is this running inside the Electron renderer with preload wired up?'
    );
  }
  return window.api;
}
