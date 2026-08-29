// Explicit "is this AI provider actually usable right now" check — goes
// through the *exact same* callAI path every real AI feature uses, not a
// lighter metadata endpoint (e.g. GET /models). That lighter path was tried
// first and found to be misleading: live-tested against a Gemini key whose
// real generation quota was exhausted (confirmed via a genuine
// entertainment-verdict call failing with 429 "You exceeded your current
// quota"), GET /models still returned 200 — Gemini clearly meters
// generateContent and models.list separately, so checking the metadata
// endpoint reported "OK" for a provider that was, in the way that actually
// matters to every AI feature in this app, not okay. A tiny real completion
// costs a sliver of the same quota real usage does, but no provider exposes
// a real "remaining credits" number — this is the closest honest
// equivalent: does a real call go through right now.

import { callAI, getLastAiError, type AiProviderId } from './providers';

export interface AiHealthResult {
  ok: boolean;
  rateLimited: boolean;
  error?: string;
}

export async function checkAiHealth(provider: AiProviderId, apiKey: string): Promise<AiHealthResult> {
  const result = await callAI(provider, apiKey, 'Reply with only the single word: OK');
  if (result) return { ok: true, rateLimited: false };

  const err = getLastAiError();
  if (err && err.provider === provider) {
    return {
      ok: false,
      rateLimited: err.rateLimited,
      error: err.rateLimited ? `${provider} usage limit reached — try again later, or check your plan/billing.` : err.message,
    };
  }
  return { ok: false, rateLimited: false, error: 'Could not reach the provider — check your connection.' };
}
