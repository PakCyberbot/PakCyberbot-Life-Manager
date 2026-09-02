// Trimmed mobile port of apps/desktop/electron/ai/providers.ts's callAI —
// same three plain-fetch REST dispatches (Gemini/OpenAI/Anthropic), pure Web
// APIs, ported near-verbatim since mobile already has CapacitorHttp enabled
// for cross-origin fetch (see capacitor.config.ts). Drops desktop's
// lastError/getLastAiError tracking — that backs the desktop-only AI status
// panel (ai/health.ts), which mobile doesn't have and isn't adding here;
// mobile's ai.getStatus/checkStatus stay the existing "not available" stubs.
//
// Model names below are current as of this writing but WILL go stale — keep
// in sync with apps/desktop/electron/ai/providers.ts's own constants if one
// provider starts failing there.

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

async function callGemini(apiKey: string, prompt: string): Promise<string | null> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as GeminiResponse;
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? null;
}

async function callOpenAI(apiKey: string, prompt: string): Promise<string | null> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: OPENAI_MODEL, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as OpenAiResponse;
  return data.choices?.[0]?.message?.content ?? null;
}

async function callAnthropic(apiKey: string, prompt: string): Promise<string | null> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: 1024, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as AnthropicResponse;
  return data.content?.map((c) => c.text ?? '').join('') ?? null;
}

/** Returns the model's raw text reply, or null on any failure — callers degrade gracefully, never throw. */
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
  } catch {
    return null;
  }
}
