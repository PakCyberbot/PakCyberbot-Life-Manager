import { useEffect, useState } from 'react';
import {
  BookOpen,
  Cloud,
  CloudOff,
  Download,
  ExternalLink,
  FolderOpen,
  Newspaper,
  Plus,
  Quote as QuoteIcon,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
} from 'lucide-react';
import { getApi, useNewsStore, useQuotesStore, useSettingsStore, type DriveStatus } from '@life-manager/core';
import type { AiProviderId, NewsCategory } from '@life-manager/shared';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { ThemeToggle } from '../theme/ThemeToggle';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Field, Input, Select, Textarea } from '../components/ui/FormControls';

export function SettingsScreen() {
  const { readerPath, readerType, currency, loaded, load, setReader, autoDetectReader, clearReader, setCurrency } =
    useSettingsStore();
  const [detecting, setDetecting] = useState(false);
  const [currencyDraft, setCurrencyDraft] = useState(currency);

  useEffect(() => setCurrencyDraft(currency), [currency]);

  useEffect(() => {
    if (!loaded) load();
  }, [loaded, load]);

  const browseForReader = async () => {
    const picked = await getApi().dialog.pickExecutable();
    if (picked) await setReader(picked, 'custom');
  };

  const runAutoDetect = async () => {
    setDetecting(true);
    const found = await autoDetectReader();
    setDetecting(false);
    if (!found) {
      alert("Couldn't find Adobe Acrobat/Reader or Foxit Reader in their usual install locations — use Browse instead.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted">Appearance and what's coming next.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <p className="text-sm text-muted">Light, dark, or match your system.</p>
          <ThemeToggle />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Currency</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted">
            Default for new accounts in Money and for Dashboard/Money's combined totals. Each account can still use
            its own currency individually.
          </p>
          <div className="w-20 shrink-0">
            <Field label="Code">
              <Input
                value={currencyDraft}
                onChange={(e) => setCurrencyDraft(e.target.value.toUpperCase())}
                onBlur={() => setCurrency(currencyDraft)}
                placeholder="PKR"
                maxLength={3}
                className="text-center uppercase"
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <QuotesCard />

      <Card>
        <CardHeader>
          <CardTitle>External PDF reader (optional)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="flex items-start gap-2 text-sm text-muted">
            <BookOpen size={16} className="mt-0.5 shrink-0" />
            Clicking a book in Library opens it in an in-app viewer by default, which tracks your bookmark
            automatically as you scroll and saves it when you close the window — no external reader needed for that.
            Configure one here only if you'd rather read in Adobe/Foxit's full app (via the small{' '}
            <ExternalLink size={12} className="inline" /> icon on a book card) — it'll jump to your saved page, but
            won't update the bookmark automatically since there's no way to see another app's state from outside it.
          </p>
          <div className="flex items-center justify-between rounded-lg bg-background px-3 py-2 text-sm">
            <span className="truncate text-muted">
              {readerPath ? (
                <>
                  <span className="font-medium text-foreground">{readerType}</span> — {readerPath}
                </>
              ) : (
                'No reader configured'
              )}
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={runAutoDetect} disabled={detecting}>
              <Wand2 size={14} /> {detecting ? 'Detecting…' : 'Auto-detect'}
            </Button>
            <Button variant="outline" size="sm" onClick={browseForReader}>
              <FolderOpen size={14} /> Browse
            </Button>
            {readerPath && (
              <Button variant="ghost" size="sm" onClick={clearReader}>
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <DriveSyncCard />

      <AiProvidersCard />

      <NewsCategoriesCard />

      <p className="text-center text-xs text-muted">PakCyberbot Life Manager · v0.1.0 (desktop, local-first)</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quotes
// ---------------------------------------------------------------------------

function QuotesCard() {
  const { quotes, fetchQuotes, addQuote, removeQuote, loaded } = useQuotesStore();
  const [text, setText] = useState('');
  const [author, setAuthor] = useState('');

  useEffect(() => {
    if (!loaded) fetchQuotes();
  }, [loaded, fetchQuotes]);

  const submit = async () => {
    if (!text.trim()) return;
    await addQuote(text.trim(), author.trim() || undefined);
    setText('');
    setAuthor('');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Life quotes</CardTitle>
        <Badge tone="library">{quotes.length}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="flex items-start gap-2 text-sm text-muted">
          <QuoteIcon size={16} className="mt-0.5 shrink-0" />
          The Dashboard shows one of these at random each time you open it. Comes seeded with 5 to start — add your
          own or delete any of them.
        </p>

        <div className="space-y-1.5">
          {quotes.map((q) => (
            <div key={q.id} className="flex items-start gap-2 rounded-lg bg-background px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="italic leading-snug">"{q.text}"</p>
                {q.author && <p className="mt-0.5 text-xs text-muted">— {q.author}</p>}
              </div>
              <button onClick={() => removeQuote(q.id)} className="mt-0.5 shrink-0 text-muted hover:text-red-500">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>

        <div className="space-y-2 border-t border-border pt-3">
          <Field label="New quote">
            <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="What do you want to be reminded of?" />
          </Field>
          <div className="flex gap-2">
            <Input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Author (optional)"
              className="flex-1"
            />
            <Button size="sm" onClick={submit} disabled={!text.trim()}>
              <Plus size={14} /> Add
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Google Drive sync
// ---------------------------------------------------------------------------

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
        'This replaces everything currently in the app with the backup from Google Drive. Anything added on this device since your last push will be lost. Continue?'
      )
    ) {
      return;
    }
    setBusy('pull');
    setMessage(null);
    const result = await getApi().drive.pull();
    // On success, main process relaunches the app — this line usually won't run.
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
          Push uploads your local database to a "PakCyberbot Life Manager" folder in your own Google Drive (creating
          it if needed). Pull downloads it back down, replacing what's on this device — useful for moving to another
          computer. Uses the narrow <code className="text-xs">drive.file</code> scope: the app can only see the
          folder/file it creates, nothing else in your Drive.
        </p>

        {!status?.connected && (
          <div className="space-y-2 rounded-lg bg-background p-3">
            <p className="text-xs text-muted">
              Needs a free Google OAuth Client ID + Secret (Desktop app type) from Google Cloud Console — one-time
              setup, see the chat for exact steps.
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
            </div>
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

// ---------------------------------------------------------------------------
// AI providers
// ---------------------------------------------------------------------------

const PROVIDERS: { id: AiProviderId; label: string; keyLabel: string; keyPlaceholder: string; consoleUrl: string }[] = [
  { id: 'gemini', label: 'Google Gemini', keyLabel: 'Gemini API key', keyPlaceholder: 'AIza…', consoleUrl: 'https://aistudio.google.com/apikey' },
  { id: 'openai', label: 'OpenAI', keyLabel: 'OpenAI API key', keyPlaceholder: 'sk-…', consoleUrl: 'https://platform.openai.com/api-keys' },
  { id: 'anthropic', label: 'Anthropic (Claude)', keyLabel: 'Anthropic API key', keyPlaceholder: 'sk-ant-…', consoleUrl: 'https://console.anthropic.com/settings/keys' },
];

function AiProvidersCard() {
  const [activeProvider, setActiveProvider] = useState<AiProviderId>('gemini');
  const [keys, setKeys] = useState<Record<AiProviderId, string>>({ gemini: '', openai: '', anthropic: '' });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      getApi().settings.get('aiProvider'),
      getApi().settings.get('geminiApiKey'),
      getApi().settings.get('openaiApiKey'),
      getApi().settings.get('anthropicApiKey'),
    ]).then(([provider, gemini, openai, anthropic]) => {
      setActiveProvider((provider as AiProviderId) || 'gemini');
      setKeys({ gemini: gemini ?? '', openai: openai ?? '', anthropic: anthropic ?? '' });
      setLoaded(true);
    });
  }, []);

  const selectProvider = async (id: AiProviderId) => {
    setActiveProvider(id);
    await getApi().settings.set('aiProvider', id);
  };

  const saveKey = async (id: AiProviderId, value: string) => {
    setKeys((k) => ({ ...k, [id]: value }));
    await getApi().settings.set(`${id}ApiKey`, value.trim());
  };

  if (!loaded) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI provider</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="flex items-start gap-2 text-sm text-muted">
          <Sparkles size={16} className="mt-0.5 shrink-0" />
          Powers News & Updates ranking/summaries now; entertainment "worth it" verdicts, earning-way guides, and
          framework suggestions will use this too as they ship. Each provider works only via its own API key — that's
          the only officially supported way for a third-party app to use any of them (a ChatGPT Plus or Claude
          Pro/Max subscription can't be used here; those are intentionally not API-accessible outside OpenAI's/
          Anthropic's own apps). Keys are stored encrypted at rest.
        </p>

        <Field label="Active provider">
          <Select value={activeProvider} onChange={(e) => selectProvider(e.target.value as AiProviderId)}>
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>

        <div className="space-y-3">
          {PROVIDERS.map((p) => (
            <div key={p.id} className="space-y-1.5 rounded-lg bg-background p-3">
              <div className="flex items-center justify-between">
                <Field label={p.keyLabel} className="flex-1">
                  <Input
                    type="password"
                    value={keys[p.id]}
                    onChange={(e) => saveKey(p.id, e.target.value)}
                    placeholder={p.keyPlaceholder}
                  />
                </Field>
              </div>
              <Button variant="ghost" size="sm" onClick={() => getApi().system.openExternal(p.consoleUrl)}>
                <ExternalLink size={12} /> Get a {p.label} key
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// News & Updates categories
// ---------------------------------------------------------------------------

function NewsCategoriesCard() {
  const { categories, fetchCategories, addCustomCategory, updateCategory, removeCategory, loaded } = useNewsStore();
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');

  useEffect(() => {
    if (!loaded) fetchCategories();
  }, [loaded, fetchCategories]);

  const submit = async () => {
    if (!name.trim() || !prompt.trim()) return;
    await addCustomCategory(name.trim(), prompt.trim());
    setName('');
    setPrompt('');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>News & Updates categories</CardTitle>
        <Badge tone="calendar">{categories.length}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="flex items-start gap-2 text-sm text-muted">
          <Newspaper size={16} className="mt-0.5 shrink-0" />
          Each category becomes a section on the News & Updates page. Custom categories are fully yours (name +
          what the AI should judge as relevant); Country/City just need a location.
        </p>

        <div className="space-y-2">
          {categories.map((c) => (
            <CategoryRow key={c.id} category={c} onUpdate={updateCategory} onRemove={removeCategory} />
          ))}
        </div>

        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-xs font-medium text-muted">Add a custom category</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, e.g. AI Research" />
            <Input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="What should count as relevant?" />
          </div>
          <Button size="sm" onClick={submit} disabled={!name.trim() || !prompt.trim()}>
            <Plus size={14} /> Add category
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CategoryRow({
  category,
  onUpdate,
  onRemove,
}: {
  category: NewsCategory;
  onUpdate: (id: string, patch: Partial<NewsCategory>) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const [name, setName] = useState(category.name);
  const [prompt, setPrompt] = useState(category.prompt ?? '');
  const [location, setLocation] = useState(category.locationValue ?? '');

  return (
    <div className="space-y-2 rounded-lg bg-background p-3">
      <div className="flex items-center justify-between">
        <Badge tone="library" className="capitalize">
          {category.type.replace('-', ' ')}
        </Badge>
        {category.type === 'custom' && (
          <button onClick={() => onRemove(category.id)} className="text-muted hover:text-red-500">
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {category.type === 'custom' ? (
        <>
          <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => onUpdate(category.id, { name })} />
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onBlur={() => onUpdate(category.id, { prompt })}
            placeholder="What should count as relevant?"
          />
        </>
      ) : category.type === 'country' || category.type === 'city' ? (
        <Input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          onBlur={() => onUpdate(category.id, { locationValue: location })}
          placeholder={category.type === 'country' ? 'e.g. Pakistan' : 'e.g. Karachi'}
        />
      ) : (
        <p className="text-sm font-medium">{category.name}</p>
      )}
    </div>
  );
}
