// The mobile equivalent of apps/desktop/electron/preload.ts — builds the
// window.api object packages/core's stores call into. Where desktop's
// preload forwards to ipcMain handlers in a separate Node process, mobile
// implements everything directly in this same JS context: CapacitorHttp
// (enabled in capacitor.config.ts) patches fetch/XHR to route through native
// networking, so the same "pure REST" logic desktop runs in its main process
// (YouTube oEmbed, Wikipedia lookup, og:image scraping, Drive's API) works
// here too without hitting WebView CORS restrictions.
//
// Phase 1 scope: db/settings/a working subset of system+media are real.
// Everything desktop-only (native file dialogs, AI provider calls, News/Jobs
// refresh, Drive sync, local backup) is a deliberate stub — mobile's UI never
// calls these in Phase 1 (it's read-mostly and doesn't run its own AI/RSS
// fetches), but the full LifeManagerApi shape is still implemented so the
// type contract stays honest rather than silently narrowed.

import { Browser } from '@capacitor/browser';
import { Device } from '@capacitor/device';
import type {
  AiApi,
  BackupApi,
  DbApi,
  DialogApi,
  DriveApi,
  EarningWaysApi,
  EntertainmentApi,
  FoodApi,
  JobsApi,
  LifeManagerApi,
  MediaApi,
  NewsApi,
  SettingsApi,
  SystemApi,
} from '@life-manager/core';
import type { MobileDataStore } from '@life-manager/db/src/capacitorDriver';

const NOT_AVAILABLE = 'Not available on mobile in this version.';

// Cached once — a device doesn't change identity between calls, and this
// value fills the same role os.hostname() plays on desktop for Books'
// hostname field (which host a file-backed row belongs to).
let cachedHostname: string | null = null;
async function getHostname(): Promise<string> {
  if (cachedHostname) return cachedHostname;
  const info = await Device.getId();
  const deviceInfo = await Device.getInfo();
  // Short and human-readable (e.g. "Pixel 9"), with enough of the device's
  // stable identifier appended to disambiguate two phones of the same model.
  cachedHostname = `${deviceInfo.model ?? 'Android device'} (${info.identifier.slice(0, 6)})`;
  return cachedHostname;
}

function buildDb(store: MobileDataStore): DbApi {
  return {
    // Each generic parameter has to be forwarded explicitly (store.list<T>(...),
    // not store.list(...)) — without it, TS can't infer T from the arguments
    // alone and silently narrows the inner call to T=unknown, which then
    // fails to satisfy DbApi's own T at the outer call site.
    list: <T,>(table: string, where?: Record<string, unknown>) => store.list<T>(table, where),
    get: <T,>(table: string, id: string) => store.get<T>(table, id),
    create: <T,>(table: string, row: T) => store.create(table, row as Record<string, unknown>) as Promise<T>,
    update: (table, id, patch) => store.update(table, id, patch),
    remove: (table, id) => store.remove(table, id),
    hardRemove: (table, id) => store.hardRemove(table, id),
  };
}

function buildSettings(store: MobileDataStore): SettingsApi {
  return {
    get: (key) => store.getSetting(key),
    set: (key, value) => store.setSetting(key, value),
  };
}

// --- Media: og:image/title/favicon + YouTube/Wikipedia lookups, ported from
// apps/desktop/electron/main.ts's logic (see CLAUDE.md's Library/News
// sections) — same regex-based extraction, same fetch-and-inline-as-data:URI
// discipline, just running in this JS context instead of a Node main process.

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

async function fetchImageAsDataUri(imageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') ?? 'image/jpeg';
    let binary = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return `data:${contentType};base64,${btoa(binary)}`;
  } catch {
    return null;
  }
}

async function fetchYouTubeThumbnail(url: string): Promise<{ title: string | null; thumbnail: string | null } | null> {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
    if (!res.ok) return null;
    const data = (await res.json()) as { title?: string; thumbnail_url?: string };
    const thumbnail = data.thumbnail_url ? await fetchImageAsDataUri(data.thumbnail_url) : null;
    return { title: data.title ?? null, thumbnail };
  } catch {
    return null;
  }
}

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

