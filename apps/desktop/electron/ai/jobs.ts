// Jobs — real listings aggregated from free, public, no-key job APIs/feeds,
// then ranked/annotated by the configured AI provider. Deliberately does NOT
// scrape LinkedIn/Indeed/Glassdoor: their Terms of Service explicitly
// prohibit it and they actively fight scrapers (LinkedIn has sued over
// exactly this — hiQ Labs v. LinkedIn). The four sources below are built
// for aggregation and either say so in their own API docs or publish an RSS
// feed, which is meant for syndication:
//   - RemoteOK        https://remoteok.com/api            (free, asks for attribution)
//   - Arbeitnow        https://arbeitnow.com/api/job-board-api  (free, supports ?search=)
//   - We Work Remotely https://weworkremotely.com/remote-jobs.rss (public RSS)
//   - Jobicy           https://jobicy.com/api/v2/remote-jobs (free, asks for attribution + original-URL links)
// Same discipline as News & Entertainment: the AI only ranks/annotates real
// listings fetched from these sources — it's never asked to produce a job or a URL.

import { callAI, type AiProviderId } from './providers';

export interface RawJob {
  title: string;
  company: string | null;
  location: string | null;
  url: string;
  source: string;
  tags: string[];
  postedAt: string | null;
}

export interface JobResult extends RawJob {
  aiNote: string | null;
}

