// Local notifications for Calendar events: a reminder 1 day before, and a small beep+vibration+
// notification right at the event's own time. Toggleable from Settings (see
// MobileSettingsScreen). Unlike Time Table's weekly-recurring slots, each CalendarEvent is a
// one-off dated instant, so this schedules via LocalNotifications' `schedule.at` trigger (a real
// Date, confirmed supported by the already-installed plugin version) instead of the recurring
// `on` trigger timeTableNotifications.ts uses for a weekly slot.

import { LocalNotifications, type LocalNotificationSchema } from '@capacitor/local-notifications';
import type { CalendarEvent } from '@life-manager/shared';
import { isPastEvent } from '@life-manager/shared';

// Tags every notification this feature schedules, so cancel/reschedule only ever touches its own
// notifications — same discipline as timeTableNotifications.ts's own SOURCE_TAG.
const SOURCE_TAG = 'calendarEvent';

// Android 8+ ignores a per-notification `sound` field entirely — it only ever honors one baked
// into the channel a notification is posted on, and a channel's properties (sound, vibration) are
// immutable once created on the device. No channel existed anywhere in this app before this
// feature; this is the first one. `calendar_beep.wav` is a short synthesized tone generated once
// for this feature (see android/app/src/main/res/raw/), not the device's default notification
// sound, to actually match "just a very small beep" rather than whatever's longer/louder by
// default on a given phone.
const CHANNEL_ID = 'calendarEvents';

/** Settings key (via the existing settings.get/set api, same as every other setting) — 'on'/'off'. */
export const CALENDAR_NOTIFICATIONS_SETTING_KEY = 'mobileCalendarNotifications';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Same djb2-style deterministic string hash as timeTableNotifications.ts's own
 * slotNotificationId — duplicated here rather than factored out, matching this app's existing
 * precedent for small per-file pure helpers (e.g. EVENT_COLOR_CLASS/parseTime, each already kept
 * in sync manually rather than shared). Masked to a positive 31-bit int (Android's valid
 * notification-id range). Called with a suffixed id (`${event.id}:before` / `:at`) so an event's
 * two notifications get distinct, independently-replaceable ids. */
function notificationIdFromString(s: string): number {
  let hash = 5381;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 33) ^ s.charCodeAt(i);
  }
  return Math.abs(hash) % 0x7fffffff;
}

async function ensureChannel(): Promise<void> {
  // Idempotent — creating a channel with an id that already exists on the device is a safe no-op,
  // so this can just run every time this feature schedules rather than needing its own "has this
  // run before" tracking.
  await LocalNotifications.createChannel({
    id: CHANNEL_ID,
    name: 'Calendar events',
    description: 'A day-before reminder and an at-time alert for Calendar events.',
    importance: 4,
    vibration: true,
    sound: 'calendar_beep.wav',
  });
}

async function cancelBySource(): Promise<void> {
  const pending = await LocalNotifications.getPending();
  const ours = pending.notifications.filter((n) => n.extra?.source === SOURCE_TAG);
  if (ours.length > 0) {
    await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) });
  }
}

/** Requests notification permission (if not already granted), creates the dedicated channel if
 * needed, and replaces every previously-scheduled Calendar notification with a fresh pair
 * (1-day-before + at-time) per still-future event. Already-past events are skipped outright
 * (same `isPastEvent` from packages/shared the Upcoming/Archived split uses, so "what's worth
 * notifying about" can't drift from "what's still upcoming"); the 1-day-before reminder for an
 * event already less than 24h away is skipped on its own even when the event itself still gets
 * its at-time notification — Capacitor would otherwise fire a notification whose `at` time has
 * already passed immediately on schedule, which isn't the intent of "1 day remaining". Returns
 * false (and schedules nothing) if permission is denied. */
// Both notifications below are scheduled with `isExactNotification: false`, deliberately — real
// bug found via live CDP debugging: `schedule()` defaults every notification's exactness to
// `true`, and on Android 12+ without the separate "Alarms & reminders" special-access permission
// (never granted by default, and POST_NOTIFICATIONS being granted doesn't imply it), the plugin
// internally redirects to that system settings screen before scheduling anything — silently, with
// no error, no timeout, and no visible UI change from the app's own side (the Settings card just
// stays on "Updating…" forever). Confirmed exactly this: `LocalNotifications.schedule()` called
// directly never resolved until that settings toggle was flipped by hand. A day-before/at-time
// Calendar reminder has no real need for to-the-second precision the way an alarm clock does — an
// inexact alarm still fires close to its target time and needs no extra permission or screen at
// all, so this sidesteps the whole gap rather than adding a second permission flow for it.
export async function scheduleCalendarNotifications(events: CalendarEvent[]): Promise<boolean> {
  const permission = await LocalNotifications.requestPermissions();
  if (permission.display !== 'granted') return false;

  await ensureChannel();
  await cancelBySource();

  const now = new Date();
  const notifications: LocalNotificationSchema[] = [];

  for (const e of events) {
    if (isPastEvent(e, now)) continue;
    const startMs = new Date(e.startAt).getTime();
    if (Number.isNaN(startMs)) continue;

    const beforeMs = startMs - DAY_MS;
    if (beforeMs > now.getTime()) {
      const timeSuffix = e.allDay
        ? ''
        : ` at ${new Date(startMs).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
      notifications.push({
        id: notificationIdFromString(`${e.id}:before`),
        title: '1 day to go',
        body: `${e.title}${timeSuffix}`,
        channelId: CHANNEL_ID,
        extra: { source: SOURCE_TAG },
        isExactNotification: false,
        schedule: { at: new Date(beforeMs), allowWhileIdle: true },
      });
    }

    notifications.push({
      id: notificationIdFromString(`${e.id}:at`),
      title: e.title,
      body: 'Happening now.',
      channelId: CHANNEL_ID,
      extra: { source: SOURCE_TAG },
      isExactNotification: false,
      schedule: { at: new Date(startMs), allowWhileIdle: true },
    });
  }

  if (notifications.length > 0) {
    await LocalNotifications.schedule({ notifications });
  }
  return true;
}

/** Cancels every Calendar notification — used when the Settings toggle is turned off. */
export async function cancelCalendarNotifications(): Promise<void> {
  await cancelBySource();
}