const ENTERTAINMENT_TYPE_HINT: Record<string, string> = {
  movie: 'film',
  show: 'TV series',
  anime: 'anime',
  game: 'video game',
  book: 'book',
  other: '',
};

async function fetchWikipediaThumbnail(title: string, type: string): Promise<string | null> {
  const hint = ENTERTAINMENT_TYPE_HINT[type] ?? '';
  const query = hint ? `${title} ${hint}` : title;
  let imageUrl = await fetchWikipediaSummaryThumbnail(title);
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

async function fetchWebPreview(url: string): Promise<{ title: string | null; image: string | null; favicon: string | null } | null> {
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

const media: MediaApi = {
  fetchYouTubeThumbnail,
  fetchImageAsDataUri,
  fetchWikipediaThumbnail,
  fetchWebPreview,
};

function buildSystem(): SystemApi {
  return {
    hostname: getHostname,
    // Books are added on mobile via share-intent (Phase 2), which copies bytes
    // into app-private storage directly — this manual "read an arbitrary path"
    // capability is a desktop-only need (native file dialogs).
    readFileAsBase64: async () => null,
    detectPdfReader: async () => null,
    openBookInApp: async () => ({ ok: false, error: NOT_AVAILABLE }),
    openBookExternally: async () => ({ ok: false, error: NOT_AVAILABLE }),
    openExternal: async (url) => {
      await Browser.open({ url });
    },
    // No dedicated-window equivalent to Electron's BrowserWindow on mobile —
    // the system browser (Custom Tabs) is the closest "real page, not this
    // app's WebView" experience available.
    openWebsite: async (url) => {
      await Browser.open({ url });
      return { ok: true };
    },
    onBookmarkUpdate: () => () => {},
    openLocalPath: async () => ({ ok: false, error: NOT_AVAILABLE }),
  };
}

const dialog: DialogApi = {
  pickPdf: async () => null,
  pickExecutable: async () => null,
  pickFileOrFolder: async () => null,
};

const drive: DriveApi = {
  status: async () => ({ connected: false, email: null, lastPushedAt: null, lastPulledAt: null }),
  connect: async () => ({ ok: false, error: NOT_AVAILABLE }),
  disconnect: async () => {},
  push: async () => ({ ok: false, error: NOT_AVAILABLE }),
  pull: async () => ({ ok: false, error: NOT_AVAILABLE }),
};

const backup: BackupApi = {
  exportDatabase: async () => ({ ok: false, error: NOT_AVAILABLE }),
  importDatabase: async () => ({ ok: false, error: NOT_AVAILABLE }),
};

// News/Jobs/Entertainment/EarningWays/Food all involve either an AI provider
// call or a live-fetch pipeline (RSS, job APIs) — mobile is read-mostly and
// never triggers these itself in Phase 1; it only ever displays whatever the
// synced DB already has. Stubs keep the type contract intact.
const news: NewsApi = { fetch: async () => ({ ok: false, error: NOT_AVAILABLE }) };
const entertainment: EntertainmentApi = { generateVerdict: async () => ({ ok: false, error: NOT_AVAILABLE }) };
const earningWays: EarningWaysApi = {
  suggest: async () => ({ ok: false, error: NOT_AVAILABLE }),
  generateGuide: async () => ({ ok: false, error: NOT_AVAILABLE }),
};
const jobs: JobsApi = { fetch: async () => ({ ok: false, error: NOT_AVAILABLE }) };
const food: FoodApi = { generateInfo: async () => ({ ok: false, error: NOT_AVAILABLE }) };
const ai: AiApi = {
  getStatus: async () => null,
  checkStatus: async () => null,
  onStatusChanged: () => () => {},
};

export function buildMobileApi(store: MobileDataStore): LifeManagerApi {
  return {
    db: buildDb(store),
    settings: buildSettings(store),
    system: buildSystem(),
    dialog,
    media,
    drive,
    backup,
    news,
    entertainment,
    earningWays,
    jobs,
    food,
    ai,
  };
}
