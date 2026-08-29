// Entertainment "worth your time" verdicts — the feature framework.md §6 was
// originally written for. Grounded in the user's own stated criteria from
// that file (not a generic model opinion), when it can be found; degrades to
// a generic framing otherwise rather than failing outright.

import { callAI, type AiProviderId } from './providers';
import { extractFrameworkSection, readFrameworkFile } from './framework';

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
  const content = readFrameworkFile();
  if (!content) return null;
  return extractFrameworkSection(content, /## 6\. Entertainment & Leisure Rules[\s\S]*?(?=\n## \d|\n---|\s*$)/);
}

function buildPrompt(title: string, type: string, customPrompt: string | null): string {
  const frameworkSection = readFrameworkEntertainmentSection();
  let context = frameworkSection
    ? `Here is the user's own stated criteria for what makes entertainment worth their time — ground your verdict in THIS, not generic assumptions:\n\n${frameworkSection}\n\n`
    : '';
  if (customPrompt?.trim()) {
    context += `The user has also set this additional criteria in the app's Settings — weigh it alongside the above:\n\n${customPrompt.trim()}\n\n`;
  }

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
  type: string,
  customPrompt: string | null
): Promise<EntertainmentVerdictResult | null> {
  const rawText = await callAI(provider, apiKey, buildPrompt(title, type, customPrompt));
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
