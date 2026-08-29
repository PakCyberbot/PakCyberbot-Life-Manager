import { useEffect, useState } from 'react';
import { Banknote, CheckCircle2, Lightbulb, Plus, RefreshCw, Sparkles, Trash2, X } from 'lucide-react';
import { useEarningWaysStore } from '@life-manager/core';
import type { EarningWay, EarningWayCategory, EarningWayStatus } from '@life-manager/shared';
import type { EarningWaySuggestionPayload } from '@life-manager/core';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { Field, Input, Select, Textarea } from '../components/ui/FormControls';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';

const STATUS_LABEL: Record<EarningWayStatus, string> = {
  idea: 'Idea',
  exploring: 'Exploring',
  active: 'Active',
  paused: 'Paused',
  stopped: 'Stopped',
};

const STATUS_TONE: Record<EarningWayStatus, 'default' | 'warning' | 'success' | 'danger'> = {
  idea: 'default',
  exploring: 'warning',
  active: 'success',
  paused: 'warning',
  stopped: 'danger',
};

export function EarningWaysScreen() {
  const {
    items,
    fetchItems,
    loaded,
    suggestions,
    suggesting,
    suggestError,
    fetchSuggestions,
    addSuggestion,
    dismissSuggestion,
    updateStatus,
    removeItem,
  } = useEarningWaysStore();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<EarningWay | null>(null);

  useEffect(() => {
    if (!loaded) fetchItems();
  }, [loaded, fetchItems]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Earning Ways</h1>
          <p className="mt-1 text-sm text-muted">Ideas for income — track your own, or let AI suggest some.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchSuggestions} disabled={suggesting}>
            <Sparkles size={14} /> {suggesting ? 'Thinking…' : 'Get AI suggestions'}
          </Button>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus size={14} /> New idea
          </Button>
        </div>
      </div>

      {suggestError && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">{suggestError}</p>}

      {suggestions.length > 0 && (
        <Card className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <Lightbulb size={16} className="text-accentMoney" />
            <p className="text-sm font-semibold">AI suggestions</p>
          </div>
          <div className="space-y-2">
            {suggestions.map((s) => (
              <SuggestionRow
                key={s.title}
                suggestion={s}
                onAdd={() => addSuggestion(s)}
                onDismiss={() => dismissSuggestion(s)}
              />
            ))}
          </div>
        </Card>
      )}

      {items.length === 0 ? (
        <EmptyState
          icon={<Banknote size={28} />}
          title="No earning ways tracked yet"
          description="Add your own idea, or ask AI for a few to start with."
          action={
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus size={14} /> New idea
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {items.map((item) => (
            <Card key={item.id} className="flex flex-col gap-2.5 p-4">
              <button onClick={() => setDetailItem(item)} className="text-left">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold leading-snug">{item.title}</p>
                  {item.source === 'ai' && <Sparkles size={13} className="mt-0.5 shrink-0 text-accentMoney" />}
                </div>
                <p className="mt-0.5 text-xs capitalize text-muted">{item.category}</p>
                {item.notes && <p className="mt-1.5 line-clamp-2 text-xs text-muted">{item.notes}</p>}
              </button>
              <div className="flex items-center justify-between gap-2 pt-1">
                <Select
                  value={item.status}
                  onChange={(e) => updateStatus(item.id, e.target.value as EarningWayStatus)}
                  className="h-8 w-auto text-xs"
                >
                  {(Object.keys(STATUS_LABEL) as EarningWayStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </Select>
                <div className="flex items-center gap-2">
                  <Badge tone={STATUS_TONE[item.status]}>{item.guideOverview ? 'Guide ready' : 'No guide yet'}</Badge>
                  <button onClick={() => removeItem(item.id)} className="text-muted hover:text-red-500">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <NewEarningWayDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
      {detailItem && <EarningWayDetailDialog item={detailItem} onClose={() => setDetailItem(null)} />}
    </div>
  );
}

function SuggestionRow({
  suggestion,
  onAdd,
  onDismiss,
}: {
  suggestion: EarningWaySuggestionPayload;
  onAdd: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-background p-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{suggestion.title}</p>
          <Badge className="capitalize">{suggestion.category}</Badge>
        </div>
        <p className="mt-0.5 text-xs text-muted">{suggestion.rationale}</p>
      </div>
      <button onClick={onAdd} title="Add to my list" className="shrink-0 text-accentMoney hover:opacity-80">
        <CheckCircle2 size={18} />
      </button>
      <button onClick={onDismiss} title="Dismiss" className="shrink-0 text-muted hover:text-red-500">
        <X size={16} />
      </button>
    </div>
  );
}

function NewEarningWayDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addItem } = useEarningWaysStore();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<EarningWayCategory>('freelance');
  const [notes, setNotes] = useState('');

  const submit = async () => {
    if (!title.trim()) return;
    await addItem(title.trim(), category, notes.trim() || null);
    setTitle('');
    setNotes('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title="New earning way">
      <div className="space-y-3">
        <Field label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Freelance web development" autoFocus />
        </Field>
        <Field label="Category">
          <Select value={category} onChange={(e) => setCategory(e.target.value as EarningWayCategory)}>
            <option value="freelance">Freelance</option>
            <option value="job">Job</option>
            <option value="business">Business</option>
            <option value="investment">Investment</option>
            <option value="passive">Passive</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field label="Notes (optional)">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any context for yourself" />
        </Field>
        <p className="text-xs text-muted">Open it after adding to generate a full A-Z guide.</p>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!title.trim()}>
            Add
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function GuideSection({ label, value, asList = false }: { label: string; value?: string | null; asList?: boolean }) {
  if (!value) return null;
  const lines = value
    .split('\n')
    .map((l) => l.replace(/^\s*[-\d.]*\s*/, '').trim())
    .filter(Boolean);
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      {asList ? (
        <ul className="list-disc space-y-0.5 pl-4 text-sm text-foreground/90">
          {lines.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-foreground/90">{value}</p>
      )}
    </div>
  );
}

function EarningWayDetailDialog({ item, onClose }: { item: EarningWay; onClose: () => void }) {
  const { items, ensureGuide, regenerateGuide, updateNotes, guideLoadingIds } = useEarningWaysStore();
  const live = items.find((i) => i.id === item.id) ?? item;
  const [notes, setNotes] = useState(live.notes ?? '');
  const pending = guideLoadingIds.has(item.id);

  useEffect(() => {
    ensureGuide(item.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  return (
    <Dialog open onClose={onClose} title={live.title} className="max-w-lg">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge className="capitalize">{live.category}</Badge>
          {live.guideProvider && <Badge tone="library">via {live.guideProvider}</Badge>}
        </div>

        {pending ? (
          <div className="flex items-center gap-2 rounded-lg bg-background px-3 py-3 text-sm text-muted">
            <Sparkles size={14} className="animate-pulse text-accentMoney" />
            Writing the guide…
          </div>
        ) : live.guideOverview ? (
          <div className="space-y-3 rounded-lg bg-background p-3">
            <GuideSection label="Overview" value={live.guideOverview} />
            <GuideSection label="Getting started" value={live.guideSteps} asList />
            <GuideSection label="Skills needed" value={live.guideSkillsNeeded} />
            <GuideSection label="Tools & platforms" value={live.guideTools} />
            <GuideSection label="Timeline" value={live.guideTimeline} />
            <GuideSection label="Income potential" value={live.guideIncomePotential} />
            <GuideSection label="Common pitfalls" value={live.guidePitfalls} asList />
            <GuideSection label="Resources to look into" value={live.guideResources} asList />
            <Button variant="ghost" size="sm" onClick={() => regenerateGuide(item.id)}>
              <RefreshCw size={13} /> Regenerate
            </Button>
          </div>
        ) : (
          <p className="rounded-lg bg-background px-3 py-3 text-sm text-muted">
            No guide yet — configure an AI provider in Settings, or write your own notes below.
          </p>
        )}

        <Field label="Your notes">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => updateNotes(item.id, notes)} />
        </Field>
      </div>
    </Dialog>
  );
}
