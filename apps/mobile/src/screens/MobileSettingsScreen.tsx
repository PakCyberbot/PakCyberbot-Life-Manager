import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, ThemeToggle, Switch, Button, Badge, Field, Input, Select } from '@life-manager/ui';
import { getApi, useSettingsStore, useTimeTableStore } from '@life-manager/core';
import type { ClockStyle, ClockTimeFormat, DriveStatus } from '@life-manager/core';
import { Bell, Cloud, CloudOff, Download, ExternalLink, Upload } from 'lucide-react';
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
          <CardContent className="space-y-4">
            <ThemeToggle />
            <ClockStyleField />
          </CardContent>
        </Card>

        <TimeTableNotificationsCard />
        <BackupCard />
        <DriveSyncCard />
      </div>
    </div>
  );
}

// Same DB-backed clockStyle/clockTimeFormat settings desktop's Settings screen exposes
// (useSettingsStore, not localStorage — meant to carry over between devices via Drive sync).
// App.tsx already calls useSettingsStore().load() on boot, so this just reads/writes the
// already-loaded values.
function ClockStyleField() {
  const { clockStyle, setClockStyle, clockTimeFormat, setClockTimeFormat } = useSettingsStore();
  return (
    <>
      <Field label="Time Table clock">
        <Select value={clockStyle} onChange={(e) => setClockStyle(e.target.value as ClockStyle)}>
          <option value="classic">Classic view</option>
          <option value="liveRotating">Live Rotating Clock view</option>
        </Select>
      </Field>
      <Field label="Clock time format">
        <Select value={clockTimeFormat} onChange={(e) => setClockTimeFormat(e.target.value as ClockTimeFormat)}>
          <option value="12h">12-hour (AM/PM)</option>
          <option value="24h">24-hour (military)</option>
        </Select>
      </Field>
    </>
  );
}

function DriveSyncCard() {
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [status, setStatus] = useState<DriveStatus | null>(null);
  const [busy, setBusy] = useState<'connect' | 'push' | 'pull' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refreshStatus = async () => setStatus(await getApi().drive.status());

  useEffect(() => {
    Promise.all([getApi().settings.get('googleClientId'), getApi().settings.get('googleClientSecret')]).then(
      ([id, secret]) => {
        setClientId(id ?? '');
        setClientSecret(secret ?? '');
      }
    );
    refreshStatus();
  }, []);

  const saveCredentials = async () => {
    await getApi().settings.set('googleClientId', clientId.trim());
    await getApi().settings.set('googleClientSecret', clientSecret.trim());
  };

  const connect = async () => {
    await saveCredentials();
    setBusy('connect');
    setMessage(null);
    const result = await getApi().drive.connect();
    setBusy(null);
    setMessage(result.ok ? `Connected${result.email ? ` as ${result.email}` : ''}.` : (result.error ?? 'Could not connect.'));
    await refreshStatus();
  };

  const disconnect = async () => {
    await getApi().drive.disconnect();
    setMessage(null);
    await refreshStatus();
  };

  const push = async () => {
    setBusy('push');
    setMessage(null);
    const result = await getApi().drive.push();
    setBusy(null);
    setMessage(result.ok ? 'Pushed to Drive.' : (result.error ?? 'Push failed.'));
    await refreshStatus();
  };

  const pull = async () => {
    if (
      !confirm(
        'This replaces everything currently on this device with the backup from Google Drive. Anything added on this device since your last push will be lost. Continue?'
      )
    ) {
      return;
    }
    setBusy('pull');
    setMessage(null);
    const result = await getApi().drive.pull();
    // On success, the app reloads — this line usually won't run.
    if (!result.ok) {
      setBusy(null);
      setMessage(result.error ?? 'Pull failed.');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Google Drive sync</CardTitle>
        {status?.connected ? <Badge tone="success">Connected</Badge> : <Badge tone="warning">Not connected</Badge>}
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="flex items-start gap-2 text-sm text-muted">
          {status?.connected ? <Cloud size={16} className="mt-0.5 shrink-0" /> : <CloudOff size={16} className="mt-0.5 shrink-0" />}
          Push uploads this device's database to the same "PakCyberbot Life Manager" folder in your Google Drive
          desktop uses (creating it if needed). Pull downloads it back down, replacing what's on this device — the
          same file format either app can read.
        </p>

        {!status?.connected && (
          <div className="space-y-2 rounded-lg bg-background p-3">
            <p className="text-xs text-muted">
              Same Client ID + Secret as desktop's Settings (a free Google OAuth "Desktop app" type credential) —
              paste the same values here, or set up a new one at Google Cloud Console.
            </p>
            <Field label="Client ID">
              <Input value={clientId} onChange={(e) => setClientId(e.target.value)} onBlur={saveCredentials} placeholder="…apps.googleusercontent.com" />
            </Field>
            <Field label="Client Secret">
              <Input
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                onBlur={saveCredentials}
                placeholder="GOCSPX-…"
              />
            </Field>
            <Button
              variant="outline"
              size="sm"
              onClick={() => getApi().system.openExternal('https://console.cloud.google.com/apis/credentials')}
            >
              <ExternalLink size={14} /> Open Google Cloud Console
            </Button>
          </div>
        )}

        {status?.connected && (
          <div className="rounded-lg bg-background px-3 py-2 text-sm">
            <p className="font-medium">{status.email ?? 'Connected'}</p>
            <p className="text-xs text-muted">
              Last pushed: {status.lastPushedAt ? new Date(status.lastPushedAt).toLocaleString() : 'never'} · Last
              pulled: {status.lastPulledAt ? new Date(status.lastPulledAt).toLocaleString() : 'never'}
            </p>
          </div>
        )}

        {message && <p className="text-sm text-muted">{message}</p>}

        <div className="flex flex-wrap gap-2">
          {!status?.connected ? (
            <Button size="sm" onClick={connect} disabled={busy === 'connect' || !clientId.trim() || !clientSecret.trim()}>
              {busy === 'connect' ? 'Waiting for sign-in…' : 'Connect Google Drive'}
            </Button>
          ) : (
            <>
              <Button size="sm" onClick={push} disabled={busy !== null}>
                <Upload size={14} /> {busy === 'push' ? 'Pushing…' : 'Push to Drive'}
              </Button>
              <Button size="sm" variant="outline" onClick={pull} disabled={busy !== null}>
                <Download size={14} /> {busy === 'pull' ? 'Pulling…' : 'Pull from Drive'}
              </Button>
              <Button size="sm" variant="ghost" onClick={disconnect} disabled={busy !== null}>
                Disconnect
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
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
          Save or restore this device's data as a file — a Google-account-free alternative to Drive sync. Same
          .sqlite format desktop's own Export/Import uses, so a file moves freely between the two apps.
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
