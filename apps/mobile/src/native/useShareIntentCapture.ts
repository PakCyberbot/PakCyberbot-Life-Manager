import { useEffect } from 'react';
import { useVideosStore, useWebLinksStore } from '@life-manager/core';
import { ShareIntent } from './shareIntent';
import type { MobileScreenId } from '../navigation';

const YOUTUBE_HOSTS = ['youtube.com', 'youtu.be'];

function isYouTubeUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return YOUTUBE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

async function handleSharedText(text: string, onNavigate: (s: MobileScreenId) => void) {
  // A share's EXTRA_TEXT is often more than a bare URL (e.g. a title + link, or a whole sentence) —
  // pull the first URL out of it rather than requiring the text to be exactly one.
  const match = text.match(/https?:\/\/\S+/);
  if (!match) return;
  const url = match[0];

  if (isYouTubeUrl(url)) {
    await useVideosStore.getState().addVideo({ url, kind: 'video' });
  } else {
    await useWebLinksStore.getState().addWebLink(url);
  }
  // Landing on Library with the freshly-added item visible at the top *is* the confirmation —
  // no toast plugin needed for "did this actually work".
  onNavigate('library');
}

/** Wires up Android share-sheet capture (see ShareIntentPlugin.java) — call once, near the app root.
 * Covers both a cold start (the app was launched by the share) and a share arriving while already
 * running (MainActivity's launchMode="singleTask" routes it through the same activity instance). A
 * shared YouTube link lands in Video Library, any other link lands in Web Links. */
export function useShareIntentCapture(onNavigate: (s: MobileScreenId) => void) {
  useEffect(() => {
    let cancelled = false;

    ShareIntent.getInitialSharedText().then(({ text }) => {
      if (!cancelled && text) void handleSharedText(text, onNavigate);
    });

    const listenerPromise = ShareIntent.addListener('shared', ({ text }) => {
      if (text) void handleSharedText(text, onNavigate);
    });

    return () => {
      cancelled = true;
      void listenerPromise.then((handle) => handle.remove());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
