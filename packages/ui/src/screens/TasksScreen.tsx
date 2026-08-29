import { useEffect, useMemo, useState } from 'react';
import { CheckSquare, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useTasksStore } from '@life-manager/core';
import { formatDate, type Task, type TaskPriority, type TaskStatus } from '@life-manager/shared';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { Field, Input, Select, Textarea } from '../components/ui/FormControls';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';

const COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: 'todo', label: 'To do' },
  { id: 'in-progress', label: 'In progress' },
  { id: 'done', label: 'Done' },
];

const PRIORITY_TONE: Record<TaskPriority, 'default' | 'warning' | 'danger'> = {
  low: 'default',
  medium: 'warning',
  high: 'danger',
};

export function TasksScreen() {
  const { tasks, fetchTasks, addTask, setStatus, removeTask, loaded } = useTasksStore();
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (!loaded) fetchTasks();
  }, [loaded, fetchTasks]);

  const byColumn = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = { todo: [], 'in-progress': [], done: [] };
    for (const t of tasks) map[t.status].push(t);
    return map;
  }, [tasks]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          <p className="mt-1 text-sm text-muted">Everything on your plate, one board.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus size={16} />
          New task
        </Button>
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          icon={<CheckSquare size={28} />}
          title="No tasks yet"
          description="Add the next thing you need to do."
          action={
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus size={14} /> New task
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {COLUMNS.map((col) => (
            <div key={col.id} className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <p className="text-sm font-semibold">{col.label}</p>
                <Badge>{byColumn[col.id].length}</Badge>
              </div>
              <div className="space-y-2.5">
                {byColumn[col.id].map((t) => (
                  <Card key={t.id} className="p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-medium ${t.status === 'done' ? 'text-muted line-through' : ''}`}>
                        {t.title}
                      </p>
                      <button onClick={() => removeTask(t.id)} className="shrink-0 text-muted hover:text-red-500">
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Badge tone={PRIORITY_TONE[t.priority]}>{t.priority}</Badge>
                        {t.dueDate && <span className="text-xs text-muted">{formatDate(t.dueDate)}</span>}
                      </div>
                      {col.id !== 'done' && (
                        <button
                          onClick={() =>
                            setStatus(t.id, col.id === 'todo' ? 'in-progress' : 'done')
                          }
                          className="flex items-center gap-0.5 text-xs font-medium text-primary hover:opacity-80"
                        >
                          Move <ChevronRight size={12} />
                        </button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateTaskDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreate={addTask} />
    </div>
  );
}

function CreateTaskDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: ReturnType<typeof useTasksStore.getState>['addTask'];
}) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');

  const reset = () => {
    setTitle('');
    setNotes('');
    setDueDate('');
    setPriority('medium');
  };

  const submit = async () => {
    if (!title.trim()) return;
    await onCreate({ title: title.trim(), notes: notes.trim() || null, dueDate: dueDate || null, priority });
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title="New task">
      <div className="space-y-3">
        <Field label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Reply to client email" autoFocus />
        </Field>
        <Field label="Notes">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Due date">
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
          <Field label="Priority">
            <Select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </Select>
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!title.trim()}>
            Create task
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
