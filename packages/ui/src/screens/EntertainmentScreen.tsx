import { useEffect, useState } from 'react';
import { Brain, Clapperboard, Clock, Plus, Sparkles, Trash2, TrendingUp, Zap } from 'lucide-react';
import { useEntertainmentStore } from '@life-manager/core';
import type { Entertainment, EntertainmentStatus, EntertainmentType } from '@life-manager/shared';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { Field, Input, Select, Textarea } from '../components/ui/FormControls';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';

const VERDICT_TONE: Record<string, 'success' | 'warning' | 'danger'> = {
  'Worth It': 'success',
  Mixed: 'warning',
  Skip: 'danger',
};

const ADDICTIVENESS_TONE: Record<string, 'success' | 'warning' | 'danger'> = {
  low: 'success',
  medium: 'warning',
  high: 'danger',
};

const STATUS_LABEL: Record<EntertainmentStatus, string> = {
  considering: 'Considering',
  'in-progress': 'In progress',
  completed: 'Completed',
  dropped: 'Dropped',
};

export function EntertainmentScreen() {
  const { items, fetchItems, pendingVerdictIds, updateStatus, updateNotes, removeItem, loaded } = useEntertainmentStore();
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (!loaded) fetchItems();
  }, [loaded, fetchItems]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Entertainment</h1>
          <p className="mt-1 text-sm text-muted">Is it worth your time? Advisory, not a gatekeeper — you decide.</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus size={16} />
          New activity
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<Clapperboard size={28} />}
          title="Nothing tracked yet"
          description="Add a movie, show, game, or anything else — an AI verdict on whether it's worth your time follows automatically."
          action={
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus size={14} /> New activity
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {items.map((item) => (
            <EntertainmentCard
              key={item.id}
              item={item}
              pending={pendingVerdictIds.has(item.id)}
              onStatusChange={(s) => updateStatus(item.id, s)}
              onNotesChange={(n) => updateNotes(item.id, n)}
              onRemove={() => removeItem(item.id)}
            />
          ))}
        </div>
      )}

      <NewEntertainmentDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}

function EntertainmentCard({
  item,
  pending,
  onStatusChange,
  onNotesChange,
  onRemove,
}: {
  item: Entertainment;
  pending: boolean;
  onStatusChange: (s: EntertainmentStatus) => void;
  onNotesChange: (n: string) => void;
  onRemove: () => void;
}) {
  const [notes, setNotes] = useState(item.notes ?? '');

  return (
    <Card className="flex flex-col gap-3 overflow-hidden p-4">
      {item.thumbnail && (
        <img src={item.thumbnail} alt="" className="-m-4 mb-0 aspect-video w-[calc(100%+2rem)] object-cover" />
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{item.title}</p>
          <p className="text-xs capitalize text-muted">{item.type}</p>
        </div>
        <button onClick={onRemove} className="shrink-0 text-muted hover:text-red-500">
          <Trash2 size={14} />
        </button>
      </div>

      {pending ? (
        <div className="flex items-center gap-2 rounded-lg bg-background px-3 py-2.5 text-sm text-muted">
          <Sparkles size={14} className="animate-pulse text-accentLibrary" />
          Getting a verdict…
        </div>
      ) : item.verdict ? (
        <div className="space-y-2.5 rounded-lg bg-background p-3">
          <div className="flex items-center gap-2">
            <Badge tone={VERDICT_TONE[item.verdict] ?? 'default'}>{item.verdict}</Badge>
            {item.addictiveness && (
              <Badge tone={ADDICTIVENESS_TONE[item.addictiveness] ?? 'default'}>{item.addictiveness} addictiveness</Badge>
            )}
          </div>
          <p className="text-xs leading-relaxed text-foreground/90">{item.reasoning}</p>

          <div className="grid grid-cols-1 gap-2 pt-1 text-xs sm:grid-cols-2">
            {item.skillsImproved && (
              <div className="flex items-start gap-1.5">
                <TrendingUp size={13} className="mt-0.5 shrink-0 text-accentGoals" />
                <span className="text-muted">{item.skillsImproved}</span>
              </div>
            )}
            {item.timeCostEstimate && (
              <div className="flex items-start gap-1.5">
                <Clock size={13} className="mt-0.5 shrink-0 text-accentTasks" />
                <span className="text-muted">{item.timeCostEstimate}</span>
              </div>
            )}
            {item.benefits && (
              <div className="flex items-start gap-1.5 sm:col-span-2">
                <Zap size={13} className="mt-0.5 shrink-0 text-accentMoney" />
                <span className="text-muted">{item.benefits}</span>
              </div>
            )}
            {item.mentalEffects && (
              <div className="flex items-start gap-1.5 sm:col-span-2">
                <Brain size={13} className="mt-0.5 shrink-0 text-accentCalendar" />
                <span className="text-muted">{item.mentalEffects}</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="rounded-lg bg-background px-3 py-2.5 text-xs text-muted">
          No AI verdict — configure a provider in Settings, or judge for yourself.
        </p>
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="w-32 shrink-0">
          <Select
            value={item.status}
            onChange={(e) => onStatusChange(e.target.value as EntertainmentStatus)}
            className="h-8 py-1 text-xs leading-tight"
          >
            {(Object.keys(STATUS_LABEL) as EntertainmentStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => onNotesChange(notes)}
        placeholder="Your own take (overrides nothing — just for you)"
        className="text-xs"
      />
    </Card>
  );
}

function NewEntertainmentDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addItem } = useEntertainmentStore();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<EntertainmentType>('movie');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    await addItem(title.trim(), type, thumbnailUrl.trim() || null);
    setSubmitting(false);
    setTitle('');
    setThumbnailUrl('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title="New entertainment activity">
      <div className="space-y-3">
        <Field label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Elden Ring" autoFocus />
        </Field>
        <Field label="Type">
          <Select value={type} onChange={(e) => setType(e.target.value as EntertainmentType)}>
            <option value="movie">Movie</option>
            <option value="show">TV Show</option>
            <option value="anime">Anime</option>
            <option value="game">Game</option>
            <option value="book">Book</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field label="Poster/thumbnail (optional — auto-fetched from Wikipedia if left blank)">
          <Input
            value={thumbnailUrl}
            onChange={(e) => setThumbnailUrl(e.target.value)}
            placeholder="Only needed to override the automatic one"
          />
        </Field>
        <p className="text-xs text-muted">
          A verdict on whether it's worth your time — grounded in your framework.md criteria if you've set them —
          generates automatically after you add it.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!title.trim() || submitting}>
            {submitting ? 'Adding…' : 'Add'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
