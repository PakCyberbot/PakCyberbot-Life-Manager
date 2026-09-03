import { useEffect, useMemo, useState } from 'react';
import { useGoalsStore, useMilestonesStore, useTasksStore, useBooksStore, useVideosStore } from '@life-manager/core';
import { formatDate, type Goal, type Milestone, type Task, type TaskLinkType, type TaskPriority } from '@life-manager/shared';
import { Card, CardContent, CardHeader, CardTitle, Badge, ProgressBar, EmptyState, Button, Dialog, Field, Input, Select, Textarea } from '@life-manager/ui';
import { ListTodo, Pencil, Plus, Target, Trash2 } from 'lucide-react';
import { SectionHeader } from '../../components/SectionHeader';
import { TaskRow } from '../../components/TaskRow';
import type { MobileScreenId } from '../../navigation';

// Goals: the list + a per-goal detail view (fields/milestones/tasks are all
// read-only there, same as desktop's original design before it grew editing)
// plus a fully self-contained Quick Tasks section below the list — the one
// part of Goals mobile can genuinely add/edit/delete, gated behind an
// explicit "Edit" toggle (top-right, via SectionHeader's `right` slot) so a
// stray tap on a small phone screen can't misfire into a delete. No
// navigation.ts/App.tsx changes — goal detail is just local state swapping
// out the list within this same screen.
export function GoalsView({ onNavigate }: { onNavigate: (s: MobileScreenId) => void }) {
  const { goals, fetchGoals, loaded } = useGoalsStore();
  const { tasks, fetchTasks, loaded: tasksLoaded, addTask, updateTask, removeTask } = useTasksStore();
  const { byGoalId: milestonesByGoalId, fetchForGoal } = useMilestonesStore();
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  useEffect(() => {
    if (!loaded) fetchGoals();
    if (!tasksLoaded) fetchTasks();
  }, [loaded, fetchGoals, tasksLoaded, fetchTasks]);

  useEffect(() => {
    for (const g of goals) {
      if (!(g.id in milestonesByGoalId)) fetchForGoal(g.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goals]);

  const quickTasks = useMemo(() => tasks.filter((t) => !t.linkedGoalId), [tasks]);

  if (selectedGoal) {
    const goal = goals.find((g) => g.id === selectedGoal.id) ?? selectedGoal;
    return (
      <GoalDetail
        goal={goal}
        milestones={milestonesByGoalId[goal.id] ?? []}
        tasks={tasks.filter((t) => t.linkedGoalId === goal.id)}
        onBack={() => setSelectedGoal(null)}
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <div>
      <SectionHeader
        title="Goals"
        subtitle="Tap a goal to see its tasks"
        onBack={() => onNavigate('more')}
        right={
          <Button size="sm" variant={editMode ? 'primary' : 'outline'} onClick={() => setEditMode((v) => !v)}>
            {editMode ? 'Done' : 'Edit'}
          </Button>
        }
      />
      {goals.length === 0 ? (
        <EmptyState icon={<Target size={24} />} title="No goals yet" description="Set some up on desktop and sync." />
      ) : (
        <div className="space-y-3">
          {goals.map((g) => (
            <Card key={g.id} onClick={() => setSelectedGoal(g)} className="cursor-pointer active:opacity-80">
              <CardHeader>
                <CardTitle>{g.title}</CardTitle>
                <Badge tone={g.status === 'active' ? 'goals' : g.status === 'completed' ? 'success' : 'default'} className="capitalize">
                  {g.status}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-2">
                {g.description && <p className="text-sm text-muted">{g.description}</p>}
                <div className="flex items-center justify-between text-xs text-muted">
                  <span className="capitalize">{g.type.replace('-', ' ')}</span>
                  {g.targetDate && <span>Due {formatDate(g.targetDate)}</span>}
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-muted">Progress</span>
                    <span className="font-medium">{g.progressPct}%</span>
                  </div>
                  <ProgressBar value={g.progressPct} toneClassName="bg-accentGoals" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-6 border-t border-border pt-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <ListTodo size={15} className="text-accentGoals" /> Quick Tasks
          </h2>
          {editMode && (
            <Button size="sm" variant="outline" onClick={() => setTaskDialogOpen(true)}>
              <Plus size={13} /> Add
            </Button>
          )}
        </div>
        {quickTasks.length === 0 ? (
          <p className="rounded-lg bg-surface px-3 py-2.5 text-xs text-muted">Nothing unassigned right now.</p>
        ) : (
          <div className="space-y-1.5">
            {quickTasks.map((t) =>
              editMode ? (
                <div key={t.id} className="flex items-center gap-2">
                  <div className="flex-1">
                    <TaskRow task={t} onNavigate={onNavigate} />
                  </div>
                  <button onClick={() => setEditingTask(t)} title="Edit" className="shrink-0 text-muted active:text-foreground">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => removeTask(t.id)} title="Delete" className="shrink-0 text-muted active:text-red-500">
                    <Trash2 size={15} />
                  </button>
                </div>
              ) : (
                <TaskRow key={t.id} task={t} onNavigate={onNavigate} />
              )
            )}
          </div>
        )}
      </div>

      <QuickTaskDialog open={taskDialogOpen} onClose={() => setTaskDialogOpen(false)} onCreate={addTask} />
      {editingTask && (
        <QuickTaskDialog open onClose={() => setEditingTask(null)} task={editingTask} onCreate={addTask} onUpdate={updateTask} />
      )}
    </div>
  );
}

function GoalDetail({
  goal,
  milestones,
  tasks,
  onBack,
  onNavigate,
}: {
  goal: Goal;
  milestones: Milestone[];
  tasks: Task[];
  onBack: () => void;
  onNavigate: (s: MobileScreenId) => void;
}) {
  const goalLevelTasks = tasks.filter((t) => !t.linkedMilestoneId);
  const tasksByMilestone = (milestoneId: string) => tasks.filter((t) => t.linkedMilestoneId === milestoneId);

  return (
    <div>
      <SectionHeader title={goal.title} subtitle="View only — edit from desktop" onBack={onBack} />
      <div className="space-y-4">
        {goal.description && <p className="text-sm text-muted">{goal.description}</p>}
        <div className="flex items-center justify-between text-xs text-muted">
          <span className="capitalize">{goal.category || goal.type.replace('-', ' ')}</span>
          {goal.targetDate && <span>Due {formatDate(goal.targetDate)}</span>}
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-muted">Progress</span>
            <span className="font-medium">{goal.progressPct}%</span>
          </div>
          <ProgressBar value={goal.progressPct} toneClassName="bg-accentGoals" />
        </div>

        {milestones.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-muted">Milestones</p>
            <div className="space-y-2">
              {milestones.map((m) => (
                <div key={m.id} className="rounded-lg bg-background px-3 py-2">
                  <label className="flex items-center gap-2.5 text-sm">
                    <input type="checkbox" checked={!!m.completed} readOnly disabled className="h-4 w-4 rounded border-border text-accentGoals" />
                    <span className={m.completed ? 'flex-1 text-muted line-through' : 'flex-1'}>{m.title}</span>
                  </label>
                  {tasksByMilestone(m.id).length > 0 && (
                    <div className="mt-2 space-y-1.5 border-t border-border pt-2">
                      {tasksByMilestone(m.id).map((t) => (
                        <TaskRow key={t.id} task={t} onNavigate={onNavigate} className="bg-surface" />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="mb-2 text-xs font-medium text-muted">Tasks</p>
          {goalLevelTasks.length === 0 ? (
            <p className="rounded-lg bg-background px-3 py-2.5 text-xs text-muted">No goal-level tasks.</p>
          ) : (
            <div className="space-y-1.5">
              {goalLevelTasks.map((t) => (
                <TaskRow key={t.id} task={t} onNavigate={onNavigate} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type LinkMode = 'none' | 'url' | 'book' | 'video';

/** A trimmed mobile version of desktop's TaskDialog — quick tasks only, so no goal/milestone
 * assignment here, and no file/folder link mode (no mobile file-linking model, no native picker). */
function QuickTaskDialog({
  open,
  onClose,
  task,
  onCreate,
  onUpdate,
}: {
  open: boolean;
  onClose: () => void;
  task?: Task;
  onCreate: ReturnType<typeof useTasksStore.getState>['addTask'];
  onUpdate?: ReturnType<typeof useTasksStore.getState>['updateTask'];
}) {
  const { books, fetchBooks, loaded: booksLoaded } = useBooksStore();
  const { videos, fetchVideos, loaded: videosLoaded } = useVideosStore();
  const isEditing = !!task;

  const linkModeFor = (t?: Task): LinkMode => (t?.linkType === 'url' || t?.linkType === 'book' || t?.linkType === 'video' ? t.linkType : 'none');

  const [title, setTitle] = useState(task?.title ?? '');
  const [notes, setNotes] = useState(task?.notes ?? '');
  const [dueDate, setDueDate] = useState(task?.dueDate ?? '');
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? 'medium');
  const [linkMode, setLinkMode] = useState<LinkMode>(linkModeFor(task));
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

  // Same "optional title when linked to a Library book/video" relaxation as desktop's TaskDialog —
  // there's a real name to fall back on there ("Book - <title>"/"YouTube - <title>").
  const canSubmitWithoutTitle = (linkMode === 'book' && !!selectedBookId) || (linkMode === 'video' && !!selectedVideoId);

  const submit = async () => {
    if (!title.trim() && !canSubmitWithoutTitle) return;
    setSubmitting(true);

    let linkType: TaskLinkType | null = null;
    let linkPath: string | null = null;
    let linkTargetId: string | null = null;
    let defaultTitle: string | null = null;

    if (linkMode === 'url' && url.trim()) {
      linkType = 'url';
      linkPath = url.trim();
    } else if (linkMode === 'book' && selectedBookId) {
      linkType = 'book';
      linkTargetId = selectedBookId;
      const book = books.find((b) => b.id === selectedBookId);
      if (book) defaultTitle = `Book - ${book.title}`;
    } else if (linkMode === 'video' && selectedVideoId) {
      linkType = 'video';
      linkTargetId = selectedVideoId;
      const video = videos.find((v) => v.id === selectedVideoId);
      if (video) defaultTitle = `YouTube - ${video.title}`;
    }

    const payload = {
      title: title.trim() || defaultTitle || 'Untitled task',
      notes: notes.trim() || null,
      dueDate: dueDate || null,
      priority,
      linkType,
      linkPath,
      linkTargetId,
    };

    if (isEditing && task && onUpdate) {
      await onUpdate(task.id, payload);
    } else {
      await onCreate(payload);
    }
    setSubmitting(false);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title={isEditing ? 'Edit quick task' : 'New quick task'}>
      <div className="space-y-3">
        <Field label={canSubmitWithoutTitle ? 'Title (optional)' : 'Title'}>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={canSubmitWithoutTitle ? 'Defaults to the linked item’s name if left blank' : 'e.g. Call the bank'}
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
          <Select value={linkMode} onChange={(e) => setLinkMode(e.target.value as LinkMode)}>
            <option value="none">None</option>
            <option value="url">Web URL</option>
            <option value="book">Book from Library</option>
            <option value="video">Video from Library</option>
          </Select>
        </Field>
        {linkMode === 'url' && <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />}
        {linkMode === 'book' &&
          (books.length === 0 ? (
            <p className="text-xs text-muted">No books in Library yet.</p>
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
            <p className="text-xs text-muted">No videos in Library yet.</p>
          ) : (
            <Select value={selectedVideoId} onChange={(e) => setSelectedVideoId(e.target.value)}>
              {videos.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.title}
                </option>
              ))}
            </Select>
          ))}
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
