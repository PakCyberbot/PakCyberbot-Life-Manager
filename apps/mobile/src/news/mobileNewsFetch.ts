// Near-verbatim mobile port of apps/desktop/electron/ai/news.ts — real
// articles from Google News RSS (free, keyless, no billing) + the configured
// AI provider to rank/prioritize and write a one-line "why it matters" for
// each, never asking the AI to produce a URL itself. Pure fetch/regex, zero
// Node APIs in the original, so this ports over unchanged aside from
// importing callAI from the mobile-local provider file instead of the
// desktop one.

import { callAI, type AiProviderId } from './mobileAiProviders';

export interface RawNewsItem {
  title: string;
  url: string;
  source: string | null;
  publishedAt: string | null;
}

export interface NewsItemResult extends RawNewsItem {
  summary: string | null;
}

function decodeXmlEntities(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

async function fetchGoogleNewsRss(query: string, limit = 12): Promise<RawNewsItem[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const xml = await res.text();

  const items: RawNewsItem[] = [];
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  for (const block of itemBlocks.slice(0, limit)) {
    const title = block.match(/<title>([\s\S]*?)<\/title>/)?.[1];
    const link = block.match(/<link>([\s\S]*?)<\/link>/)?.[1];
    const pubDate = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? null;
    const source = block.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] ?? null;
    if (title && link) {
      items.push({
        title: decodeXmlEntities(title).trim(),
        url: decodeXmlEntities(link).trim(),
        source: source ? decodeXmlEntities(source).trim() : null,
        publishedAt: pubDate,
      });
    }
  }
  return items;
}

async function rankWithAI(provider: AiProviderId, apiKey: string, items: RawNewsItem[], framing: string): Promise<Map<number, string>> {
  const listText = items.map((it, i) => `${i + 1}. ${it.title} (${it.source ?? 'unknown source'})`).join('\n');
  const prompt =
    `Here are recent news headlines:\n${listText}\n\n` +
    `For someone interested in: "${framing}"\n\n` +
    'Pick up to 8 of the most relevant/important ones. Respond with ONLY a JSON array like ' +
    '[{"index": 1, "summary": "one sentence on why this matters"}], using the index numbers from the list above. ' +
    'No markdown fences, no other text.';

  const rawText = await callAI(provider, apiKey, prompt);
  if (!rawText) return new Map();

  const match = rawText.match(/\[[\s\S]*\]/);
  if (!match) return new Map();

  try {
    const parsed = JSON.parse(match[0]) as { index: number; summary: string }[];
    const map = new Map<number, string>();
    for (const p of parsed) {
      if (typeof p.index === 'number' && typeof p.summary === 'string') map.set(p.index, p.summary);
    }
    return map;
  } catch {
    return new Map();
  }
}

export async function fetchNewsForCategory(
  query: string,
  framing: string,
  ai: { provider: AiProviderId; apiKey: string } | null
): Promise<{ items: NewsItemResult[]; error?: string }> {
  const raw = await fetchGoogleNewsRss(query);
  if (raw.length === 0) {
    return { items: [], error: 'No results found — try a different name or location.' };
  }

  if (!ai) {
    return { items: raw.slice(0, 8).map((r) => ({ ...r, summary: null })) };
  }

  const ranked = await rankWithAI(ai.provider, ai.apiKey, raw, framing);
  if (ranked.size === 0) {
    return { items: raw.slice(0, 8).map((r) => ({ ...r, summary: null })) };
  }

  const items: NewsItemResult[] = [];
  for (const [index, summary] of ranked) {
    const raw1 = raw[index - 1];
    if (raw1) items.push({ ...raw1, summary });
  }
  return { items };
}

/** Maps a category to (Google News RSS search query, AI relevance framing) — same switch as
 * desktop's main.ts (kept there only inline, so copied here rather than shared, since it's a few
 * lines and desktop's own copy is Node-context-free too). 'blog' categories never reach this — the
 * caller branches to a web-preview fetch for those instead. */
export function buildNewsQuery(category: {
  type: string;
  name: string;
  prompt?: string | null;
  locationValue?: string | null;
}): { query: string; framing: string } | { error: string } {
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
      return { query: `${category.locationValue} news`, framing: `Most important recent local news in ${category.locationValue}.` };
    default:
      return { error: `Unknown category type: ${category.type}` };
  }
}
