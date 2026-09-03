import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileWarning,
  FolderOpen,
  ImageOff,
  Link2,
  ListTodo,
  Pencil,
  Play,
  Plus,
  Target,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  getApi,
  useBooksStore,
  useGoalsStore,
  useMilestonesStore,
  useTasksStore,
  useUiFocusStore,
  useVideosStore,
} from '@life-manager/core';
import {
  formatDate,
  type Goal,
  type GoalStatus,
  type GoalType,
  type Milestone,
  type Task,
  type TaskLinkType,
  type TaskPriority,
} from '@life-manager/shared';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { Field, Input, Select, Textarea } from '../components/ui/FormControls';
import { Badge } from '../components/ui/Badge';
import { ProgressBar } from '../components/ui/ProgressBar';
import { EmptyState } from '../components/ui/EmptyState';
import type { ScreenId } from '../navigation';
import clsx from 'clsx';

const STATUS_TONE: Record<GoalStatus, 'success' | 'default' | 'warning' | 'danger'> = {
  active: 'default',
  completed: 'success',
  paused: 'warning',
  abandoned: 'danger',
};

const PRIORITY_TONE: Record<TaskPriority, 'default' | 'warning' | 'danger'> = {
  low: 'default',
  medium: 'warning',
  high: 'danger',
};

const IMAGE_MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
};

/** Follows a task's optional link — a Library item jumps there (via useUiFocusStore's one-shot
 * highlight target), a URL opens externally, a file/folder opens locally. Shared by goal-level task
 * rows, milestone sub-task rows, and the top-level Quick Tasks section, since a task's link works the
 * same way regardless of where it's currently filed. */
function openTaskLink(task: Task, onNavigate: (s: ScreenId) => void) {
  if (task.linkType === 'book' && task.linkTargetId) {
    useUiFocusStore.getState().setLibraryFocus({ type: 'book', id: task.linkTargetId });
    onNavigate('library');
  } else if (task.linkType === 'video' && task.linkTargetId) {
    useUiFocusStore.getState().setLibraryFocus({ type: 'video', id: task.linkTargetId });
    onNavigate('library');
  } else if (task.linkType === 'url' && task.linkPath) {
    getApi().system.openExternal(task.linkPath);
  } else if (task.linkPath) {
    getApi().system.openLocalPath(task.linkPath);
  }
}

/** A task's title, doubling as its "open link" affordance when it has one — clicking the title opens
 * it directly, rather than a separate button crammed in next to Edit/Delete where a misclick is easy.
 * Plain, non-interactive text when there's no link. */
function TaskTitle({
  task,
  hostname,
  onNavigate,
  className,
  as = 'span',
}: {
  task: Task;
  hostname: string | null;
  onNavigate: (s: ScreenId) => void;
  className?: string;
  as?: 'span' | 'p';
}) {
  const linkedOnOtherMachine =
    !!task.linkType && (task.linkType === 'file' || task.linkType === 'folder') && !!task.linkHostname && task.linkHostname !== hostname;
  const openable = !!task.linkType && !linkedOnOtherMachine;
  const Tag = as;
  return (
    <Tag
      onClick={openable ? () => openTaskLink(task, onNavigate) : undefined}
      title={
        linkedOnOtherMachine
          ? `Linked, but only available on ${task.linkHostname}`
          : openable
            ? task.linkType === 'book' || task.linkType === 'video'
              ? 'Click to open in Library'
              : task.linkType === 'url'
                ? 'Click to open link'
                : 'Click to open'
            : undefined
      }
      className={clsx(
        className,
        task.status === 'done' && 'text-muted line-through',
        openable && 'cursor-pointer hover:text-accentGoals hover:underline'
      )}
    >
      {task.title}
    </Tag>
  );
}

/** A small passive icon beside Edit/Delete indicating a task carries a link and what kind — not
 * itself clickable (the title is, via TaskTitle above), so it can't be misclicked for edit/delete. */
function TaskLinkIcon({ task, hostname }: { task: Task; hostname: string | null }) {
  if (!task.linkType) return null;
  const linkedOnOtherMachine =
    (task.linkType === 'file' || task.linkType === 'folder') && task.linkHostname && task.linkHostname !== hostname;
  const Icon = linkedOnOtherMachine
    ? FileWarning
    : task.linkType === 'book'
      ? BookOpen
      : task.linkType === 'video'
        ? Play
        : task.linkType === 'url'
          ? Link2
          : ExternalLink;
  return (
    <span
      title={linkedOnOtherMachine ? `Only available on ${task.linkHostname}` : 'Linked — click the title to open'}
      className={clsx('shrink-0', linkedOnOtherMachine ? 'text-muted' : 'text-accentGoals')}
    >
      <Icon size={14} />
    </span>
  );
}

