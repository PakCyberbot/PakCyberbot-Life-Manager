import { BookOpen, FileWarning, Link2, Play } from 'lucide-react';
import { getApi, useUiFocusStore } from '@life-manager/core';
import { formatDate, type Task, type TaskPriority } from '@life-manager/shared';
import { Badge } from '@life-manager/ui';
import clsx from 'clsx';
import type { MobileScreenId } from '../navigation';

const PRIORITY_TONE: Record<TaskPriority, 'default' | 'warning' | 'danger'> = {
  low: 'default',
  medium: 'warning',
  high: 'danger',
};

/** Follows a task's link the same way desktop's GoalsScreen does — a Library item jumps there
 * (via useUiFocusStore's one-shot highlight target), a URL opens externally. A file/folder link is
 * deliberately NOT handled here: mobile never opens one (see the doc comment on `openable` below). */
function openTaskLink(task: Task, onNavigate: (s: MobileScreenId) => void) {
  if (task.linkType === 'book' && task.linkTargetId) {
    useUiFocusStore.getState().setLibraryFocus({ type: 'book', id: task.linkTargetId });
    onNavigate('library');
  } else if (task.linkType === 'video' && task.linkTargetId) {
    useUiFocusStore.getState().setLibraryFocus({ type: 'video', id: task.linkTargetId });
    onNavigate('library');
  } else if (task.linkType === 'url' && task.linkPath) {
    getApi().system.openExternal(task.linkPath);
  }
}

/** A task row shared by Goal detail and Quick Tasks — tapping the title opens the task's link when
 * it has one. A file/folder link is always shown as plain text with an "on {hostname}" caption
 * instead of a tap target: unlike desktop (which can open a file/folder link when the current
 * machine's hostname matches the one it was added from), a task's file/folder path is always a
 * desktop-absolute path with no meaning on Android, so mobile has no host it could ever match —
 * this is display-only, purely so the user knows which computer to go open it on. */
export function TaskRow({
  task,
  onNavigate,
  className,
}: {
  task: Task;
  onNavigate: (s: MobileScreenId) => void;
  className?: string;
}) {
  const isFileLink = task.linkType === 'file' || task.linkType === 'folder';
  const openable = !!task.linkType && !isFileLink;
  const Icon = task.linkType === 'book' ? BookOpen : task.linkType === 'video' ? Play : task.linkType === 'url' ? Link2 : null;

  return (
    <div className={clsx('flex items-center gap-2.5 rounded-lg bg-background px-3 py-2.5 text-sm', className)}>
      <div
        className={clsx('min-w-0 flex-1', openable && 'active:opacity-60')}
        onClick={openable ? () => openTaskLink(task, onNavigate) : undefined}
        role={openable ? 'button' : undefined}
      >
        <p className={clsx('truncate font-medium', openable && 'text-accentGoals', task.status === 'done' && 'text-muted line-through')}>
          {task.title}
        </p>
        <p className="truncate text-xs text-muted">
          {task.dueDate ? formatDate(task.dueDate) : 'No due date'}
          {isFileLink && task.linkHostname ? ` · on ${task.linkHostname}` : ''}
        </p>
      </div>
      <Badge tone={PRIORITY_TONE[task.priority]}>{task.priority}</Badge>
      {isFileLink ? (
        <FileWarning size={14} className="shrink-0 text-muted" />
      ) : (
        Icon && <Icon size={14} className="shrink-0 text-accentGoals" />
      )}
    </div>
  );
}
