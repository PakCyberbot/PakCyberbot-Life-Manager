// Earning Ways — AI-suggested income-stream ideas, and an on-demand A-Z guide
// per idea. Same discipline as News & Entertainment: the AI is never asked
// for a URL (resources are requested as names/platforms, not links, to avoid
// the hallucinated-link problem found while building News & Updates).

import { callAI, type AiProviderId } from './providers';
import { extractFrameworkSection, readFrameworkFile } from './framework';

export interface EarningWaySuggestion {
  title: string;
  category: string;
  rationale: string;
}

export interface EarningWayGuide {
  overview: string;
  gettingStartedSteps: string;
  skillsNeeded: string;
  toolsPlatforms: string;
  timelineExpectation: string;
  incomePotential: string;
  commonPitfalls: string;
  resources: string;
}

function readFrameworkEarningContext(): string | null {
  const content = readFrameworkFile();
  if (!content) return null;
  const values = extractFrameworkSection(content, /## 1\. Core Values & Priorities[\s\S]*?(?=\n## \d|\n---|\s*$)/);
  const skills = extractFrameworkSection(content, /## 5\. Skill & Learning Framework[\s\S]*?(?=\n## \d|\n---|\s*$)/);
  return [values, skills].filter(Boolean).join('\n\n') || null;
}

export async function suggestEarningWays(
  provider: AiProviderId,
  apiKey: string,
  activeGoalTitles: string[]
): Promise<EarningWaySuggestion[] | null> {
  const frameworkContext = readFrameworkEarningContext();
  let context = '';
  if (frameworkContext) context += `The person's stated values and how they approach learning/skills:\n\n${frameworkContext}\n\n`;
  if (activeGoalTitles.length) context += `Their current active goals: ${activeGoalTitles.join(', ')}.\n\n`;

  const prompt =
    `Suggest realistic ways to earn money, tailored to this person where possible.\n\n${context}` +
    'Give ONLY a JSON array of up to 6 ideas, each an object with exactly these fields:\n' +
    '{"title": "short name", "category": "freelance" | "job" | "business" | "investment" | "passive" | "other", ' +
    '"rationale": "one sentence on why this could fit them"}\n' +
    'No markdown fences, no other text.';

  const rawText = await callAI(provider, apiKey, prompt);
  if (!rawText) return null;

  const match = rawText.match(/\[[\s\S]*\]/);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[0]) as EarningWaySuggestion[];
    return parsed.filter((s) => s.title && s.category);
  } catch {
    return null;
  }
}

export async function generateEarningWayGuide(
  provider: AiProviderId,
  apiKey: string,
  title: string,
  category: string
): Promise<EarningWayGuide | null> {
  const prompt =
    `Write a complete, honest, beginner-to-practical guide for earning money via: "${title}" (category: ${category}).\n\n` +
    'Give ONLY a JSON object with exactly these fields:\n' +
    '{\n' +
    '  "overview": "2-3 sentences on what this actually is/involves",\n' +
    '  "gettingStartedSteps": "the first concrete actions to take, as a newline-separated numbered list in one string",\n' +
    '  "skillsNeeded": "comma-separated skills/tools required, roughly in order of importance",\n' +
    '  "toolsPlatforms": "comma-separated platforms/tools/services commonly used for this — real, well-known ones by name only, no links",\n' +
    '  "timelineExpectation": "realistic time to first income and to meaningful income, honestly",\n' +
    '  "incomePotential": "a realistic income range, being honest about typical vs. best-case outcomes",\n' +
    '  "commonPitfalls": "newline-separated list of common mistakes or failure modes",\n' +
    '  "resources": "newline-separated list of specific resources (course/book/community names) worth looking into — names only, not URLs, since this app never asks an AI to produce a link"\n' +
    '}\n' +
    'No markdown fences, no other text.';

  const rawText = await callAI(provider, apiKey, prompt);
  if (!rawText) return null;

  const match = rawText.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[0]) as Partial<EarningWayGuide>;
    if (!parsed.overview) return null;
    return {
      overview: parsed.overview,
      gettingStartedSteps: parsed.gettingStartedSteps ?? '',
      skillsNeeded: parsed.skillsNeeded ?? '',
      toolsPlatforms: parsed.toolsPlatforms ?? '',
      timelineExpectation: parsed.timelineExpectation ?? '',
      incomePotential: parsed.incomePotential ?? '',
      commonPitfalls: parsed.commonPitfalls ?? '',
      resources: parsed.resources ?? '',
    };
  } catch {
    return null;
  }
}
