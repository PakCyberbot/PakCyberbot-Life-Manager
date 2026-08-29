// Multi-provider AI text calls — every provider is used via its own API key,
// the only officially supported integration path for a third-party app like
// this one. There is no legitimate way to authenticate against a ChatGPT
// Plus or Claude Pro/Max *subscription* from outside OpenAI's/Anthropic's own
// apps (OpenAI bills API usage separately from ChatGPT Plus by design;
// Claude's subscription access is scoped to Anthropic's own products,
// including Claude Code, which is what built this file). Reverse-engineering
// either web app's session to fake that would violate their Terms of
// Service and risk the user's account — not something this app will do.
//
// Model names below are current as of this writing but WILL go stale —
// Gemini's own API told us mid-development that gemini-2.5-flash had been
// retired in favor of gemini-3.6-flash. If a provider starts failing, that's
// the first thing to check; update the constant, nothing else should need to
// change.

export type AiProviderId = 'gemini' | 'openai' | 'anthropic';

const GEMINI_MODEL = 'gemini-3.6-flash';
const OPENAI_MODEL = 'gpt-4o-mini';
const ANTHROPIC_MODEL = 'claude-sonnet-4-5';

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

interface OpenAiResponse {
  choices?: { message?: { content?: string } }[];
}

interface AnthropicResponse {
  content?: { text?: string }[];
}

// --- Last-call error tracking -------------------------------------------------
// callAI's public contract (string | null) is relied on by every AI feature
// across the codebase and deliberately stays that way — changing it would
// ripple through News/Entertainment/Earning Ways/Jobs/Food. Instead, each
// provider function records the *reason* for a failure here on every call
// (cleared on success), so a caller who wants to know *why* the last call
// failed — specifically main.ts's AI status check — can ask separately
// without every other caller needing to change. See ai/health.ts.

export interface AiCallError {
  provider: AiProviderId;
  status: number;
  message: string;
  /** True if this looks like a quota/rate-limit failure rather than a bad key, network issue, etc. */
  rateLimited: boolean;
  at: string;
}

let lastError: AiCallError | null = null;

export function getLastAiError(): AiCallError | null {
  return lastError;
}

function looksRateLimited(status: number, bodyText: string): boolean {
  if (status === 429) return true;
  const lower = bodyText.toLowerCase();
  return lower.includes('quota') || lower.includes('resource_exhausted') || lower.includes('rate limit') || lower.includes('rate_limit');
}

async function recordFailure(provider: AiProviderId, res: Response): Promise<void> {
  const bodyText = await res.text().catch(() => '');
  lastError = {
    provider,
    status: res.status,
    message: bodyText.slice(0, 300) || res.statusText || `HTTP ${res.status}`,
    rateLimited: looksRateLimited(res.status, bodyText),
    at: new Date().toISOString(),
  };
}

async function callGemini(apiKey: string, prompt: string): Promise<string | null> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );
  if (!res.ok) {
    await recordFailure('gemini', res);
    return null;
  }
  lastError = null;
  const data = (await res.json()) as GeminiResponse;
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? null;
}

async function callOpenAI(apiKey: string, prompt: string): Promise<string | null> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: OPENAI_MODEL, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) {
    await recordFailure('openai', res);
    return null;
  }
  lastError = null;
  const data = (await res.json()) as OpenAiResponse;
  return data.choices?.[0]?.message?.content ?? null;
}

async function callAnthropic(apiKey: string, prompt: string): Promise<string | null> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: 1024, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) {
    await recordFailure('anthropic', res);
    return null;
  }
  lastError = null;
  const data = (await res.json()) as AnthropicResponse;
  return data.content?.map((c) => c.text ?? '').join('') ?? null;
}

/** Returns the model's raw text reply, or null on any failure (bad key, rate limit, network, etc.) — callers should degrade gracefully, never throw the user out of a flow over an optional AI feature. */
export async function callAI(provider: AiProviderId, apiKey: string, prompt: string): Promise<string | null> {
  try {
    switch (provider) {
      case 'gemini':
        return await callGemini(apiKey, prompt);
      case 'openai':
        return await callOpenAI(apiKey, prompt);
      case 'anthropic':
        return await callAnthropic(apiKey, prompt);
      default:
        return null;
    }
  } catch (err) {
    lastError = {
      provider,
      status: 0,
      message: err instanceof Error ? err.message : 'Network error',
      rateLimited: false,
      at: new Date().toISOString(),
    };
    return null;
  }
}
