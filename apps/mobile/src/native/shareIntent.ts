// TS wrapper for the app-local native plugin at
// android/app/src/main/java/com/pakcyberbot/lifemanager/ShareIntentPlugin.java
// — see that file for the full rationale (captures Android's own Share
// sheet for plain-text/URL shares).

import { registerPlugin, type Plugin, type PluginListenerHandle } from '@capacitor/core';

export interface ShareIntentTextEvent {
  text: string | null;
}

export interface ShareIntentPlugin extends Plugin {
  /** The shared text the app was cold-started with, or { text: null } if it wasn't launched via a share. */
  getInitialSharedText(): Promise<ShareIntentTextEvent>;
  addListener(eventName: 'shared', listenerFunc: (event: ShareIntentTextEvent) => void): Promise<PluginListenerHandle>;
}

export const ShareIntent = registerPlugin<ShareIntentPlugin>('ShareIntent');
