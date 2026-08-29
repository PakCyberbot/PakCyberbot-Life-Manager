import { useEffect, useState } from 'react';
import { Plus, Target, Trash2 } from 'lucide-react';
import { useGoalsStore, useMilestonesStore } from '@life-manager/core';
import { formatDate, type Goal, type GoalStatus, type GoalType } from '@life-manager/shared';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { Field, Input, Select, Textarea } from '../components/ui/FormControls';
import { Badge } from '../components/ui/Badge';
import { ProgressBar } from '../components/ui/ProgressBar';
import { EmptyState } from '../components/ui/EmptyState';

const STATUS_TONE: Record<GoalStatus, 'success' | 'default' | 'warning' | 'danger'> = {
  active: 'default',
  completed: 'success',
  paused: 'warning',
  abandoned: 'danger',
};

export function GoalsScreen() {
  const { goals, fetchGoals, addGoal, updateGoal, removeGoal, loaded } = useGoalsStore();
  const [createOpen, setCreateOpen] = useState(false);
  const [detailGoal, setDetailGoal] = useState<Goal | null>(null);

  useEffect(() => {
    if (!loaded) fetchGoals();
  }, [loaded, fetchGoals]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Goals & Targets</h1>
          <p className="mt-1 text-sm text-muted">What you're working toward, and how far along you are.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus size={16} />
          New goal
        </Button>
      </div>

      {goals.length === 0 ? (
        <EmptyState
          icon={<Target size={28} />}
          title="No goals yet"
          description="Start with one thing you want to be true a few months from now."
          action={
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus size={14} /> New goal
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {goals.map((g) => (
            <Card
              key={g.id}
              onClick={() => setDetailGoal(g)}
              className="cursor-pointer p-5 transition-transform hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <h3 className="font-semibold leading-snug">{g.title}</h3>
                <Badge tone={STATUS_TONE[g.status]}>{g.status}</Badge>
              </div>
              {g.description && <p className="mb-3 line-clamp-2 text-sm text-muted">{g.description}</p>}
              <div className="mb-1.5 flex items-center justify-between text-xs text-muted">
                <span>{g.category || g.type}</span>
                <span>{g.progressPct}%</span>
              </div>
              <ProgressBar value={g.progressPct} toneClassName="bg-accentGoals" />
              {g.targetDate && <p className="mt-2 text-xs text-muted">Target: {formatDate(g.targetDate)}</p>}
            </Card>
          ))}
        </div>
      )}

      <CreateGoalDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreate={addGoal} />

      {detailGoal && (
        <GoalDetailDialog
          goal={goals.find((g) => g.id === detailGoal.id) ?? detailGoal}
          onClose={() => setDetailGoal(null)}
          onUpdate={updateGoal}
          onDelete={async (id) => {
            await removeGoal(id);
            setDetailGoal(null);
          }}
        />
      )}
    </div>
  );
}

function CreateGoalDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: ReturnType<typeof useGoalsStore.getState>['addGoal'];
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [type, setType] = useState<GoalType>('short-term');
  const [targetDate, setTargetDate] = useState('');

  const reset = () => {
    setTitle('');
    setDescription('');
    setCategory('');
    setType('short-term');
    setTargetDate('');
  };

  const submit = async () => {
    if (!title.trim()) return;
    await onCreate({
      title: title.trim(),
      description: description.trim() || null,
      category: category.trim() || null,
      type,
      targetDate: targetDate || null,
    });
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title="New goal">
      <div className="space-y-3">
        <Field label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Ship the v1 desktop app" autoFocus />
        </Field>
        <Field label="Description">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional details" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Career" />
          </Field>
          <Field label="Type">
            <Select value={type} onChange={(e) => setType(e.target.value as GoalType)}>
              <option value="short-term">Short-term</option>
              <option value="long-term">Long-term</option>
              <option value="okr">OKR</option>
            </Select>
          </Field>
        </div>
        <Field label="Target date">
          <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!title.trim()}>
            Create goal
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function GoalDetailDialog({
  goal,
  onClose,
  onUpdate,
  onDelete,
}: {
  goal: Goal;
  onClose: () => void;
  onUpdate: ReturnType<typeof useGoalsStore.getState>['updateGoal'];
  onDelete: (id: string) => void;
}) {
  const { byGoalId, fetchForGoal, addMilestone, toggleMilestone, removeMilestone } = useMilestonesStore();
  const milestones = byGoalId[goal.id] ?? [];
  const [newMilestone, setNewMilestone] = useState('');

  useEffect(() => {
    fetchForGoal(goal.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal.id]);

  const addMilestoneAndSubmit = async () => {
    if (!newMilestone.trim()) return;
    await addMilestone(goal.id, newMilestone.trim());
    setNewMilestone('');
  };

  return (
    <Dialog open onClose={onClose} title={goal.title}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Status">
            <Select value={goal.status} onChange={(e) => onUpdate(goal.id, { status: e.target.value as GoalStatus })}>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="paused">Paused</option>
              <option value="abandoned">Abandoned</option>
            </Select>
          </Field>
          <Field label={`Progress — ${goal.progressPct}%`}>
            <Input
              type="range"
              min={0}
              max={100}
              value={goal.progressPct}
              onChange={(e) => onUpdate(goal.id, { progressPct: Number(e.target.value) })}
            />
          </Field>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-muted">Milestones</p>
          <div className="space-y-1.5">
            {milestones.map((m) => (
              <label key={m.id} className="flex items-center gap-2.5 rounded-lg bg-background px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!m.completed}
                  onChange={() => toggleMilestone(goal.id, m.id)}
                  className="h-4 w-4 rounded border-border accent-current text-accentGoals"
                />
                <span className={m.completed ? 'flex-1 text-muted line-through' : 'flex-1'}>{m.title}</span>
                <button onClick={() => removeMilestone(goal.id, m.id)} className="text-muted hover:text-red-500">
                  <Trash2 size={13} />
                </button>
              </label>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <Input
              value={newMilestone}
              onChange={(e) => setNewMilestone(e.target.value)}
              placeholder="Add a milestone"
              onKeyDown={(e) => e.key === 'Enter' && addMilestoneAndSubmit()}
            />
            <Button size="sm" variant="outline" onClick={addMilestoneAndSubmit}>
              Add
            </Button>
          </div>
        </div>

        <div className="flex justify-between border-t border-border pt-3">
          <Button variant="danger" size="sm" onClick={() => onDelete(goal.id)}>
            <Trash2 size={14} /> Delete goal
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
