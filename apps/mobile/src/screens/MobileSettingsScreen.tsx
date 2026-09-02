import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, ThemeToggle, Switch, Button } from '@life-manager/ui';
import { getApi, useTimeTableStore } from '@life-manager/core';
import { Bell, Cloud, Download, Upload } from 'lucide-react';
import { SectionHeader } from '../components/SectionHeader';
import type { MobileScreenId } from '../navigation';
import {
  cancelTimeTableNotifications,
  scheduleTimeTableNotifications,
  TIME_TABLE_NOTIFICATIONS_SETTING_KEY,
} from '../notifications/timeTableNotifications';

export function MobileSettingsScreen({ onNavigate }: { onNavigate: (s: MobileScreenId) => void }) {
  return (
    <div>
      <SectionHeader title="Settings" onBack={() => onNavigate('more')} />
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
          </CardHeader>
          <CardContent>
            <ThemeToggle />
          </CardContent>
        </Card>

        <TimeTableNotificationsCard />
        <BackupCard />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cloud size={15} className="text-muted" />
              Google Drive sync
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted">
              Not wired up yet on mobile — this is planned next, using the same Drive backup desktop already writes to.
              For now, this app's data stays local to this device.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TimeTableNotificationsCard() {
  const { slots, fetchAll, loaded } = useTimeTableStore();
  const [enabled, setEnabled] = useState(false);
  const [settingLoaded, setSettingLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loaded) fetchAll();
    getApi()
      .settings.get(TIME_TABLE_NOTIFICATIONS_SETTING_KEY)
      .then((value) => {
        setEnabled(value === 'on');
        setSettingLoaded(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = async (next: boolean) => {
    setBusy(true);
    setError(null);
    if (next) {
      const granted = await scheduleTimeTableNotifications(slots);
      if (!granted) {
        setError('Notification permission was denied — enable it for this app in Android Settings, then try again.');
        setBusy(false);
        return;
      }
    } else {
      await cancelTimeTableNotifications();
    }
    await getApi().settings.set(TIME_TABLE_NOTIFICATIONS_SETTING_KEY, next ? 'on' : 'off');
    setEnabled(next);
    setBusy(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell size={15} className="text-muted" />
          Time Table reminders
        </CardTitle>
        {settingLoaded && <Switch checked={enabled} onChange={toggle} label="Time Table reminders" />}
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted">
          Get a notification right when a Time Table slot starts, every week it repeats — same schedule as the Clock
          view on your Dashboard.
        </p>
        {slots.length === 0 && (
          <p className="text-xs text-muted">No Time Table slots on this device yet — nothing to schedule until some sync over.</p>
        )}
        {error && <p className="text-xs text-red-500">{error}</p>}
        {busy && <p className="text-xs text-muted">Updating…</p>}
      </CardContent>
    </Card>
  );
}

function BackupCard() {
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; message: string } | null>(null);
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);

  const exportData = async () => {
    setBusy('export');
    setStatus(null);
    const result = await getApi().backup.exportDatabase();
    setBusy(null);
    setStatus(
      result.ok
        ? { kind: 'ok', message: 'Exported — pick where to save it in the share sheet.' }
        : { kind: 'error', message: result.error ?? 'Export failed.' }
    );
  };

  const importData = async () => {
    setBusy('import');
    setStatus(null);
    const result = await getApi().backup.importDatabase();
    setBusy(null);
    if (result.cancelled) return;
    setStatus(
      result.ok
        ? { kind: 'ok', message: 'Imported — reloading…' }
        : { kind: 'error', message: result.error ?? 'Import failed.' }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Backup</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted">
          Save or restore this device's data as a file — a Google-account-free alternative to Drive sync, and its own
          separate copy from whatever's on desktop.
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1" onClick={exportData} disabled={busy !== null}>
            <Upload size={14} /> {busy === 'export' ? 'Exporting…' : 'Export data'}
          </Button>
          <Button size="sm" variant="outline" className="flex-1" onClick={importData} disabled={busy !== null}>
            <Download size={14} /> {busy === 'import' ? 'Importing…' : 'Import data'}
          </Button>
        </div>
        {status && <p className={`text-xs ${status.kind === 'ok' ? 'text-emerald-500' : 'text-red-500'}`}>{status.message}</p>}
      </CardContent>
    </Card>
  );
}
