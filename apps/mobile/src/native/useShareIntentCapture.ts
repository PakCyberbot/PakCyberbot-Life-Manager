import { useEffect, useState } from 'react';
import { useVideosStore, useWebLinksStore } from '@life-manager/core';
import type { WebLinkReadLength } from '@life-manager/shared';
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

export interface PendingWebLinkShare {
  url: string;
}

/** Wires up Android share-sheet capture (see ShareIntentPlugin.java) — call once, near the app
 * root. Covers both a cold start (the app was launched by the share) and a share arriving while
 * already running (MainActivity's launchMode="singleTask" routes it through the same activity
 * instance). A shared YouTube link lands straight in Video Library — nothing to ask there. Any
 * other link is a Web Link, which now has a Short/Long Read category to pick (see
 * MobileLibraryScreen.tsx) — rather than silently defaulting one, this surfaces
 * `pendingWebLinkShare` so App.tsx can render a real "which one?" prompt before the row is ever
 * created, exactly per the ask: sharing into this app should ask, not guess. */
export function useShareIntentCapture(onNavigate: (s: MobileScreenId) => void) {
  const [pendingWebLinkShare, setPendingWebLinkShare] = useState<PendingWebLinkShare | null>(null);

  useEffect(() => {
    let cancelled = false;

    const handleSharedText = (text: string) => {
      // A share's EXTRA_TEXT is often more than a bare URL (e.g. a title + link, or a whole
      // sentence) — pull the first URL out of it rather than requiring the text to be exactly one.
      const match = text.match(/https?:\/\/\S+/);
      if (!match) return;
      const url = match[0];

      if (isYouTubeUrl(url)) {
        void useVideosStore.getState().addVideo({ url, kind: 'video' }).then(() => onNavigate('library'));
      } else {
        setPendingWebLinkShare({ url });
      }
    };

    ShareIntent.getInitialSharedText().then(({ text }) => {
      if (!cancelled && text) handleSharedText(text);
    });

    const listenerPromise = ShareIntent.addListener('shared', ({ text }) => {
      if (text) handleSharedText(text);
    });

    return () => {
      cancelled = true;
      void listenerPromise.then((handle) => handle.remove());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resolvePendingWebLinkShare = async (readLength: WebLinkReadLength) => {
    if (!pendingWebLinkShare) return;
    const { url } = pendingWebLinkShare;
    setPendingWebLinkShare(null);
    await useWebLinksStore.getState().addWebLink(url, undefined, undefined, readLength);
    // Landing on Library with the freshly-added item visible at the top *is* the confirmation —
    // no toast plugin needed for "did this actually work".
    onNavigate('library');
  };

  const dismissPendingWebLinkShare = () => setPendingWebLinkShare(null);

  return { pendingWebLinkShare, resolvePendingWebLinkShare, dismissPendingWebLinkShare };
}
