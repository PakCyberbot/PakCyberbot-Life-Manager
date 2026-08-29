// Explicit "is this AI provider actually usable right now" check — separate
// from callAI's normal text-generation calls. None of the three providers
// expose a real "remaining credits/quota" number for their free/pay-as-you-go
// tiers, so this is the closest honest equivalent: a cheap metadata request
// (list models, not generate content) that succeeds/fails the same way a
// real call would for a bad key or an exhausted quota, without spending a
// generation call just to find that out. Used by Settings' "Check now" and
// by the ambient check after any real AI call fails (see main.ts).

import type { AiProviderId } from './providers';

export interface AiHealthResult {
  ok: boolean;
  rateLimited: boolean;
  error?: string;
}

async function classify(provider: AiProviderId, res: Response): Promise<AiHealthResult> {
  if (res.ok) return { ok: true, rateLimited: false };
  const bodyText = await res.text().catch(() => '');
  const lower = bodyText.toLowerCase();
  const rateLimited = res.status === 429 || lower.includes('quota') || lower.includes('resource_exhausted') || lower.includes('rate limit');
  const message = rateLimited
    ? `${provider} usage limit reached — try again later, or check your plan/billing.`
    : bodyText.slice(0, 200) || res.statusText || `HTTP ${res.status}`;
  return { ok: false, rateLimited, error: message };
}

export async function checkAiHealth(provider: AiProviderId, apiKey: string): Promise<AiHealthResult> {
  try {
    switch (provider) {
      case 'gemini': {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        return await classify(provider, res);
      }
      case 'openai': {
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        return await classify(provider, res);
      }
      case 'anthropic': {
        const res = await fetch('https://api.anthropic.com/v1/models', {
          headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        });
        return await classify(provider, res);
      }
      default:
        return { ok: false, rateLimited: false, error: 'Unknown provider.' };
    }
  } catch (err) {
    return { ok: false, rateLimited: false, error: err instanceof Error ? err.message : 'Could not reach the provider — check your connection.' };
  }
}
