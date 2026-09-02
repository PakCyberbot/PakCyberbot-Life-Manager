// TS wrapper for the app-local native plugin at
// android/app/src/main/java/com/pakcyberbot/lifemanager/LoopbackAuthPlugin.java
// — see that file for the full rationale (RFC 8252 loopback OAuth capture,
// the same technique apps/desktop/electron/driveSync.ts uses via
// node:http, re-implemented natively since a WebView/JS context can't bind
// a raw listening socket itself).

import { registerPlugin, type Plugin, type PluginListenerHandle } from '@capacitor/core';

export interface LoopbackAuthStartResult {
  port: number;
}

export interface LoopbackAuthRedirectEvent {
  code?: string;
  error?: string;
}

export interface LoopbackAuthPlugin extends Plugin {
  /** Binds a fresh 127.0.0.1 listener and returns the port it's actually bound to. */
  start(): Promise<LoopbackAuthStartResult>;
  /** Force-closes the listener — used for the connect() timeout path. */
  stop(): Promise<void>;
  addListener(eventName: 'redirect', listenerFunc: (event: LoopbackAuthRedirectEvent) => void): Promise<PluginListenerHandle>;
}

export const LoopbackAuth = registerPlugin<LoopbackAuthPlugin>('LoopbackAuth');