export function GoalsScreen({ onNavigate }: { onNavigate: (s: ScreenId) => void }) {
  const { goals, fetchGoals, addGoal, updateGoal, removeGoal, loaded } = useGoalsStore();
  const { tasks, fetchTasks, loaded: tasksLoaded, addTask, updateTask, setStatus, removeTask, assignTask } = useTasksStore();
  const { byGoalId: milestonesByGoalId, fetchForGoal } = useMilestonesStore();
  const [createOpen, setCreateOpen] = useState(false);
  const [detailGoal, setDetailGoal] = useState<Goal | null>(null);
  const [quickTaskDialogOpen, setQuickTaskDialogOpen] = useState(false);
  const [editingQuickTask, setEditingQuickTask] = useState<Task | null>(null);
  const [assigningTask, setAssigningTask] = useState<Task | null>(null);
  const [hostname, setHostname] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded) fetchGoals();
    if (!tasksLoaded) fetchTasks();
    getApi().system.hostname().then(setHostname);
  }, [loaded, fetchGoals, tasksLoaded, fetchTasks]);

  // Milestone labels in the assign dialogs (and milestone-linked progress) need every goal's
  // milestones available, not just the currently-open one — prefetch anything not already loaded.
  useEffect(() => {
    for (const g of goals) {
      if (!(g.id in milestonesByGoalId)) fetchForGoal(g.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goals]);

  const quickTasks = useMemo(() => tasks.filter((t) => !t.linkedGoalId), [tasks]);

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
              className="cursor-pointer overflow-hidden p-0 transition-transform hover:-translate-y-0.5 hover:shadow-md"
            >
              {g.imageUrl && <img src={g.imageUrl} alt="" className="h-28 w-full object-cover" />}
              <div className="p-5">
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
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="border-t border-border pt-6">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-1.5 text-sm font-semibold">
              <ListTodo size={15} className="text-accentGoals" /> Quick Tasks
            </h2>
            <p className="text-xs text-muted">Not tied to a goal yet — capture it now, file it under a goal or milestone later.</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setQuickTaskDialogOpen(true)}>
            <Plus size={13} /> Add quick task
          </Button>
        </div>
        {quickTasks.length === 0 ? (
          <p className="rounded-lg bg-surface px-3 py-2.5 text-xs text-muted">Nothing unassigned right now.</p>
        ) : (
          <div className="space-y-1.5">
            {quickTasks.map((t) => (
              <div key={t.id} className="flex items-center gap-2.5 rounded-lg bg-surface px-3 py-2.5 text-sm">
                <div className="w-28 shrink-0">
                  <Select value={t.status} onChange={(e) => setStatus(t.id, e.target.value as Task['status'])} className="h-7 !py-1 !text-xs">
                    <option value="todo">To do</option>
                    <option value="in-progress">In progress</option>
                    <option value="done">Done</option>
                  </Select>
                </div>
                <div className="min-w-0 flex-1">
                  <TaskTitle as="p" task={t} hostname={hostname} onNavigate={onNavigate} className="truncate font-medium" />
                  <p className="truncate text-xs text-muted">
                    {t.dueDate ? formatDate(t.dueDate) : 'No due date'}
                    {t.notes ? ` · ${t.notes}` : ''}
                  </p>
                </div>
                <Badge tone={PRIORITY_TONE[t.priority]}>{t.priority}</Badge>
                <TaskLinkIcon task={t} hostname={hostname} />
                <button onClick={() => setEditingQuickTask(t)} title="Edit" className="shrink-0 text-muted hover:text-foreground">
                  <Pencil size={13} />
                </button>
                <button onClick={() => removeTask(t.id)} title="Delete" className="shrink-0 text-muted hover:text-red-500">
                  <Trash2 size={13} />
                </button>
                <Button size="sm" variant="outline" onClick={() => setAssigningTask(t)}>
                  Assign
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <CreateGoalDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreate={addGoal} />

      <TaskDialog open={quickTaskDialogOpen} onClose={() => setQuickTaskDialogOpen(false)} onCreate={addTask} />
      {editingQuickTask && (
        <TaskDialog
          open
          onClose={() => setEditingQuickTask(null)}
          task={editingQuickTask}
          onCreate={addTask}
          onUpdate={updateTask}
        />
      )}

      <AssignTaskDialog
        open={!!assigningTask}
        onClose={() => setAssigningTask(null)}
        task={assigningTask}
        goals={goals}
        onAssign={async (goalId, milestoneId) => {
          if (!assigningTask) return;
          await assignTask(assigningTask.id, { linkedGoalId: goalId, linkedMilestoneId: milestoneId });
        }}
      />

      {detailGoal && (
        <GoalDetailDialog
          goal={goals.find((g) => g.id === detailGoal.id) ?? detailGoal}
          goals={goals}
          onClose={() => setDetailGoal(null)}
          onUpdate={updateGoal}
          onDelete={async (id) => {
            await removeGoal(id);
            setDetailGoal(null);
          }}
          onNavigate={onNavigate}
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
  goals,
  onClose,
  onUpdate,
  onDelete,
  onNavigate,
}: {
  goal: Goal;
  goals: Goal[];
  onClose: () => void;
  onUpdate: ReturnType<typeof useGoalsStore.getState>['updateGoal'];
  onDelete: (id: string) => void;
  onNavigate: (s: ScreenId) => void;
}) {
  const { byGoalId, fetchForGoal, addMilestone, toggleMilestone, removeMilestone } = useMilestonesStore();
  const { tasks, addTask, updateTask, setStatus, removeTask, assignTask } = useTasksStore();
  const milestones = byGoalId[goal.id] ?? [];
  // Milestone-linked tasks render nested under their milestone (below), not in this flat list.
  const goalLevelTasks = tasks.filter((t) => t.linkedGoalId === goal.id && !t.linkedMilestoneId);
  // Default to View — a visually plain read-only glance (image, title, description, status,
  // category, target date, progress bar, milestones + their tasks, goal-level tasks), no
  // edit/delete affordances shown. Edit is exactly the dialog as it was before this toggle
  // existed — same state below, just a different render branch, so switching between them never
  // loses anything mid-edit.
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [newMilestone, setNewMilestone] = useState('');
  // Also doubles as the milestone quick-add: { milestoneId: null } for goal-level "Add task",
  // { milestoneId: m.id } for a milestone's own "Add task" — both open the same full TaskDialog
  // popup (link/priority/notes and all), not a bare title-only input.
  const [addTaskFor, setAddTaskFor] = useState<{ milestoneId: string | null } | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [hostname, setHostname] = useState<string | null>(null);
  const [expandedMilestones, setExpandedMilestones] = useState<Set<string>>(new Set());
  const [assignExistingFor, setAssignExistingFor] = useState<{ milestoneId: string | null } | null>(null);

  const toggleExpanded = (milestoneId: string) => {
    setExpandedMilestones((prev) => {
      const next = new Set(prev);
      if (next.has(milestoneId)) next.delete(milestoneId);
      else next.add(milestoneId);
      return next;
    });
  };

  // Editable goal fields — local state so typing doesn't fight the parent's
  // `goals.find(...)` object identity, resynced only when switching to a
  // different goal (not on every field commit).
  const [title, setTitle] = useState(goal.title);
  const [description, setDescription] = useState(goal.description ?? '');
  const [category, setCategory] = useState(goal.category ?? '');
  const [targetDate, setTargetDate] = useState(goal.targetDate ?? '');

  useEffect(() => {
    fetchForGoal(goal.id);
    getApi().system.hostname().then(setHostname);
    setTitle(goal.title);
    setDescription(goal.description ?? '');
    setCategory(goal.category ?? '');
    setTargetDate(goal.targetDate ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal.id]);

  const addMilestoneAndSubmit = async () => {
    if (!newMilestone.trim()) return;
    await addMilestone(goal.id, newMilestone.trim());
    setNewMilestone('');
  };

  const uploadImage = async () => {
    const picked = await getApi().dialog.pickFileOrFolder('file');
    if (!picked || picked.isFolder) return;
    const base64 = await getApi().system.readFileAsBase64(picked.path);
    if (!base64) return;
    const ext = picked.path.split('.').pop()?.toLowerCase() ?? '';
    const mime = IMAGE_MIME_BY_EXT[ext];
    if (!mime) return; // not a recognized image file — silently ignore rather than store garbage
    await onUpdate(goal.id, { imageUrl: `data:${mime};base64,${base64}` });
  };

  return (
    <Dialog open onClose={onClose} title={goal.title} className="max-w-xl">
      <div className="space-y-4">
        <div className="flex items-center justify-end">
          <Button size="sm" variant={mode === 'edit' ? 'primary' : 'outline'} onClick={() => setMode(mode === 'edit' ? 'view' : 'edit')}>
            {mode === 'edit' ? (
              <>
                <CheckSquare size={13} /> Done editing
              </>
            ) : (
              <>
                <Pencil size={13} /> Edit
              </>
            )}
          </Button>
        </div>

        {mode === 'view' ? (
          <GoalViewContent goal={goal} milestones={milestones} tasks={tasks} goalLevelTasks={goalLevelTasks} hostname={hostname} onNavigate={onNavigate} toggleMilestone={toggleMilestone} setStatus={setStatus} />
        ) : (
          <>
        <div className="space-y-2">
          {goal.imageUrl ? (
            <img src={goal.imageUrl} alt="" className="h-32 w-full rounded-lg object-cover" />
          ) : (
            <div className="flex h-16 items-center justify-center rounded-lg bg-background text-xs text-muted">
              No image
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={uploadImage} type="button">
              <Upload size={13} /> Upload image
            </Button>
            {goal.imageUrl && (
              <Button variant="outline" size="sm" onClick={() => onUpdate(goal.id, { imageUrl: null })} type="button">
                <ImageOff size={13} /> Remove image
              </Button>
            )}
          </div>
        </div>
        <Field label="Title">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title.trim() && title !== goal.title && onUpdate(goal.id, { title: title.trim() })}
          />
        </Field>
        <Field label="Description">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => {
              const next = description.trim() || null;
              if (next !== (goal.description ?? null)) onUpdate(goal.id, { description: next });
            }}
            placeholder="Optional details"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              onBlur={() => {
                const next = category.trim() || null;
                if (next !== (goal.category ?? null)) onUpdate(goal.id, { category: next });
              }}
              placeholder="e.g. Career"
            />
          </Field>
          <Field label="Type">
            <Select value={goal.type} onChange={(e) => onUpdate(goal.id, { type: e.target.value as GoalType })}>
              <option value="short-term">Short-term</option>
              <option value="long-term">Long-term</option>
              <option value="okr">OKR</option>
            </Select>
          </Field>
        </div>
        <Field label="Target date">
          <Input
            type="date"
            value={targetDate}
            onChange={(e) => {
              setTargetDate(e.target.value);
              onUpdate(goal.id, { targetDate: e.target.value || null });
            }}
          />
        </Field>

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
              disabled={milestones.length > 0}
              onChange={(e) => onUpdate(goal.id, { progressPct: Number(e.target.value) })}
            />
            {milestones.length > 0 && (
              <p className="mt-1 text-[11px] text-muted">Auto-computed from milestones checked off below</p>
            )}
          </Field>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-muted">Milestones</p>
          <div className="space-y-1.5">
            {milestones.map((m) => {
              const subtasks = tasks.filter((t) => t.linkedGoalId === goal.id && t.linkedMilestoneId === m.id);
              const expanded = expandedMilestones.has(m.id);
              return (
                <div key={m.id} className="rounded-lg bg-background">
                  <div className="flex items-center gap-2 px-3 py-2 text-sm">
                    <button
                      onClick={() => toggleExpanded(m.id)}
                      className="shrink-0 text-muted hover:text-foreground"
                      title={expanded ? 'Collapse' : `${subtasks.length} task${subtasks.length === 1 ? '' : 's'}`}
                    >
                      {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    <input
                      type="checkbox"
                      checked={!!m.completed}
                      onChange={() => toggleMilestone(goal.id, m.id)}
                      className="h-4 w-4 rounded border-border accent-current text-accentGoals"
                    />
                    <span className={clsx('flex-1', m.completed && 'text-muted line-through')}>{m.title}</span>
                    {subtasks.length > 0 && (
                      <span className="text-[11px] text-muted">
                        {subtasks.filter((t) => t.status === 'done').length}/{subtasks.length}
                      </span>
                    )}
                    <button onClick={() => removeMilestone(goal.id, m.id)} className="text-muted hover:text-red-500">
                      <Trash2 size={13} />
                    </button>
                  </div>
                  {expanded && (
                    <div className="space-y-1.5 border-t border-border px-3 py-2">
                      {subtasks.map((t) => (
                        // A plain div, not <label> — a <label> would toggle the checkbox on any
                        // click inside it, including on the title, which needs its own click-to-open
                        // behavior (TaskTitle) instead.
                        <div key={t.id} className="flex items-center gap-2.5 text-sm">
                          <input
                            type="checkbox"
                            checked={t.status === 'done'}
                            onChange={() => setStatus(t.id, t.status === 'done' ? 'todo' : 'done')}
                            className="h-4 w-4 shrink-0 rounded border-border accent-current text-accentGoals"
                          />
                          <TaskTitle task={t} hostname={hostname} onNavigate={onNavigate} className="flex-1" />
                          <TaskLinkIcon task={t} hostname={hostname} />
                          <button onClick={() => setEditingTask(t)} title="Edit" className="shrink-0 text-muted hover:text-foreground">
                            <Pencil size={12} />
                          </button>
                          <button onClick={() => removeTask(t.id)} title="Delete" className="shrink-0 text-muted hover:text-red-500">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" variant="outline" onClick={() => setAddTaskFor({ milestoneId: m.id })}>
                          <Plus size={13} /> Add task
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setAssignExistingFor({ milestoneId: m.id })}>
                          Assign existing
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
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

        <div className="border-t border-border pt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
              <CheckSquare size={13} /> Tasks
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setAssignExistingFor({ milestoneId: null })}>
                Assign existing
              </Button>
              <Button size="sm" variant="outline" onClick={() => setAddTaskFor({ milestoneId: null })}>
                <Plus size={13} /> Add task
              </Button>
            </div>
          </div>
          {goalLevelTasks.length === 0 ? (
            <p className="rounded-lg bg-background px-3 py-2.5 text-xs text-muted">
              No goal-level tasks yet — break this goal into steps (or nest them under a milestone above),
              optionally linked to a file, folder, web link, book, or video.
            </p>
          ) : (
            <div className="space-y-1.5">
              {goalLevelTasks.map((t) => {
                return (
                  <div key={t.id} className="flex items-center gap-2.5 rounded-lg bg-background px-3 py-2.5 text-sm">
                    <div className="w-28 shrink-0">
                      <Select
                        value={t.status}
                        onChange={(e) => setStatus(t.id, e.target.value as Task['status'])}
                        className="h-7 !py-1 !text-xs"
                      >
                        <option value="todo">To do</option>
                        <option value="in-progress">In progress</option>
                        <option value="done">Done</option>
                      </Select>
                    </div>
                    <div className="min-w-0 flex-1">
                      <TaskTitle as="p" task={t} hostname={hostname} onNavigate={onNavigate} className="truncate font-medium" />
                      <p className="truncate text-xs text-muted">
                        {t.dueDate ? formatDate(t.dueDate) : 'No due date'}
                        {t.notes ? ` · ${t.notes}` : ''}
                      </p>
                    </div>
                    <Badge tone={PRIORITY_TONE[t.priority]}>{t.priority}</Badge>
                    <TaskLinkIcon task={t} hostname={hostname} />
                    <button onClick={() => setEditingTask(t)} title="Edit" className="shrink-0 text-muted hover:text-foreground">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => removeTask(t.id)} className="shrink-0 text-muted hover:text-red-500">
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
          </>
        )}

        <div className="flex justify-between border-t border-border pt-3">
          {mode === 'edit' ? (
            <Button variant="danger" size="sm" onClick={() => onDelete(goal.id)}>
              <Trash2 size={14} /> Delete goal
            </Button>
          ) : (
            <span />
          )}
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      {addTaskFor && (
        <TaskDialog
          open
          onClose={() => setAddTaskFor(null)}
          goal={goal}
          milestoneId={addTaskFor.milestoneId}
          milestoneTitle={addTaskFor.milestoneId ? milestones.find((m) => m.id === addTaskFor.milestoneId)?.title : undefined}
          onCreate={addTask}
        />
      )}
      {editingTask && (
        <TaskDialog
          open
          onClose={() => setEditingTask(null)}
          goal={goal}
          task={editingTask}
          onCreate={addTask}
          onUpdate={updateTask}
        />
      )}
      <AssignExistingTaskDialog
        open={!!assignExistingFor}
        onClose={() => setAssignExistingFor(null)}
        tasks={tasks}
        goals={goals}
        excludeGoalId={goal.id}
        excludeMilestoneId={assignExistingFor?.milestoneId ?? null}
        onPick={async (taskId) => {
          await assignTask(taskId, { linkedGoalId: goal.id, linkedMilestoneId: assignExistingFor?.milestoneId ?? null });
        }}
      />
    </Dialog>
  );
}

/** GoalDetailDialog's read-only "View" mode content — a visually plain glance, no edit/delete
 * affordances anywhere. Milestone/task checkboxes stay live (checking one off isn't a misclick
 * risk the way delete is, matching how mobile's read-only Goal detail already treats them), and
 * task titles stay click-to-open via the shared TaskTitle helper — everything else here is plain
 * text or a progress bar, not an input. */
function GoalViewContent({
  goal,
  milestones,
  tasks,
  goalLevelTasks,
  hostname,
  onNavigate,
  toggleMilestone,
  setStatus,
}: {
  goal: Goal;
  milestones: Milestone[];
  tasks: Task[];
  goalLevelTasks: Task[];
  hostname: string | null;
  onNavigate: (s: ScreenId) => void;
  toggleMilestone: (goalId: string, milestoneId: string) => Promise<void> | void;
  setStatus: (taskId: string, status: Task['status']) => Promise<void> | void;
}) {
  return (
    <div className="space-y-4">
      {goal.imageUrl && <img src={goal.imageUrl} alt="" className="h-40 w-full rounded-lg object-cover" />}
      <div>
        <h3 className="text-lg font-semibold leading-snug">{goal.title}</h3>
        {goal.category && <p className="mt-0.5 text-xs text-muted">{goal.category}</p>}
      </div>
      {goal.description && <p className="whitespace-pre-wrap text-sm text-muted">{goal.description}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={STATUS_TONE[goal.status]}>{goal.status}</Badge>
        <Badge tone="default">{goal.type}</Badge>
        {goal.targetDate && <span className="text-xs text-muted">Target: {formatDate(goal.targetDate)}</span>}
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-muted">
          <span>Progress</span>
          <span>{goal.progressPct}%</span>
        </div>
        <ProgressBar value={goal.progressPct} toneClassName="bg-accentGoals" />
      </div>

      {milestones.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-muted">Milestones</p>
          <div className="space-y-1.5">
            {milestones.map((m) => {
              const subtasks = tasks.filter((t) => t.linkedGoalId === goal.id && t.linkedMilestoneId === m.id);
              return (
                <div key={m.id} className="rounded-lg bg-background px-3 py-2">
                  <label className="flex items-center gap-2.5 text-sm">
                    <input
                      type="checkbox"
                      checked={!!m.completed}
                      onChange={() => toggleMilestone(goal.id, m.id)}
                      className="h-4 w-4 shrink-0 rounded border-border accent-current text-accentGoals"
                    />
                    <span className={clsx('flex-1', m.completed && 'text-muted line-through')}>{m.title}</span>
                  </label>
                  {subtasks.length > 0 && (
                    <div className="ml-6 mt-1.5 space-y-1.5 border-l border-border pl-3">
                      {subtasks.map((t) => (
                        <div key={t.id} className="flex items-center gap-2.5 text-xs">
                          <input
                            type="checkbox"
                            checked={t.status === 'done'}
                            onChange={() => setStatus(t.id, t.status === 'done' ? 'todo' : 'done')}
                            className="h-3.5 w-3.5 shrink-0 rounded border-border accent-current text-accentGoals"
                          />
                          <TaskTitle
                            task={t}
                            hostname={hostname}
                            onNavigate={onNavigate}
                            className={clsx('min-w-0 flex-1 truncate', t.status === 'done' && 'text-muted line-through')}
                          />
                          <TaskLinkIcon task={t} hostname={hostname} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {goalLevelTasks.length > 0 && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted">
            <CheckSquare size={13} /> Tasks
          </p>
          <div className="space-y-1.5">
            {goalLevelTasks.map((t) => (
              <div key={t.id} className="flex items-center gap-2.5 rounded-lg bg-background px-3 py-2.5 text-sm">
                <input
                  type="checkbox"
                  checked={t.status === 'done'}
                  onChange={() => setStatus(t.id, t.status === 'done' ? 'todo' : 'done')}
                  className="h-4 w-4 shrink-0 rounded border-border accent-current text-accentGoals"
                />
                <TaskTitle
                  task={t}
                  hostname={hostname}
                  onNavigate={onNavigate}
                  className={clsx('min-w-0 flex-1 truncate', t.status === 'done' && 'text-muted line-through')}
                />
                <TaskLinkIcon task={t} hostname={hostname} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

type LinkMode = 'none' | 'path' | 'book' | 'video' | 'url';

function TaskDialog({
  open,
  onClose,
  goal,
  task,
  milestoneId,
  milestoneTitle,
  onCreate,
  onUpdate,
}: {
  open: boolean;
  onClose: () => void;
  /** Absent for a "quick task" (created with no goal — see GoalsScreen's Quick Tasks section). */
  goal?: Goal;
  /** When present, edits this existing task instead of creating a new one. */
  task?: Task;
  /** When present (and not editing), the created task nests under this milestone instead of
   * sitting at goal-level — the milestone quick-add's "Add task" button passes this so it opens
   * the same full dialog goal-level "Add task" uses, instead of a bare title-only input. */
  milestoneId?: string | null;
  /** Only used for the dialog's own title text. */
  milestoneTitle?: string;
  onCreate: ReturnType<typeof useTasksStore.getState>['addTask'];
  onUpdate?: ReturnType<typeof useTasksStore.getState>['updateTask'];
}) {
  const { books, fetchBooks, loaded: booksLoaded, updateBook } = useBooksStore();
  const { videos, fetchVideos, loaded: videosLoaded, updateVideo } = useVideosStore();
  const isEditing = !!task;

  const linkModeFor = (t?: Task): LinkMode => {
    if (!t?.linkType) return 'none';
    if (t.linkType === 'file' || t.linkType === 'folder') return 'path';
    return t.linkType;
  };

  const [title, setTitle] = useState(task?.title ?? '');
  const [notes, setNotes] = useState(task?.notes ?? '');
  const [dueDate, setDueDate] = useState(task?.dueDate ?? '');
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? 'medium');
  const [linkMode, setLinkMode] = useState<LinkMode>(linkModeFor(task));
  const [pickedPath, setPickedPath] = useState<{ path: string; isFolder: boolean } | null>(
    task?.linkPath && (task.linkType === 'file' || task.linkType === 'folder')
      ? { path: task.linkPath, isFolder: task.linkType === 'folder' }
      : null
  );
  const [url, setUrl] = useState(task?.linkType === 'url' ? (task.linkPath ?? '') : '');
  const [selectedBookId, setSelectedBookId] = useState(task?.linkType === 'book' ? (task.linkTargetId ?? '') : '');
  const [selectedVideoId, setSelectedVideoId] = useState(task?.linkType === 'video' ? (task.linkTargetId ?? '') : '');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!booksLoaded) fetchBooks();
    if (!videosLoaded) fetchVideos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (linkMode === 'book' && !selectedBookId && books.length > 0) setSelectedBookId(books[0].id);
    if (linkMode === 'video' && !selectedVideoId && videos.length > 0) setSelectedVideoId(videos[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkMode, books, videos]);

  const browse = async (kind: 'file' | 'folder') => {
    const picked = await getApi().dialog.pickFileOrFolder(kind);
    if (picked) setPickedPath(picked);
  };

  const reset = () => {
    setTitle('');
    setNotes('');
    setDueDate('');
    setPriority('medium');
    setLinkMode('none');
    setPickedPath(null);
    setUrl('');
    setSelectedBookId('');
    setSelectedVideoId('');
  };

  // A title is only truly optional when linked to a Library book/video — there's a real name to
  // fall back on there ("Book - <title>"/"YouTube - <title>"). Every other link mode (or no link
  // at all) still requires one, same as before.
  const canSubmitWithoutTitle = (linkMode === 'book' && !!selectedBookId) || (linkMode === 'video' && !!selectedVideoId);

  const submit = async () => {
    if (!title.trim() && !canSubmitWithoutTitle) return;
    setSubmitting(true);

    let linkType: TaskLinkType | null = null;
    let linkPath: string | null = null;
    let linkHostname: string | null = null;
    let linkTargetId: string | null = null;
    let defaultTitle: string | null = null;

    if (linkMode === 'path' && pickedPath) {
      linkType = pickedPath.isFolder ? 'folder' : 'file';
      linkPath = pickedPath.path;
      linkHostname = await getApi().system.hostname();
    } else if (linkMode === 'url' && url.trim()) {
      linkType = 'url';
      linkPath = url.trim();
    } else if (linkMode === 'book' && selectedBookId) {
      linkType = 'book';
      linkTargetId = selectedBookId;
      const book = books.find((b) => b.id === selectedBookId);
      if (book) defaultTitle = `Book - ${book.title}`;
      // Tag the book with this goal's title so Library shows which goal it belongs to — only
      // meaningful when there's a goal at all (a quick task's book/video link isn't tagged until
      // the task itself is later assigned into a goal).
      if (goal) await updateBook(selectedBookId, { category: goal.title });
    } else if (linkMode === 'video' && selectedVideoId) {
      linkType = 'video';
      linkTargetId = selectedVideoId;
      const video = videos.find((v) => v.id === selectedVideoId);
      // Library's video links are always YouTube (addVideo always resolves via
      // media.fetchYouTubeThumbnail) — no need to sniff the URL's host.
      if (video) defaultTitle = `YouTube - ${video.title}`;
      if (goal) await updateVideo(selectedVideoId, { category: goal.title });
    }

    const payload = {
      title: title.trim() || defaultTitle || 'Untitled task',
      notes: notes.trim() || null,
      dueDate: dueDate || null,
      priority,
      linkType,
      linkPath,
      linkHostname,
      linkTargetId,
    };

    if (isEditing && task && onUpdate) {
      await onUpdate(task.id, payload);
    } else {
      await onCreate({ ...payload, linkedGoalId: goal?.id ?? null, linkedMilestoneId: milestoneId ?? null });
    }
    setSubmitting(false);
    reset();
    onClose();
  };

  const dialogTitle = goal
    ? isEditing
      ? `Edit task — ${goal.title}`
      : milestoneTitle
        ? `New task — ${milestoneTitle}`
        : `New task — ${goal.title}`
    : isEditing
      ? 'Edit quick task'
      : 'New quick task';

  return (
    <Dialog open={open} onClose={onClose} title={dialogTitle}>
      <div className="space-y-3">
        <Field label={canSubmitWithoutTitle ? 'Title (optional)' : 'Title'}>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={canSubmitWithoutTitle ? 'Defaults to the linked item’s name if left blank' : 'e.g. Draft the outline'}
            autoFocus
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Due date (optional)">
            <Input type="date" value={dueDate ?? ''} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
          <Field label="Priority">
            <Select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </Select>
          </Field>
        </div>
        <Field label="Notes (optional)">
          <Textarea value={notes ?? ''} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        <Field label="Link (optional)">
          <Select
            value={linkMode}
            onChange={(e) => {
              setLinkMode(e.target.value as LinkMode);
              setPickedPath(null);
            }}
          >
            <option value="none">None</option>
            <option value="path">File or folder on this machine</option>
            <option value="url">Web URL</option>
            <option value="book">Book from Library</option>
            <option value="video">Video from Library</option>
          </Select>
        </Field>

        {linkMode === 'path' && (
          <div className="flex gap-2">
            <Input value={pickedPath?.path ?? ''} readOnly placeholder="No file/folder selected" className="flex-1" />
            <Button variant="outline" size="sm" onClick={() => browse('file')} type="button">
              <FolderOpen size={14} /> File
            </Button>
            <Button variant="outline" size="sm" onClick={() => browse('folder')} type="button">
              <FolderOpen size={14} /> Folder
            </Button>
          </div>
        )}
        {linkMode === 'url' && (
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
        )}
        {linkMode === 'book' &&
          (books.length === 0 ? (
            <p className="text-xs text-muted">No books in Library yet — add one first.</p>
          ) : (
            <Select value={selectedBookId} onChange={(e) => setSelectedBookId(e.target.value)}>
              {books.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </Select>
          ))}
        {linkMode === 'video' &&
          (videos.length === 0 ? (
            <p className="text-xs text-muted">No videos in Library yet — add one first.</p>
          ) : (
            <Select value={selectedVideoId} onChange={(e) => setSelectedVideoId(e.target.value)}>
              {videos.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.title}
                </option>
              ))}
            </Select>
          ))}
        {(linkMode === 'book' || linkMode === 'video') && goal && (
          <p className="text-[11px] text-muted">
            Linking this will tag it "{goal.title}" in Library, so you can see which items belong to which goals.
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={(!title.trim() && !canSubmitWithoutTitle) || submitting}>
            {submitting ? 'Saving…' : isEditing ? 'Save changes' : 'Add task'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/** Picks a *destination* (goal, and optionally one of its milestones) for an already-known task —
 * used by the bottom Quick Tasks section. */
function AssignTaskDialog({
  open,
  onClose,
  task,
  goals,
  onAssign,
}: {
  open: boolean;
  onClose: () => void;
  task: Task | null;
  goals: Goal[];
  onAssign: (goalId: string, milestoneId: string | null) => Promise<void>;
}) {
  const { byGoalId, fetchForGoal } = useMilestonesStore();
  const [goalId, setGoalId] = useState('');
  const [milestoneId, setMilestoneId] = useState('');

  useEffect(() => {
    if (!open) return;
    const first = goals[0]?.id ?? '';
    setGoalId(first);
    setMilestoneId('');
    if (first) fetchForGoal(first);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task?.id]);

  const chooseGoal = (id: string) => {
    setGoalId(id);
    setMilestoneId('');
    fetchForGoal(id);
  };

  const milestones = byGoalId[goalId] ?? [];

  const submit = async () => {
    if (!goalId) return;
    await onAssign(goalId, milestoneId || null);
    onClose();
  };

  if (!task) return null;

  return (
    <Dialog open={open} onClose={onClose} title={`Assign "${task.title}"`}>
      <div className="space-y-3">
        {goals.length === 0 ? (
          <p className="text-xs text-muted">No goals yet — create one first.</p>
        ) : (
          <>
            <Field label="Goal">
              <Select value={goalId} onChange={(e) => chooseGoal(e.target.value)}>
                {goals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </Select>
            </Field>
            {milestones.length > 0 && (
              <Field label="Milestone (optional)">
                <Select value={milestoneId} onChange={(e) => setMilestoneId(e.target.value)}>
                  <option value="">Goal-level (no milestone)</option>
                  {milestones.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!goalId}>
            Assign
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/** Picks an *existing task* to pull into a fixed destination (a goal, or one of its milestones —
 * `excludeMilestoneId: null` means goal-level) — used by GoalDetailDialog's "Assign existing"
 * buttons. Lists every task not already at that exact destination: quick tasks first, then tasks
 * under other goals/milestones, each labeled with where they currently live. */
function AssignExistingTaskDialog({
  open,
  onClose,
  tasks,
  goals,
  excludeGoalId,
  excludeMilestoneId,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  tasks: Task[];
  goals: Goal[];
  excludeGoalId: string;
  excludeMilestoneId: string | null;
  onPick: (taskId: string) => Promise<void>;
}) {
  const { byGoalId } = useMilestonesStore();

  const labelFor = (t: Task) => {
    if (!t.linkedGoalId) return 'Quick task';
    const goalTitle = goals.find((g) => g.id === t.linkedGoalId)?.title ?? 'Unknown goal';
    if (!t.linkedMilestoneId) return goalTitle;
    const milestoneTitle = (byGoalId[t.linkedGoalId] ?? []).find((m) => m.id === t.linkedMilestoneId)?.title;
    return milestoneTitle ? `${goalTitle} › ${milestoneTitle}` : goalTitle;
  };

  const candidates = tasks.filter((t) => !(t.linkedGoalId === excludeGoalId && t.linkedMilestoneId === excludeMilestoneId));

  const pick = async (taskId: string) => {
    await onPick(taskId);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title="Assign an existing task">
      <div className="max-h-96 space-y-1.5 overflow-y-auto">
        {candidates.length === 0 ? (
          <p className="text-xs text-muted">No other tasks to bring in.</p>
        ) : (
          candidates.map((t) => (
            <button
              key={t.id}
              onClick={() => pick(t.id)}
              className="flex w-full items-center justify-between gap-2 rounded-lg bg-background px-3 py-2 text-left text-sm hover:bg-border"
            >
              <span className="min-w-0 flex-1 truncate">{t.title}</span>
              <span className="shrink-0 text-xs text-muted">{labelFor(t)}</span>
            </button>
          ))
        )}
        <div className="flex justify-end pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
