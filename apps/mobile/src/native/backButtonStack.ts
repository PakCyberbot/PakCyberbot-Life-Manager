import { useEffect } from 'react';

// Android's hardware/gesture back button previously did nothing useful anywhere in this app —
// there was no listener registered at all for @capacitor/app's 'backButton' event, so it fell
// through to Capacitor's own default (exit/minimize the app, since this is a single-page app with
// no real WebView navigation history for it to step back through). That broke back from *every*
// full-screen overlay this app has — the PDF reader most visibly, but also Goals' own goal-detail
// view — not just top-level screen navigation.
//
// This is a small LIFO stack of "back handlers": any component that renders something the
// hardware back button should dismiss (a full-screen overlay, a nested detail view) registers one
// while it's mounted/active via useBackHandler below. App.tsx's own 'backButton' listener runs
// runBackHandlers() first — whichever handler was registered *most recently* gets first say, so a
// PDF reader opened from inside a Goals detail view, say, closes before the detail view does, the
// same "topmost thing first" order a real back stack would give. Only once nothing in the stack
// claims the press does App.tsx fall through to its own top-level screen-navigation rule.
type BackHandler = () => boolean;

const stack: BackHandler[] = [];

export function runBackHandlers(): boolean {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i]()) return true;
  }
  return false;
}

/** Registers `handler` while the calling component considers itself "active" (pass null/undefined
 * to temporarily not claim the back button without unmounting, e.g. a dialog that's rendered but
 * closed). `handler` returning true means "I handled this back press, stop here"; false lets it
 * fall through to whatever's beneath it in the stack (or App.tsx's top-level fallback). */
export function useBackHandler(handler: BackHandler | null | undefined): void {
  useEffect(() => {
    if (!handler) return;
    stack.push(handler);
    return () => {
      const idx = stack.lastIndexOf(handler);
      if (idx !== -1) stack.splice(idx, 1);
    };
  }, [handler]);
}
