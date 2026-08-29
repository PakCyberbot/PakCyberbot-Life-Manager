// Food & Nutrition info — generated shortly after a food is added, same
// async-enrichment pattern as Entertainment's verdict (row appears
// immediately, fields populate a moment later).

import { callAI, type AiProviderId } from './providers';

export interface FoodInfoResult {
  benefits: string;
  caloriesEstimate: string;
  considerations: string;
}

function buildPrompt(name: string, quantity: string): string {
  return (
    `Give nutritional info for this food: "${name}", quantity: "${quantity}".\n\n` +
    'Respond with ONLY a JSON object with exactly these fields:\n' +
    '{\n' +
    '  "benefits": "1-2 sentences on genuine nutritional/health benefits",\n' +
    '  "caloriesEstimate": "a realistic estimate for this exact quantity, e.g. \'250 kcal\'",\n' +
    '  "considerations": "1 short sentence on moderation/caution if relevant (e.g. sugar, sodium, allergens), or \'None notable\' otherwise"\n' +
    '}\n' +
    'No markdown fences, no other text.'
  );
}

export async function generateFoodInfo(
  provider: AiProviderId,
  apiKey: string,
  name: string,
  quantity: string
): Promise<FoodInfoResult | null> {
  const rawText = await callAI(provider, apiKey, buildPrompt(name, quantity));
  if (!rawText) return null;

  const match = rawText.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[0]) as Partial<FoodInfoResult>;
    if (!parsed.benefits) return null;
    return {
      benefits: parsed.benefits,
      caloriesEstimate: parsed.caloriesEstimate ?? 'Unknown',
      considerations: parsed.considerations ?? 'None notable',
    };
  } catch {
    return null;
  }
}