function matches(keywords: string[], haystacks: (string | null | undefined)[]): boolean {
  if (keywords.length === 0) return true;
  const text = haystacks.filter(Boolean).join(' ').toLowerCase();
  return keywords.some((k) => text.includes(k.toLowerCase()));
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

async function fetchRemoteOk(keywords: string[]): Promise<RawJob[]> {
  try {
    const res = await fetch('https://remoteok.com/api', { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return [];
    const data = (await res.json()) as Array<Record<string, unknown>>;
    const jobs: RawJob[] = [];
    for (const item of data) {
      const position = item.position as string | undefined;
      if (!position) continue; // first array item is RemoteOK's own legal notice, not a job
      const tags = (item.tags as string[] | undefined) ?? [];
      if (!matches(keywords, [position, item.company as string, ...tags])) continue;
      jobs.push({
        title: position,
        company: (item.company as string) ?? null,
        location: 'Remote',
        url: `https://remoteok.com/remote-jobs/${item.slug}`,
        source: 'RemoteOK',
        tags,
        postedAt: (item.date as string) ?? null,
      });
    }
    return jobs;
  } catch {
    return [];
  }
}

async function fetchArbeitnow(keywords: string[]): Promise<RawJob[]> {
  try {
    const query = keywords[0] ? `?search=${encodeURIComponent(keywords[0])}` : '';
    const res = await fetch(`https://www.arbeitnow.com/api/job-board-api${query}`);
    if (!res.ok) return [];
    const data = (await res.json()) as { data?: Array<Record<string, unknown>> };
    return (data.data ?? []).map((item) => ({
      title: item.title as string,
      company: (item.company_name as string) ?? null,
      location: (item.remote ? 'Remote' : (item.location as string)) ?? null,
      url: item.url as string,
      source: 'Arbeitnow',
      tags: (item.tags as string[] | undefined) ?? [],
      postedAt: item.created_at ? new Date((item.created_at as number) * 1000).toISOString() : null,
    }));
  } catch {
    return [];
  }
}

async function fetchWeWorkRemotely(keywords: string[]): Promise<RawJob[]> {
  try {
    const res = await fetch('https://weworkremotely.com/remote-jobs.rss');
    if (!res.ok) return [];
    const xml = await res.text();
    const jobs: RawJob[] = [];
    const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
    for (const block of itemBlocks) {
      const rawTitle = block.match(/<title>([\s\S]*?)<\/title>/)?.[1];
      const link = block.match(/<link>([\s\S]*?)<\/link>/)?.[1];
      const pubDate = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? null;
      const region = block.match(/<region>([\s\S]*?)<\/region>/)?.[1] ?? null;
      const category = block.match(/<category>([\s\S]*?)<\/category>/)?.[1] ?? null;
      if (!rawTitle || !link) continue;
      const title = decodeXmlEntities(rawTitle).trim();
      // We Work Remotely titles are formatted "Company: Job Title".
      const [company, ...rest] = title.split(': ');
      const jobTitle = rest.length ? rest.join(': ') : title;
      if (!matches(keywords, [title, category])) continue;
      jobs.push({
        title: jobTitle,
        company: rest.length ? company : null,
        location: region ? decodeXmlEntities(region).trim() : 'Remote',
        url: decodeXmlEntities(link).trim(),
        source: 'We Work Remotely',
        tags: category ? [decodeXmlEntities(category).trim()] : [],
        postedAt: pubDate,
      });
    }
    return jobs;
  } catch {
    return [];
  }
}

async function fetchJobicy(keywords: string[]): Promise<RawJob[]> {
  try {
    const tag = keywords[0] ? `&tag=${encodeURIComponent(keywords[0])}` : '';
    const res = await fetch(`https://jobicy.com/api/v2/remote-jobs?count=20${tag}`);
    if (!res.ok) return [];
    const data = (await res.json()) as { jobs?: Array<Record<string, unknown>> };
    const jobs: RawJob[] = [];
    for (const item of data.jobs ?? []) {
      const title = item.jobTitle as string;
      const industry = (item.jobIndustry as string[] | undefined) ?? [];
      if (!matches(keywords, [title, ...industry])) continue;
      jobs.push({
        title,
        company: (item.companyName as string) ?? null,
        location: (item.jobGeo as string) ?? 'Remote',
        url: item.url as string, // Jobicy's API terms require this exact original URL, never rewritten
        source: 'Jobicy',
        tags: industry,
        postedAt: (item.pubDate as string) ?? null,
      });
    }
    return jobs;
  } catch {
    return [];
  }
}

function dedupe(jobs: RawJob[]): RawJob[] {
  const seen = new Set<string>();
  const out: RawJob[] = [];
  for (const job of jobs) {
    if (seen.has(job.url)) continue;
    seen.add(job.url);
    out.push(job);
  }
  return out;
}

async function rankWithAI(
  provider: AiProviderId,
  apiKey: string,
  jobs: RawJob[],
  framing: string
): Promise<Map<number, string>> {
  const listText = jobs
    .map((j, i) => `${i + 1}. ${j.title} — ${j.company ?? 'unknown company'} (${j.location ?? 'unspecified location'})`)
    .join('\n');
  const prompt =
    `Here are job listings:\n${listText}\n\n` +
    `For someone looking for: "${framing}"\n\n` +
    'Pick up to 10 of the best-fitting ones. Respond with ONLY a JSON array like ' +
    '[{"index": 1, "note": "one short sentence on why this fits"}], using the index numbers from the list above. ' +
    'No markdown fences, no other text.';

  const rawText = await callAI(provider, apiKey, prompt);
  if (!rawText) return new Map();

  const match = rawText.match(/\[[\s\S]*\]/);
  if (!match) return new Map();

  try {
    const parsed = JSON.parse(match[0]) as { index: number; note: string }[];
    const map = new Map<number, string>();
    for (const p of parsed) {
      if (typeof p.index === 'number' && typeof p.note === 'string') map.set(p.index, p.note);
    }
    return map;
  } catch {
    return new Map();
  }
}

export async function fetchJobsForSearch(
  keywordsRaw: string,
  framing: string,
  ai: { provider: AiProviderId; apiKey: string } | null
): Promise<{ jobs: JobResult[]; error?: string }> {
  const keywords = keywordsRaw
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);

  const results = await Promise.allSettled([
    fetchRemoteOk(keywords),
    fetchArbeitnow(keywords),
    fetchWeWorkRemotely(keywords),
    fetchJobicy(keywords),
  ]);

  const raw = dedupe(
    results.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])).sort((a, b) => {
      const at = a.postedAt ? new Date(a.postedAt).getTime() : 0;
      const bt = b.postedAt ? new Date(b.postedAt).getTime() : 0;
      return bt - at;
    })
  ).slice(0, 40);

  if (raw.length === 0) {
    return { jobs: [], error: 'No matching listings found across sources — try broader keywords.' };
  }

  if (!ai) {
    return { jobs: raw.slice(0, 15).map((r) => ({ ...r, aiNote: null })) };
  }

  const ranked = await rankWithAI(ai.provider, ai.apiKey, raw, framing);
  if (ranked.size === 0) {
    return { jobs: raw.slice(0, 15).map((r) => ({ ...r, aiNote: null })) };
  }

  const jobs: JobResult[] = [];
  for (const [index, note] of ranked) {
    const job = raw[index - 1];
    if (job) jobs.push({ ...job, aiNote: note });
  }
  return { jobs };
}
