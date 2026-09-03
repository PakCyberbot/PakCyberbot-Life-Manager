import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createElectronDataStore, type ElectronDataStore } from '@life-manager/db/src/electronDriver';
import { createDriveSync } from './driveSync';
import { fetchNewsForCategory } from './ai/news';
import { generateEntertainmentVerdict } from './ai/entertainment';
import { generateEarningWayGuide, suggestEarningWays } from './ai/earningWays';
import { fetchJobsForSearch } from './ai/jobs';
import { generateFoodInfo } from './ai/food';
import { getLastAiError, type AiProviderId } from './ai/providers';
import { checkAiHealth, type AiHealthResult } from './ai/health';

// Without this, Electron derives the app name from package.json's "main"
// field ("@life-manager/desktop"), which puts userData in a messy nested
// "@life-manager/desktop" folder. Set it explicitly before any app.getPath() call.
app.setName('PakCyberbot Life Manager');

let store: ElectronDataStore | undefined;
let mainWindow: BrowserWindow | undefined;

// --- AI status tracking -------------------------------------------------------
// Neither Gemini, OpenAI, nor Anthropic expose a real "remaining credits"
// number for their free/pay-as-you-go tiers, so this tracks the closest
// honest equivalent: whether the last known interaction with the active
// provider succeeded, updated two ways — an explicit check (Settings'
// "Check now") and ambiently, right after any real AI feature call, by
// consulting providers.ts's getLastAiError() for that call. Pushed to the
// renderer via 'ai:statusChanged' so Settings and the Sidebar warning both
// stay in sync without polling.

export interface AiStatus {
  provider: AiProviderId;
  ok: boolean;
  rateLimited: boolean;
  error?: string;
  checkedAt: string;
}

let lastAiStatus: AiStatus | null = null;

function broadcastAiStatus() {
  mainWindow?.webContents.send('ai:statusChanged', lastAiStatus);
}

function setAiStatus(provider: AiProviderId, result: AiHealthResult) {
  lastAiStatus = { provider, ok: result.ok, rateLimited: result.rateLimited, error: result.error, checkedAt: new Date().toISOString() };
  broadcastAiStatus();
}

/** Call right after any real AI feature request completes, to passively keep the status fresh without a separate check call. */
function syncAiStatusFromLastCall(provider: AiProviderId) {
  const err = getLastAiError();
  if (err && err.provider === provider) {
    setAiStatus(provider, { ok: false, rateLimited: err.rateLimited, error: err.message });
  } else if (!err && lastAiStatus?.provider === provider && !lastAiStatus.ok) {
    // The last call for this provider succeeded — clear a previously-recorded failure.
    setAiStatus(provider, { ok: true, rateLimited: false });
  }
}

