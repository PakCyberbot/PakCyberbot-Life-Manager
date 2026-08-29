// Shared helper for reading framework.md as AI grounding context — used by
// both the Entertainment verdict and Earning Ways suggestions.

import fs from 'node:fs';
import path from 'node:path';

/** Reads framework.md's full content, or null if it genuinely can't be found. */
export function readFrameworkFile(): string | null {
  // Two different layouts to find framework.md in, tried in order:
  // 1. Dev/unpackaged: it lives at the repo root. Vite bundles every local
  //    main-process module into one flat apps/desktop/out/main/index.js, so
  //    __dirname here is the same out/main/ directory main.ts sees — same
  //    "../../resources/icon.ico" relative-path pattern used there, just one
  //    level further up to reach the repo root instead of apps/desktop/.
  // 2. Packaged (electron-builder): copied in via the "extraResources" build
  //    config entry, landing next to app.asar as resources/framework.md —
  //    process.resourcesPath points there. Doesn't exist at all pre-package,
  //    so this candidate harmlessly fails until a build actually produces it.
  const candidatePaths = [
    path.join(__dirname, '../../../framework.md'),
    path.join(process.cwd(), 'framework.md'),
    path.join(process.resourcesPath ?? '', 'framework.md'),
  ];
  for (const p of candidatePaths) {
    try {
      return fs.readFileSync(p, 'utf-8');
    } catch {
      // try next candidate
    }
  }
  return null;
}

/** Extracts a single "## N. Heading" section's body from framework.md's content, up to the next "## " heading. */
export function extractFrameworkSection(content: string, headingPattern: RegExp): string | null {
  const match = content.match(headingPattern);
  return match ? match[0].trim() : null;
}
