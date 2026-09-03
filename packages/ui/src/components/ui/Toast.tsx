import { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

/** A small fixed-position banner that auto-dismisses after `durationMs` (default 5s) — built
 * specifically for Auto Sync's "couldn't reach Google Drive at startup" notice (see
 * useSettingsStore's autoSyncEnabled and both apps' App.tsx), the only place in either app that
 * currently needs a transient, non-blocking notification. Renders nothing when `message` is null,
 * so callers can keep it mounted unconditionally and just toggle the message. */
export function Toast({
  message,
  onDismiss,
  durationMs = 5000,
}: {
  message: string | null;
  onDismiss: () => void;
  durationMs?: number;
}) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message, durationMs]);

  if (!message) return null;

  return (
    <div className="fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4">
      <div className="flex max-w-md items-start gap-2.5 rounded-xl border border-border bg-surface px-4 py-3 text-sm shadow-xl">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-500" />
        <p className="min-w-0 flex-1">{message}</p>
        <button onClick={onDismiss} className="shrink-0 text-muted hover:text-foreground">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