// Same two-candidate resolution as readFrameworkFile() in ai/framework.ts, for
// the same reason: a window icon loaded via BrowserWindow's `icon` option
// needs a real path on disk, and __dirname's "../../resources/icon.ico"
// traversal only reaches a real file in dev — inside a packaged app it
// resolves to a path still nested inside the virtual asar namespace, where
// native icon-loading can silently fail (confirmed live: "Failed to load
// image from path ...app.asar\resources\icon.ico" the first time this was
// packaged). The electron-builder "extraResources" entry for resources/
// copies the real file to process.resourcesPath/resources/icon.ico instead.
function resolveIconPath(): string {
  const packaged = path.join(process.resourcesPath ?? '', 'resources', 'icon.ico');
  if (fs.existsSync(packaged)) return packaged;
  return path.join(__dirname, '../../resources/icon.ico');
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1320,
    height: 840,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: '#0f0f14',
    icon: resolveIconPath(),
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // "Full screen" here means maximized (fills the screen but keeps window
  // chrome — title bar, minimize/close, taskbar access), not OS-level kiosk
  // fullscreen, which would hide those controls entirely. Maximized is what
  // most desktop apps mean by "opens full screen" and stays easy to get out of.
  win.once('ready-to-show', () => {
    win.maximize();
    win.show();
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    // Dev-mode only: surface renderer console output (including uncaught
    // React/module errors) in this process's stdout, since it otherwise
    // only goes to DevTools where nothing outside the app can see it.
    win.webContents.on('console-message', (_e, level, message, line, sourceId) => {
      const levelLabel = ['LOG', 'WARN', 'ERROR'][level] ?? 'LOG';
      console.log(`[renderer:${levelLabel}] ${message} (${sourceId}:${line})`);
    });
  }

  if (process.env.ELECTRON_RENDERER_URL) {
    await win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    await win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  return win;
}

// --- In-app PDF viewer with automatic bookmark tracking ---------------------
// Rather than shelling out to Edge/Adobe/Foxit — none of which expose any way
// to ask "what page is the user looking at" from outside the process — this
// opens the PDF in a plain Electron BrowserWindow with Chromium's own built-in
// PDF viewer (webPreferences.plugins: true). That viewer updates the window's
// URL fragment (#page=N) as the user scrolls, which we *can* observe from the
// main process via did-navigate-in-page, since it's our own window. On close,
// whatever page it last reported is written back as the book's bookmark —
// genuinely automatic, no manual "what page were you on" step required.

const openReaderWindows = new Map<number, { bookId: string; currentPage: number }>();

function parsePageFromUrl(url: string): number | null {
  const match = url.match(/[#?&]page=(\d+)/);
  return match ? Number(match[1]) : null;
}

function openBookInAppWindow(input: { id: string; filePath: string; page: number }) {
  const { id, filePath, page } = input;
  if (!fs.existsSync(filePath)) {
    return { ok: false, error: 'File not found on this machine.' };
  }

  const viewer = new BrowserWindow({
    width: 900,
    height: 1000,
    backgroundColor: '#525659',
    icon: resolveIconPath(),
    webPreferences: {
      plugins: true, // enables Chromium's built-in PDF viewer for file:// PDFs
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  openReaderWindows.set(viewer.id, { bookId: id, currentPage: Math.max(1, page) });

  const fileUrl = `${pathToFileURL(filePath).href}#page=${Math.max(1, page)}`;
  viewer.loadURL(fileUrl);

  viewer.webContents.on('did-navigate-in-page', (_e, url) => {
    const entry = openReaderWindows.get(viewer.id);
    const parsed = parsePageFromUrl(url);
    if (entry && parsed) entry.currentPage = parsed;
  });

  viewer.on('closed', () => {
    const entry = openReaderWindows.get(viewer.id);
    openReaderWindows.delete(viewer.id);
    if (!entry || !store) return;
    const updatedAt = new Date().toISOString();
    store.update('books', entry.bookId, { bookmarkPage: entry.currentPage, updatedAt });
    mainWindow?.webContents.send('book:bookmarkUpdated', { id: entry.bookId, page: entry.currentPage });
  });

  return { ok: true };
}

// --- Live website preview window ---------------------------------------------
// For News & Updates' "Blogs & Websites" and Library's Web Links: showing a
// real external page *inside* the app can't be done with an <iframe> (this
// app's CSP has no frame-src, so it falls back to default-src 'self' and
// blocks any iframe outright) or <webview> (not enabled, and would need its
// own security hardening) — and even without those restrictions, most real
// news/blog sites set X-Frame-Options/frame-ancestors and would refuse to be
// framed anyway. A plain top-level BrowserWindow doing a real loadURL() is
// not "framing" and is unaffected by either restriction — same trick as the
// PDF reader above (Chromium's own viewer in a dedicated window rather than
// reimplementing rendering). Kept deliberately as minimal as that window too:
// default frame, no custom chrome.

function openWebsitePreviewWindow(url: string, title?: string | null) {
  const viewer = new BrowserWindow({
    width: 1000,
    height: 800,
    backgroundColor: '#0f0f14',
    icon: resolveIconPath(),
    title: title || url,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  viewer.loadURL(url);
  return { ok: true };
}

// --- External reader (optional) --------------------------------------------
// For anyone who'd rather read in their own Adobe/Foxit/Edge instead of the
// in-app viewer above. Trade-off: no automatic bookmark tracking here — we
// have no way to observe another process's state. Still jumps to the saved
// page: Adobe/Foxit via "/A page=N", or via the file://...#page=N fragment
// for whatever the OS default handler is (Edge/Chrome honor it; others just
// ignore the fragment and open normally).

const CANDIDATE_READERS: { type: 'adobe' | 'foxit'; path: string }[] = [
  { type: 'adobe', path: 'C:\\Program Files (x86)\\Adobe\\Acrobat Reader DC\\Reader\\AcroRd32.exe' },
  { type: 'adobe', path: 'C:\\Program Files\\Adobe\\Acrobat Reader DC\\Reader\\AcroRd32.exe' },
  { type: 'adobe', path: 'C:\\Program Files\\Adobe\\Acrobat DC\\Acrobat\\Acrobat.exe' },
  { type: 'foxit', path: 'C:\\Program Files (x86)\\Foxit Software\\Foxit PDF Reader\\FoxitPDFReader.exe' },
  { type: 'foxit', path: 'C:\\Program Files\\Foxit Software\\Foxit PDF Reader\\FoxitPDFReader.exe' },
  { type: 'foxit', path: 'C:\\Program Files (x86)\\Foxit Software\\Foxit Reader\\FoxitReader.exe' },
];

function detectPdfReader(): { type: 'adobe' | 'foxit'; path: string } | null {
  if (process.platform !== 'win32') return null;
  return CANDIDATE_READERS.find((r) => fs.existsSync(r.path)) ?? null;
}

function openBookExternally(input: { filePath: string; page: number; readerPath?: string | null }) {
  const { filePath, page, readerPath } = input;
  if (!fs.existsSync(filePath)) {
    return { ok: false, error: 'File not found on this machine.' };
  }
  if (readerPath && fs.existsSync(readerPath)) {
    execFile(readerPath, ['/A', `page=${Math.max(1, page)}`, filePath], (err) => {
      if (err) void shell.openExternal(`${pathToFileURL(filePath).href}#page=${Math.max(1, page)}`);
    });
    return { ok: true };
  }
  void shell.openExternal(`${pathToFileURL(filePath).href}#page=${Math.max(1, page)}`);
  return { ok: true, viaDefault: true };
}

// --- Image fetching -----------------------------------------------------------
// Fetches image bytes and inlines them as a data: URI so the renderer never
// needs a live network call (and CSP stays locked to 'self'). Shared by the
// YouTube thumbnail lookup below and by any feature that takes a plain
// user-pasted image URL (e.g. Entertainment posters) — the URL is always
// something the user typed themselves, never something asked of an AI.

async function fetchImageAsDataUri(imageUrl: string): Promise<string | null> {
  try {
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) return null;
    const buf = Buffer.from(await imgRes.arrayBuffer());
    const contentType = imgRes.headers.get('content-type') ?? 'image/jpeg';
    return `data:${contentType};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

// --- YouTube thumbnail lookup -----------------------------------------------
// Uses YouTube's public oEmbed endpoint (no API key needed) for the title,
// then fetchImageAsDataUri for the thumbnail itself.

async function fetchYouTubeThumbnail(url: string): Promise<{ title: string | null; thumbnail: string | null } | null> {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const res = await fetch(oembedUrl);
    if (!res.ok) return null;
    const data = (await res.json()) as { title?: string; thumbnail_url?: string };
    const thumbnail = data.thumbnail_url ? await fetchImageAsDataUri(data.thumbnail_url) : null;
    return { title: data.title ?? null, thumbnail };
  } catch {
    return null;
  }
}

// --- Wikipedia poster/thumbnail lookup ---------------------------------------
// For Entertainment (movies/shows/anime/games/books/other): rather than
// asking the user to manually hunt down and paste a poster URL, or asking an
// AI for one (the "never ask AI for a URL" lesson from News/Jobs — it can't
// be trusted to reproduce a real image link), this queries Wikipedia's own
// free, keyless REST API using the title (+ a type-specific hint word to
// disambiguate, e.g. "film"/"video game") as the search term — a real search
// against a real source, same discipline as Google News RSS elsewhere.

const ENTERTAINMENT_TYPE_HINT: Record<string, string> = {
  movie: 'film',
  show: 'TV series',
  anime: 'anime',
  game: 'video game',
  book: 'book',
  other: '',
};

async function fetchWikipediaSummaryThumbnail(title: string): Promise<string | null> {
  try {
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { thumbnail?: { source?: string } };
    return data.thumbnail?.source ?? null;
  } catch {
    return null;
  }
}

async function fetchWikipediaThumbnail(title: string, type: string): Promise<string | null> {
  const hint = ENTERTAINMENT_TYPE_HINT[type] ?? '';
  const query = hint ? `${title} ${hint}` : title;

  // Try the raw title first (fast path — works whenever the title itself is
  // already the Wikipedia page's exact title, e.g. "Elden Ring").
  let imageUrl = await fetchWikipediaSummaryThumbnail(title);

  // Otherwise resolve the best-matching page via opensearch (handles
  // disambiguation, e.g. "Inception" the word vs. "Inception (film)") using
  // the type-hinted query, then fetch that resolved title's summary.
  if (!imageUrl) {
    try {
      const searchRes = await fetch(
        `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=1&format=json`
      );
      if (searchRes.ok) {
        const [, titles] = (await searchRes.json()) as [string, string[]];
        if (titles?.[0]) imageUrl = await fetchWikipediaSummaryThumbnail(titles[0]);
      }
    } catch {
      // fall through to null below
    }
  }

  return imageUrl ? fetchImageAsDataUri(imageUrl) : null;
}

// --- Web page preview lookup (og:image/og:title/favicon) --------------------
// Shared by Library's Web Links tab and News & Updates' "Blogs & Websites":
// fetches the page's own HTML and pulls its Open Graph title/image plus a
// favicon — a real preview of that real page, same "never ask an AI for a
// URL/image" discipline as the Wikipedia lookup above, just sourced directly
// from the page itself instead of a third-party API. No HTML parser
// dependency — regex extraction, consistent with how ai/news.ts already
// regex-parses RSS XML rather than pulling in a full parser for a handful of
// tags. A realistic User-Agent is set since a lot of sites silently reject
// (or serve a stripped-down page to) Node's default fetch UA.

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .trim();
}

function extractMetaContent(html: string, property: string): string | null {
  const pattern = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`,
    'i'
  );
  const match = html.match(pattern);
  const value = match?.[1] ?? match?.[2];
  return value ? decodeHtmlEntities(value) : null;
}

interface WebPreview {
  title: string | null;
  image: string | null;
  favicon: string | null;
}

async function fetchWebPreview(url: string): Promise<WebPreview | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': BROWSER_USER_AGENT, Accept: 'text/html' } });
    if (!res.ok) return null;
    const html = await res.text();

    const ogTitle = extractMetaContent(html, 'og:title');
    const titleTagMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = ogTitle ?? (titleTagMatch ? decodeHtmlEntities(titleTagMatch[1]) : null);

    const ogImage = extractMetaContent(html, 'og:image');
    const iconMatch = html.match(/<link[^>]+rel=["'](?:shortcut icon|icon|apple-touch-icon)["'][^>]+href=["']([^"']+)["']/i);

    const origin = new URL(url).origin;
    const resolvedImage = ogImage ? new URL(ogImage, url).href : null;
    const resolvedFavicon = iconMatch ? new URL(iconMatch[1], url).href : `${origin}/favicon.ico`;

    const [image, favicon] = await Promise.all([
      resolvedImage ? fetchImageAsDataUri(resolvedImage) : Promise.resolve(null),
      fetchImageAsDataUri(resolvedFavicon).catch(() => null),
    ]);

    return { title, image, favicon };
  } catch {
    return null;
  }
}

interface NewsCategoryRow {
  id: string;
  type: string;
  name: string;
  prompt: string | null;
  locationValue: string | null;
  url: string | null;
}

/** Maps a category to (Google News RSS search query, AI relevance framing). 'blog' categories never
 * reach this — the news:fetch handler branches to fetchWebPreview() for them before calling this. */
function buildNewsQuery(category: NewsCategoryRow): { query: string; framing: string } | { error: string } {
  switch (category.type) {
    case 'custom':
      return { query: category.name, framing: category.prompt ?? category.name };
    case 'global-politics':
      return {
        query: 'global politics international relations',
        framing: category.prompt ?? 'Major global political and policy developments that matter to everyone.',
      };
    case 'country':
      if (!category.locationValue) return { error: 'Set a country for this category in Settings first.' };
      return { query: `${category.locationValue} news`, framing: `Most important recent news in ${category.locationValue}.` };
    case 'city':
      if (!category.locationValue) return { error: 'Set a city for this category in Settings first.' };
      return {
        query: `${category.locationValue} news`,
        framing: `Most important recent local news in ${category.locationValue}.`,
      };
    default:
      return { error: `Unknown category type: ${category.type}` };
  }
}

app.whenReady().then(async () => {
  const dbPath = path.join(app.getPath('userData'), 'life-manager.sqlite');
  store = await createElectronDataStore(dbPath);
  const driveSync = createDriveSync(store);

  // --- Auto Sync: pull-on-startup ---------------------------------------------
  // Runs before any IPC handler or window exists — a real (non-skipped) pull
  // overwrites dbPath on disk, and this instance's in-memory store (just opened,
  // holding the pre-pull data) would otherwise autosave right back over it. The
  // same app.exit() pattern the manual 'drive:pull' handler below already uses
  // for exactly this reason: app.exit() skips 'before-quit', so store.close()
  // never runs and can't re-overwrite the freshly-pulled file. pullIfNewer()
  // itself guards against relaunching on every single startup — only a remote
  // file strictly newer than what this device last pushed/pulled triggers it.
  let autoSyncPullFailedMessage: string | null = null;
  if (store.getSetting('autoSyncEnabled') === 'on' && driveSync.status().connected) {
    const result = await driveSync.pullIfNewer(dbPath);
    if (result.ok && !result.skipped) {
      app.relaunch();
      app.exit(0);
      return;
    }
    if (!result.ok) autoSyncPullFailedMessage = result.error ?? 'Could not reach Google Drive.';
  }

  // --- Auto Sync: push-on-mutation ---------------------------------------------
  // Debounced so a burst of edits (or a chain of onBlur commits) collapses into
  // one push a few seconds after the *last* mutation, not one push per write.
  // Fire-and-forget from the caller's perspective — never blocks the IPC
  // response that triggered it.
  let autoPushTimer: NodeJS.Timeout | null = null;
  function scheduleAutoPush() {
    if (store!.getSetting('autoSyncEnabled') !== 'on') return;
    if (!driveSync.status().connected) return;
    if (autoPushTimer) clearTimeout(autoPushTimer);
    autoPushTimer = setTimeout(() => {
      autoPushTimer = null;
      driveSync.push(dbPath).catch(() => {
        // Best-effort — a failed background push isn't surfaced with its own
        // toast (unlike the startup pull); the next successful mutation's
        // auto-push, or a manual Push from Settings, will retry naturally.
      });
    }, 3000);
  }

  ipcMain.handle('db:list', (_e, table: string, where?: Record<string, unknown>) => store!.list(table, where));
  ipcMain.handle('db:get', (_e, table: string, id: string) => store!.get(table, id));
  ipcMain.handle('db:create', async (_e, table: string, row: Record<string, unknown>) => {
    const result = await store!.create(table, row);
    scheduleAutoPush();
    return result;
  });
  ipcMain.handle('db:update', async (_e, table: string, id: string, patch: Record<string, unknown>) => {
    const result = await store!.update(table, id, patch);
    scheduleAutoPush();
    return result;
  });
  ipcMain.handle('db:remove', async (_e, table: string, id: string) => {
    const result = await store!.remove(table, id);
    scheduleAutoPush();
    return result;
  });
  ipcMain.handle('db:hardRemove', async (_e, table: string, id: string) => {
    const result = await store!.hardRemove(table, id);
    scheduleAutoPush();
    return result;
  });

  ipcMain.handle('settings:get', (_e, key: string) => store!.getSetting(key));
  ipcMain.handle('settings:set', (_e, key: string, value: string) => {
    const result = store!.setSetting(key, value);
    scheduleAutoPush();
    return result;
  });

  ipcMain.handle('system:hostname', () => os.hostname());
  ipcMain.handle('system:readFileAsBase64', (_e, filePath: string) => {
    try {
      return fs.readFileSync(filePath).toString('base64');
    } catch {
      return null;
    }
  });
  ipcMain.handle('system:detectPdfReader', () => detectPdfReader());
  ipcMain.handle('system:openBookInApp', (_e, input) => openBookInAppWindow(input));
  ipcMain.handle('system:openBookExternally', (_e, input) => openBookExternally(input));
  ipcMain.handle('system:openExternal', (_e, url: string) => shell.openExternal(url));
  ipcMain.handle('system:openWebsite', (_e, url: string, title?: string) => openWebsitePreviewWindow(url, title));
  ipcMain.handle('system:openLocalPath', async (_e, targetPath: string) => {
    if (!fs.existsSync(targetPath)) return { ok: false, error: 'This path does not exist on this machine.' };
    // shell.openPath opens a folder in the OS file browser or a file with its
    // default app, either way — no need to branch on file vs. folder here.
    // It resolves to '' on success, or an error string on failure.
    const errorMessage = await shell.openPath(targetPath);
    return errorMessage ? { ok: false, error: errorMessage } : { ok: true };
  });

  ipcMain.handle('dialog:pickPdf', async () => {
    const win = BrowserWindow.getFocusedWindow();
    const options: Electron.OpenDialogOptions = {
      properties: ['openFile'],
      filters: [{ name: 'PDF documents', extensions: ['pdf'] }],
    };
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
  });
  ipcMain.handle('dialog:pickExecutable', async () => {
    const win = BrowserWindow.getFocusedWindow();
    const options: Electron.OpenDialogOptions = {
      properties: ['openFile'],
      filters: process.platform === 'win32' ? [{ name: 'Executable', extensions: ['exe'] }] : [],
    };
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
  });
  ipcMain.handle('dialog:pickFileOrFolder', async (_e, kind: 'file' | 'folder') => {
    const win = BrowserWindow.getFocusedWindow();
    // Electron's own docs: on Windows/Linux, combining ['openFile', 'openDirectory']
    // in one dialog silently collapses to a directory-only picker — there is no
    // single native dialog offering a real choice between the two on those
    // platforms, so the caller declares intent up front and gets exactly one
    // property here. (macOS is the one platform where combining them works as
    // a toggle, but a single-property dialog works fine there too.)
    const options: Electron.OpenDialogOptions = { properties: [kind === 'folder' ? 'openDirectory' : 'openFile'] };
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
    if (result.canceled || result.filePaths.length === 0) return null;
    const picked = result.filePaths[0];
    return { path: picked, isFolder: fs.statSync(picked).isDirectory() };
  });

  ipcMain.handle('media:fetchYouTubeThumbnail', (_e, url: string) => fetchYouTubeThumbnail(url));
  ipcMain.handle('media:fetchImageAsDataUri', (_e, url: string) => fetchImageAsDataUri(url));
  ipcMain.handle('media:fetchWikipediaThumbnail', (_e, title: string, type: string) => fetchWikipediaThumbnail(title, type));
  ipcMain.handle('media:fetchWebPreview', (_e, url: string) => fetchWebPreview(url));

  ipcMain.handle('news:fetch', async (_e, categoryId: string) => {
    const category = store!.get<NewsCategoryRow>('newsCategories', categoryId);
    if (!category) return { ok: false, error: 'Category not found.' };

    // 'blog' categories are a live site preview, not an RSS/AI digest — fetch
    // og:title/og:image/favicon straight from the site itself and stop there.
    if (category.type === 'blog') {
      if (!category.url) return { ok: false, error: 'Set a URL for this blog/website in Settings first.' };
      const preview = await fetchWebPreview(category.url);
      if (!preview) return { ok: false, error: 'Could not load a preview for this URL — it may be blocking automated requests.' };
      const now = new Date().toISOString();
      const patch: Record<string, unknown> = {
        previewImage: preview.image,
        previewFavicon: preview.favicon,
        lastFetchedAt: now,
        updatedAt: now,
      };
      // Only overwrite the name if the user never set a real one (still the placeholder URL).
      if (preview.title && category.name === category.url) patch.name = preview.title;
      store!.update('newsCategories', categoryId, patch);
      return { ok: true, items: [], category: store!.get('newsCategories', categoryId) };
    }

    const built = buildNewsQuery(category);
    if ('error' in built) return { ok: false, error: built.error };

    const provider = (store!.getSetting('aiProvider') as AiProviderId | null) ?? 'gemini';
    const apiKey = store!.getSetting(`${provider}ApiKey`);
    const ai = apiKey ? { provider, apiKey } : null;

    const result = await fetchNewsForCategory(built.query, built.framing, ai);
    if (ai) syncAiStatusFromLastCall(ai.provider);
    if (result.error) return { ok: false, error: result.error };

    const now = new Date().toISOString();
    store!.replaceNewsItems(
      categoryId,
      result.items.map((item) => ({
        id: crypto.randomUUID(),
        title: item.title,
        summary: item.summary,
        url: item.url,
        source: item.source,
        publishedAt: item.publishedAt,
      }))
    );
    store!.update('newsCategories', categoryId, { lastFetchedAt: now, updatedAt: now });

    return { ok: true, items: store!.list('newsItems', { categoryId }), category: store!.get('newsCategories', categoryId) };
  });

  ipcMain.handle('entertainment:generateVerdict', async (_e, input: { title: string; type: string }) => {
    const provider = (store!.getSetting('aiProvider') as AiProviderId | null) ?? 'gemini';
    const apiKey = store!.getSetting(`${provider}ApiKey`);
    if (!apiKey) return { ok: false, error: 'No AI provider configured — set one up in Settings.' };
    const customPrompt = store!.getSetting('entertainmentPrompt');
    const verdict = await generateEntertainmentVerdict(provider, apiKey, input.title, input.type, customPrompt);
    syncAiStatusFromLastCall(provider);
    if (!verdict) return { ok: false, error: 'Could not get a verdict — check your API key/quota and try again.' };
    return { ok: true, verdict, provider };
  });

  ipcMain.handle('earningWays:suggest', async () => {
    const provider = (store!.getSetting('aiProvider') as AiProviderId | null) ?? 'gemini';
    const apiKey = store!.getSetting(`${provider}ApiKey`);
    if (!apiKey) return { ok: false, error: 'No AI provider configured — set one up in Settings.' };
    const activeGoals = store!.list<{ title: string; status: string }>('goals', { status: 'active' });
    const suggestions = await suggestEarningWays(
      provider,
      apiKey,
      activeGoals.map((g) => g.title)
    );
    syncAiStatusFromLastCall(provider);
    if (!suggestions) return { ok: false, error: 'Could not get suggestions — check your API key/quota and try again.' };
    return { ok: true, suggestions };
  });

  ipcMain.handle('earningWays:generateGuide', async (_e, input: { title: string; category: string }) => {
    const provider = (store!.getSetting('aiProvider') as AiProviderId | null) ?? 'gemini';
    const apiKey = store!.getSetting(`${provider}ApiKey`);
    if (!apiKey) return { ok: false, error: 'No AI provider configured — set one up in Settings.' };
    const guide = await generateEarningWayGuide(provider, apiKey, input.title, input.category);
    syncAiStatusFromLastCall(provider);
    if (!guide) return { ok: false, error: 'Could not generate a guide — check your API key/quota and try again.' };
    return { ok: true, guide, provider };
  });

  ipcMain.handle('jobs:fetch', async (_e, searchId: string) => {
    const search = store!.get<{ id: string; keywords: string; prompt: string | null }>('jobSearches', searchId);
    if (!search) return { ok: false, error: 'Search not found.' };

    const provider = (store!.getSetting('aiProvider') as AiProviderId | null) ?? 'gemini';
    const apiKey = store!.getSetting(`${provider}ApiKey`);
    const ai = apiKey ? { provider, apiKey } : null;

    const result = await fetchJobsForSearch(search.keywords, search.prompt ?? search.keywords, ai);
    if (ai) syncAiStatusFromLastCall(ai.provider);
    if (result.error) return { ok: false, error: result.error };

    const now = new Date().toISOString();
    store!.replaceJobListings(
      searchId,
      result.jobs.map((job) => ({
        id: crypto.randomUUID(),
        title: job.title,
        company: job.company,
        location: job.location,
        url: job.url,
        source: job.source,
        tags: job.tags.join(', ') || null,
        aiNote: job.aiNote,
        postedAt: job.postedAt,
      }))
    );
    store!.update('jobSearches', searchId, { lastFetchedAt: now, updatedAt: now });

    return { ok: true, jobs: store!.list('jobListings', { searchId }) };
  });

  ipcMain.handle('food:generateInfo', async (_e, input: { name: string; quantity: string }) => {
    const provider = (store!.getSetting('aiProvider') as AiProviderId | null) ?? 'gemini';
    const apiKey = store!.getSetting(`${provider}ApiKey`);
    if (!apiKey) return { ok: false, error: 'No AI provider configured — set one up in Settings.' };
    const info = await generateFoodInfo(provider, apiKey, input.name, input.quantity);
    syncAiStatusFromLastCall(provider);
    if (!info) return { ok: false, error: 'Could not get nutrition info — check your API key/quota and try again.' };
    return { ok: true, info, provider };
  });

  ipcMain.handle('ai:getStatus', () => lastAiStatus);
  ipcMain.handle('ai:checkStatus', async () => {
    const provider = (store!.getSetting('aiProvider') as AiProviderId | null) ?? 'gemini';
    const apiKey = store!.getSetting(`${provider}ApiKey`);
    if (!apiKey) {
      setAiStatus(provider, { ok: false, rateLimited: false, error: 'No API key configured for this provider.' });
      return lastAiStatus;
    }
    const result = await checkAiHealth(provider, apiKey);
    setAiStatus(provider, result);
    return lastAiStatus;
  });

  ipcMain.handle('drive:status', () => driveSync.status());
  ipcMain.handle('drive:connect', () => driveSync.connect());
  ipcMain.handle('drive:disconnect', () => driveSync.disconnect());
  ipcMain.handle('drive:push', () => driveSync.push(dbPath));
  ipcMain.handle('drive:pull', async () => {
    const result = await driveSync.pull(dbPath);
    if (result.ok) {
      // The running store still has the pre-pull data in memory, and would
      // overwrite the freshly-pulled file the next time anything autosaves.
      // Relaunching is the simplest way to guarantee every in-memory cache
      // (the DB, every renderer store) reloads from what we just pulled.
      // app.exit() (unlike quit()) skips 'before-quit'/'window-all-closed',
      // so store.close() never runs and can't re-overwrite the pulled file.
      app.relaunch();
      app.exit(0);
    }
    return result;
  });

  ipcMain.handle('db:export', async () => {
    const win = BrowserWindow.getFocusedWindow();
    const options: Electron.SaveDialogOptions = {
      defaultPath: `life-manager-backup-${new Date().toISOString().slice(0, 10)}.sqlite`,
      filters: [{ name: 'SQLite database', extensions: ['sqlite'] }],
    };
    const result = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options);
    if (result.canceled || !result.filePath) return { ok: false, cancelled: true };
    try {
      store!.flush(); // guarantee the copy reflects the very latest state, not whatever the debounced autosave last wrote
      fs.copyFileSync(dbPath, result.filePath);
      return { ok: true, path: result.filePath };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  ipcMain.handle('db:import', async () => {
    const win = BrowserWindow.getFocusedWindow();
    const options: Electron.OpenDialogOptions = {
      properties: ['openFile'],
      filters: [{ name: 'SQLite database', extensions: ['sqlite', 'db'] }],
    };
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
    if (result.canceled || result.filePaths.length === 0) return { ok: false, cancelled: true };

    const picked = result.filePaths[0];
    try {
      // SQLite files always start with this exact 16-byte magic header — a
      // cheap sanity check before overwriting the user's real data with
      // whatever they happened to click on.
      const header = Buffer.alloc(16);
      const fd = fs.openSync(picked, 'r');
      fs.readSync(fd, header, 0, 16, 0);
      fs.closeSync(fd);
      if (header.toString('utf-8') !== 'SQLite format 3 ') {
        return { ok: false, error: "That file doesn't look like a valid SQLite database." };
      }

      fs.copyFileSync(picked, dbPath);
      // Same reasoning as drive:pull above: relaunch via app.exit() so every
      // in-memory cache reloads clean, and the pre-import data in memory
      // can't sneak back in through a normal quit-flush.
      app.relaunch();
      app.exit(0);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  mainWindow = await createWindow();

  if (autoSyncPullFailedMessage) {
    // Delayed past 'did-finish-load' — the renderer's App.tsx only starts listening for this
    // event from inside a useEffect after it mounts, a moment after the page itself finishes
    // loading; sending any earlier risks the main process firing before anything is subscribed
    // (Electron IPC doesn't queue events for a listener that isn't registered yet).
    const message = autoSyncPullFailedMessage;
    mainWindow.webContents.once('did-finish-load', () => {
      setTimeout(() => mainWindow?.webContents.send('drive:autoSyncFailed', message), 300);
    });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  store?.close();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  store?.close();
});
