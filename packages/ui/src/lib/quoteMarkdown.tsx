import { Fragment, type ReactNode } from 'react';

// A tiny, dependency-free markdown-ish renderer for quotes/reminders — just enough for a short
// personal note to read nicely (bold/italic/code emphasis, real line breaks), not a general CMS.
// Deliberately not a full markdown library: same "hand-rolled regex over a real dependency"
// discipline this app already uses for web-preview og:tag extraction and RSS parsing (see
// LibraryScreen's Web Links / ai/news.ts), consistent with how little markup a quote ever
// actually needs. Builds real React nodes rather than using dangerouslySetInnerHTML — no HTML-
// injection surface, even though this is always just the user's own locally-entered text.

const INLINE_PATTERN = /(\*\*.+?\*\*|__.+?__|\*.+?\*|_.+?_|`.+?`)/g;

function renderInline(line: string, keyPrefix: string): ReactNode {
  if (!line) return line;
  const parts = line.split(INLINE_PATTERN).filter((part) => part !== '');
  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    // Order matters: bold (** / __) is checked before italic (* / _), so "**bold**" isn't eaten
    // by the single-character italic rule first.
    if (/^\*\*.+\*\*$/.test(part) || /^__.+__$/.test(part)) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    if (/^\*.+\*$/.test(part) || /^_.+_$/.test(part)) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    if (/^`.+`$/.test(part)) {
      return (
        <code key={key} className="rounded bg-background px-1 py-0.5 text-[0.9em]">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <Fragment key={key}>{part}</Fragment>;
  });
}

/** Renders a quote's raw text as React nodes: real line breaks for every `\n`, plus `**bold**`,
 * `*italic*`/`_italic_`, and `` `code` `` inline emphasis. */
export function renderQuoteMarkdown(text: string): ReactNode {
  const lines = text.split('\n');
  return lines.map((line, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {renderInline(line, String(i))}
    </Fragment>
  ));
}
