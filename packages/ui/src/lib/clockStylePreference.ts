// Which Time Table clock face to render — a per-device visual preference, same category as theme
// (packages/ui/src/theme/ThemeProvider.tsx), so it lives in localStorage the same way rather than
// going through packages/core's SQLite-backed settings (which is for data meant to sync via Drive).
// Uses useSyncExternalStore + a tiny module-level pub/sub (not React Context, since this only ever
// needs to reach two independent screens — Settings and Time Table — never nested consumers) so a
// change in one mounted instance is reflected immediately in any other, no reload needed.

import { useSyncExternalStore } from 'react';

export type ClockStyle = 'classic' | 'liveRotating';

const STORAGE_KEY = 'life-manager:timeTableClockStyle';
const listeners = new Set<() => void>();

function getSnapshot(): ClockStyle {
  if (typeof window === 'undefined') return 'classic';
  return localStorage.getItem(STORAGE_KEY) === 'liveRotating' ? 'liveRotating' : 'classic';
}

function getServerSnapshot(): ClockStyle {
  return 'classic';
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setClockStyle(style: ClockStyle): void {
  localStorage.setItem(STORAGE_KEY, style);
  listeners.forEach((l) => l());
}

export function useClockStyle(): [ClockStyle, (style: ClockStyle) => void] {
  const style = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return [style, setClockStyle];
}
