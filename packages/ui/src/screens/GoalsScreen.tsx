import { useEffect, useState } from 'react';
import {
  BookOpen,
  CheckSquare,
  ExternalLink,
  FileWarning,
  FolderOpen,
  Link2,
  Pencil,
  Play,
  Plus,
  Target,
  Trash2,
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
import { formatDate, type Goal, type GoalStatus, type GoalType, type Task, type TaskLinkType, type TaskPriority } from '@life-manager/shared';
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

export function GoalsScreen({ onNavigate }: { onNavigate: (s: ScreenId) => void }) {
  const { goals, fetchGoals, addGoal, updateGoal, removeGoal, loaded } = useGoalsStore();
  const { fetchTasks, loaded: tasksLoaded } = useTasksStore();
  const [createOpen, setCreateOpen] = useState(false);
  const [detailGoal, setDetailGoal] = useState<Goal | null>(null);

  useEffect(() => {
    if (!loaded) fetchGoals();
    if (!tasksLoaded) fetchTasks();
  }, [loaded, fetchGoals, tasksLoaded, fetchTasks]);

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
  onClose,
  onUpdate,
  onDelete,
  onNavigate,
}: {
  goal: Goal;
  onClose: () => void;
  onUpdate: ReturnType<typeof useGoalsStore.getState>['updateGoal'];
  onDelete: (id: string) => void;
  onNavigate: (s: ScreenId) => void;
}) {
  const { byGoalId, fetchForGoal, addMilestone, toggleMilestone, removeMilestone } = useMilestonesStore();
  const { tasks, addTask, updateTask, setStatus, removeTask } = useTasksStore();
  const milestones = byGoalId[goal.id] ?? [];
  const goalTasks = tasks.filter((t) => t.linkedGoalId === goal.id);
  const [newMilestone, setNewMilestone] = useState('');
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [hostname, setHostname] = useState<string | null>(null);

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

  const openTaskLink = (task: Task) => {
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
  };

  return (
    <Dialog open onClose={onClose} title={goal.title} className="max-w-xl">
      <div className="space-y-4">
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

        <div className="border-t border-border pt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
              <CheckSquare size={13} /> Tasks
            </p>
            <Button size="sm" variant="outline" onClick={() => setTaskDialogOpen(true)}>
              <Plus size={13} /> Add task
            </Button>
          </div>
          {goalTasks.length === 0 ? (
            <p className="rounded-lg bg-background px-3 py-2.5 text-xs text-muted">
              No tasks yet — break this goal into steps, optionally linked to a file, folder, web link, book, or video.
            </p>
          ) : (
            <div className="space-y-1.5">
              {goalTasks.map((t) => {
                const linkedOnOtherMachine =
                  (t.linkType === 'file' || t.linkType === 'folder') && t.linkHostname && t.linkHostname !== hostname;
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
                      <p className={clsx('truncate font-medium', t.status === 'done' && 'text-muted line-through')}>{t.title}</p>
                      <p className="truncate text-xs text-muted">
                        {t.dueDate ? formatDate(t.dueDate) : 'No due date'}
                        {t.notes ? ` · ${t.notes}` : ''}
                      </p>
                    </div>
                    <Badge tone={PRIORITY_TONE[t.priority]}>{t.priority}</Badge>
                    {t.linkType && (
                      <button
                        onClick={() => openTaskLink(t)}
                        disabled={!!linkedOnOtherMachine}
                        title={
                          linkedOnOtherMachine
                            ? `Only available on ${t.linkHostname}`
                            : t.linkType === 'book' || t.linkType === 'video'
                              ? 'Open in Library'
                              : t.linkType === 'url'
                                ? 'Open link'
                                : 'Open'
                        }
                        className={clsx(
                          'shrink-0',
                          linkedOnOtherMachine ? 'text-muted' : 'text-accentGoals hover:text-accentGoals/80'
                        )}
                      >
                        {linkedOnOtherMachine ? (
                          <FileWarning size={14} />
                        ) : t.linkType === 'book' ? (
                          <BookOpen size={14} />
                        ) : t.linkType === 'video' ? (
                          <Play size={14} />
                        ) : t.linkType === 'url' ? (
                          <Link2 size={14} />
                        ) : (
                          <ExternalLink size={14} />
                        )}
                      </button>
                    )}
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

        <div className="flex justify-between border-t border-border pt-3">
          <Button variant="danger" size="sm" onClick={() => onDelete(goal.id)}>
            <Trash2 size={14} /> Delete goal
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      <TaskDialog open={taskDialogOpen} onClose={() => setTaskDialogOpen(false)} goal={goal} onCreate={addTask} />
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
    </Dialog>
  );
}

type LinkMode = 'none' | 'path' | 'book' | 'video' | 'url';

function TaskDialog({
  open,
  onClose,
  goal,
  task,
  onCreate,
  onUpdate,
}: {
  open: boolean;
  onClose: () => void;
  goal: Goal;
  /** When present, edits this existing task instead of creating a new one. */
  task?: Task;
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

  const browse = async () => {
    const picked = await getApi().dialog.pickFileOrFolder();
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

  const submit = async () => {
    if (!title.trim()) return;
    setSubmitting(true);

    let linkType: TaskLinkType | null = null;
    let linkPath: string | null = null;
    let linkHostname: string | null = null;
    let linkTargetId: string | null = null;

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
      // Tag the book with this goal's title so Library shows which goal it belongs to.
      await updateBook(selectedBookId, { category: goal.title });
    } else if (linkMode === 'video' && selectedVideoId) {
      linkType = 'video';
      linkTargetId = selectedVideoId;
      await updateVideo(selectedVideoId, { category: goal.title });
    }

    const payload = {
      title: title.trim(),
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
      await onCreate({ ...payload, linkedGoalId: goal.id });
    }
    setSubmitting(false);
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title={isEditing ? `Edit task — ${goal.title}` : `New task — ${goal.title}`}>
      <div className="space-y-3">
        <Field label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Draft the outline" autoFocus />
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
            <Button variant="outline" size="sm" onClick={browse} type="button">
              <FolderOpen size={14} /> Browse
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
        {(linkMode === 'book' || linkMode === 'video') && (
          <p className="text-[11px] text-muted">
            Linking this will tag it "{goal.title}" in Library, so you can see which items belong to which goals.
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!title.trim() || submitting}>
            {submitting ? 'Saving…' : isEditing ? 'Save changes' : 'Add task'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
