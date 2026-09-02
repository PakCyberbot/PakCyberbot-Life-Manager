// Local notifications for Time Table slots — "your scheduled thing is
// starting" — toggleable from Settings (see MobileSettingsScreen). Each
// TimeSlot repeats weekly (same model as desktop's Time Table, see
// structure.md), so each gets one *recurring* notification via
// LocalNotifications' `schedule.on` trigger rather than a one-off `at` time.

import { LocalNotifications, Weekday } from '@capacitor/local-notifications';
import type { TimeSlot } from '@life-manager/shared';

// Tags every notification this feature schedules, so cancel/reschedule only
// ever touches its own notifications — never anything another feature might
// schedule later (e.g. a doctor-appointment reminder).
const SOURCE_TAG = 'timeTable';

/** Settings key (via the existing settings.get/set api, same as every other setting) — 'on'/'off'. */
export const TIME_TABLE_NOTIFICATIONS_SETTING_KEY = 'mobileTimeTableNotifications';

/** Stable per-slot notification id — Android notification ids are 32-bit ints,
 * TimeSlot.id is a UUID string. A simple deterministic hash (djb2) so the same
 * slot always maps to the same id, letting a reschedule cleanly replace rather
 * than duplicate. Masked to a positive 31-bit int (Android's valid range). */
export function slotNotificationId(slotId: string): number {
  let hash = 5381;
  for (let i = 0; i < slotId.length; i++) {
    hash = (hash * 33) ^ slotId.charCodeAt(i);
  }
  return Math.abs(hash) % 0x7fffffff;
}

function parseTime(hhmm: string): { hour: number; minute: number } {
  const [hour, minute] = hhmm.split(':').map(Number);
  return { hour, minute };
}

async function cancelBySource(): Promise<void> {
  const pending = await LocalNotifications.getPending();
  const ours = pending.notifications.filter((n) => n.extra?.source === SOURCE_TAG);
  if (ours.length > 0) {
    await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) });
  }
}

/** Requests notification permission (if not already granted) and, if granted, replaces every
 * previously-scheduled Time Table notification with a fresh one per slot. Returns false (and
 * schedules nothing) if permission is denied. */
export async function scheduleTimeTableNotifications(slots: TimeSlot[]): Promise<boolean> {
  const permission = await LocalNotifications.requestPermissions();
  if (permission.display !== 'granted') return false;

  await cancelBySource();

  if (slots.length === 0) return true;

  await LocalNotifications.schedule({
    notifications: slots.map((slot) => {
      const { hour, minute } = parseTime(slot.startTime);
      return {
        id: slotNotificationId(slot.id),
        title: slot.label,
        body: slot.notes?.trim() || 'Starting now — check your Time Table.',
        extra: { source: SOURCE_TAG },
        schedule: {
          on: { weekday: (slot.dayOfWeek + 1) as Weekday, hour, minute },
          allowWhileIdle: true,
        },
      };
    }),
  });
  return true;
}

/** Cancels every Time Table notification — used when the Settings toggle is turned off. */
export async function cancelTimeTableNotifications(): Promise<void> {
  await cancelBySource();
}
