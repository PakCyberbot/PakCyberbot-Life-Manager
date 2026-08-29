// Entertainment "worth your time" verdicts — the feature framework.md §6 was
// originally written for. Grounded in the user's own stated criteria from
// that file (not a generic model opinion), when it can be found; degrades to
// a generic framing otherwise rather than failing outright.

import fs from 'node:fs';
import path from 'node:path';
import { callAI, type AiProviderId } from './providers';

export interface EntertainmentVerdictResult {
  verdict: 'Worth It' | 'Mixed' | 'Skip';
  reasoning: string;
  skillsImproved: string;
  benefits: string;
  timeCostEstimate: string;
  addictiveness: 'low' | 'medium' | 'high';
  mentalEffects: string;
}

/** Pulls just the "Entertainment & Leisure Rules" section out of framework.md, if present. */
function readFrameworkEntertainmentSection(): string | null {
  // framework.md lives at the repo root. Vite bundles every local main-process
  // module (this file included) into one flat apps/desktop/out/main/index.js,
  // so __dirname here is the same out/main/ directory main.ts sees — same
  // "../../resources/icon.ico"-style relative path pattern used there, just
  // one level further up to reach the repo root instead of apps/desktop/.
  const candidatePaths = [path.join(__dirname, '../../../framework.md'), path.join(process.cwd(), 'framework.md')];
  for (const p of candidatePaths) {
    try {
      const content = fs.readFileSync(p, 'utf-8');
      const match = content.match(/## 6\. Entertainment & Leisure Rules[\s\S]*?(?=\n## \d|\n---|\s*$)/);
      if (match) return match[0].trim();
    } catch {
      // try next candidate
    }
  }
  return null;
}

function buildPrompt(title: string, type: string): string {
  const frameworkSection = readFrameworkEntertainmentSection();
  const context = frameworkSection
    ? `Here is the user's own stated criteria for what makes entertainment worth their time — ground your verdict in THIS, not generic assumptions:\n\n${frameworkSection}\n\n`
    : '';

  return (
    `You are helping evaluate whether spending time on "${title}" (a ${type}) is worthwhile.\n\n${context}` +
    'Give your assessment as ONLY a JSON object with exactly these fields:\n' +
    '{\n' +
    '  "verdict": "Worth It" | "Mixed" | "Skip",\n' +
    '  "reasoning": "2-3 sentences explaining the verdict",\n' +
    '  "skillsImproved": "comma-separated skills this could realistically build, or \'None notable\' if purely recreational",\n' +
    '  "benefits": "1-2 sentences on genuine benefits (relaxation, social, creative, educational, etc.)",\n' +
    '  "timeCostEstimate": "a realistic estimate, e.g. \'8-12 hours\' or \'2 hours\' or \'20+ hours if you get into it\'",\n' +
    '  "addictiveness": "low" | "medium" | "high",\n' +
    '  "mentalEffects": "1-2 sentences on likely positive/negative effects on mood or mind from typical engagement"\n' +
    '}\n' +
    'No markdown fences, no other text.'
  );
}

export async function generateEntertainmentVerdict(
  provider: AiProviderId,
  apiKey: string,
  title: string,
  type: string
): Promise<EntertainmentVerdictResult | null> {
  const rawText = await callAI(provider, apiKey, buildPrompt(title, type));
  if (!rawText) return null;

  const match = rawText.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[0]) as Partial<EntertainmentVerdictResult>;
    if (!parsed.verdict || !parsed.reasoning) return null;
    return {
      verdict: parsed.verdict,
      reasoning: parsed.reasoning,
      skillsImproved: parsed.skillsImproved ?? 'Unknown',
      benefits: parsed.benefits ?? '',
      timeCostEstimate: parsed.timeCostEstimate ?? 'Unknown',
      addictiveness: parsed.addictiveness ?? 'medium',
      mentalEffects: parsed.mentalEffects ?? '',
    };
  } catch {
    return null;
  }
}
