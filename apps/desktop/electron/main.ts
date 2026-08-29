import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createElectronDataStore, type ElectronDataStore } from '@life-manager/db';
import { createDriveSync } from './driveSync';
import { fetchNewsForCategory } from './ai/news';
import { generateEntertainmentVerdict } from './ai/entertainment';
import type { AiProviderId } from './ai/providers';

// Without this, Electron derives the app name from package.json's "main"
// field ("@life-manager/desktop"), which puts userData in a messy nested
// "@life-manager/desktop" folder. Set it explicitly before any app.getPath() call.
app.setName('PakCyberbot Life Manager');

let store: ElectronDataStore | undefined;
let mainWindow: BrowserWindow | undefined;

async function createWindow() {
  const win = new BrowserWindow({
    width: 1320,
    height: 840,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: '#0f0f14',
    icon: path.join(__dirname, '../../resources/icon.ico'),
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
    icon: path.join(__dirname, '../../resources/icon.ico'),
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

// --- YouTube thumbnail lookup -----------------------------------------------
// Uses YouTube's public oEmbed endpoint (no API key needed) and fetches the
// thumbnail bytes too, inlining both as data: URIs so the renderer never
// needs a live network call (and CSP stays locked to 'self').

async function fetchYouTubeThumbnail(url: string): Promise<{ title: string | null; thumbnail: string | null } | null> {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const res = await fetch(oembedUrl);
    if (!res.ok) return null;
    const data = (await res.json()) as { title?: string; thumbnail_url?: string };

    let thumbnail: string | null = null;
    if (data.thumbnail_url) {
      const imgRes = await fetch(data.thumbnail_url);
      if (imgRes.ok) {
        const buf = Buffer.from(await imgRes.arrayBuffer());
        const contentType = imgRes.headers.get('content-type') ?? 'image/jpeg';
        thumbnail = `data:${contentType};base64,${buf.toString('base64')}`;
      }
    }
    return { title: data.title ?? null, thumbnail };
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
}

/** Maps a category to (Google News RSS search query, AI relevance framing). */
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

  ipcMain.handle('db:list', (_e, table: string, where?: Record<string, unknown>) => store!.list(table, where));
  ipcMain.handle('db:get', (_e, table: string, id: string) => store!.get(table, id));
  ipcMain.handle('db:create', (_e, table: string, row: Record<string, unknown>) => store!.create(table, row));
  ipcMain.handle('db:update', (_e, table: string, id: string, patch: Record<string, unknown>) =>
    store!.update(table, id, patch)
  );
  ipcMain.handle('db:remove', (_e, table: string, id: string) => store!.remove(table, id));

  ipcMain.handle('settings:get', (_e, key: string) => store!.getSetting(key));
  ipcMain.handle('settings:set', (_e, key: string, value: string) => store!.setSetting(key, value));

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

  ipcMain.handle('media:fetchYouTubeThumbnail', (_e, url: string) => fetchYouTubeThumbnail(url));

  ipcMain.handle('news:fetch', async (_e, categoryId: string) => {
    const category = store!.get<NewsCategoryRow>('newsCategories', categoryId);
    if (!category) return { ok: false, error: 'Category not found.' };

    const built = buildNewsQuery(category);
    if ('error' in built) return { ok: false, error: built.error };

    const provider = (store!.getSetting('aiProvider') as AiProviderId | null) ?? 'gemini';
    const apiKey = store!.getSetting(`${provider}ApiKey`);
    const ai = apiKey ? { provider, apiKey } : null;

    const result = await fetchNewsForCategory(built.query, built.framing, ai);
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

    return { ok: true, items: store!.list('newsItems', { categoryId }) };
  });

  ipcMain.handle('entertainment:generateVerdict', async (_e, input: { title: string; type: string }) => {
    const provider = (store!.getSetting('aiProvider') as AiProviderId | null) ?? 'gemini';
    const apiKey = store!.getSetting(`${provider}ApiKey`);
    if (!apiKey) return { ok: false, error: 'No AI provider configured — set one up in Settings.' };
    const verdict = await generateEntertainmentVerdict(provider, apiKey, input.title, input.type);
    if (!verdict) return { ok: false, error: 'Could not get a verdict — check your API key/quota and try again.' };
    return { ok: true, verdict, provider };
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

  mainWindow = await createWindow();

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
