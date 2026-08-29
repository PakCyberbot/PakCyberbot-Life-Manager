import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, File, Folder, FolderOpen, FolderPlus, Home, Link2, Monitor, Trash2 } from 'lucide-react';
import { getApi, useFileManagerStore } from '@life-manager/core';
import type { FileCategory, FileLink } from '@life-manager/shared';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Dialog } from '../components/ui/Dialog';
import { Field, Input } from '../components/ui/FormControls';
import { EmptyState } from '../components/ui/EmptyState';
import clsx from 'clsx';

export function FileManagerScreen() {
  const { categories, links, hostname, fetchAll, addCategory, removeCategory, addLink, removeLink, openLink, loaded } =
    useFileManagerStore();

  const [currentId, setCurrentId] = useState<string | null>(null);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded) fetchAll();
  }, [loaded, fetchAll]);

  const breadcrumb = useMemo(() => {
    const chain: FileCategory[] = [];
    let cursor = categories.find((c) => c.id === currentId);
    while (cursor) {
      chain.unshift(cursor);
      cursor = categories.find((c) => c.id === cursor!.parentId);
    }
    return chain;
  }, [categories, currentId]);

  const childCategories = useMemo(
    () => categories.filter((c) => (currentId ? c.parentId === currentId : !c.parentId)),
    [categories, currentId]
  );
  const currentLinks = useMemo(() => (currentId ? links.filter((l) => l.categoryId === currentId) : []), [links, currentId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">File Manager</h1>
            {hostname && (
              <Badge tone="default" className="gap-1">
                <Monitor size={11} /> {hostname}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted">
            Links only open on the machine they were added from — shown above. Anything linked on a different
            machine still shows up here, just not openable from this one.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setCategoryDialogOpen(true)}>
            <FolderPlus size={14} /> New category
          </Button>
          {currentId && (
            <Button size="sm" onClick={() => setLinkDialogOpen(true)}>
              <Link2 size={14} /> Add link
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1 text-sm">
        <button
          onClick={() => setCurrentId(null)}
          className={clsx('flex items-center gap-1 rounded-md px-2 py-1', !currentId ? 'bg-surface font-medium' : 'text-muted hover:bg-surface')}
        >
          <Home size={13} /> Root
        </button>
        {breadcrumb.map((c) => (
          <span key={c.id} className="flex items-center gap-1">
            <ChevronRight size={13} className="text-muted" />
            <button
              onClick={() => setCurrentId(c.id)}
              className={clsx('rounded-md px-2 py-1', c.id === currentId ? 'bg-surface font-medium' : 'text-muted hover:bg-surface')}
            >
              {c.name}
            </button>
          </span>
        ))}
      </div>

      {openError && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">{openError}</p>}

      {childCategories.length === 0 && currentLinks.length === 0 ? (
        <EmptyState
          icon={<Folder size={28} />}
          title={currentId ? 'Empty category' : 'No categories yet'}
          description="Create a category, then link real folders or files inside it."
          action={
            <Button size="sm" onClick={() => setCategoryDialogOpen(true)}>
              <FolderPlus size={14} /> New category
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {childCategories.map((c) => (
            <Card
              key={c.id}
              onClick={() => setCurrentId(c.id)}
              className="group flex cursor-pointer flex-col items-start gap-2 p-4 transition-transform hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex w-full items-start justify-between">
                <Folder size={22} className="text-accentTasks" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete "${c.name}" and everything inside it?`)) removeCategory(c.id);
                  }}
                  className="text-muted opacity-0 hover:text-red-500 group-hover:opacity-100"
                >
                  <Trash2 size={13} />
                </button>
              </div>
              <p className="text-sm font-medium leading-snug">{c.name}</p>
            </Card>
          ))}

          {currentLinks.map((link) => (
            <LinkCard
              key={link.id}
              link={link}
              hostname={hostname}
              onOpen={async () => {
                setOpenError(null);
                const result = await openLink(link);
                if (!result.ok) setOpenError(result.error ?? 'Could not open this.');
              }}
              onRemove={() => removeLink(link.id)}
            />
          ))}
        </div>
      )}

      <NewCategoryDialog
        open={categoryDialogOpen}
        onClose={() => setCategoryDialogOpen(false)}
        onCreate={(name) => addCategory(name, currentId)}
      />
      {currentId && (
        <NewLinkDialog
          open={linkDialogOpen}
          onClose={() => setLinkDialogOpen(false)}
          onCreate={(label, path, isFolder) => addLink(currentId, label, path, isFolder)}
        />
      )}
    </div>
  );
}

function LinkCard({
  link,
  hostname,
  onOpen,
  onRemove,
}: {
  link: FileLink;
  hostname: string | null;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const onOtherMachine = hostname !== null && link.hostname !== hostname;
  const Icon = link.isFolder ? FolderOpen : File;

  return (
    <Card className="group flex flex-col items-start gap-2 p-4">
      <button
        onClick={onOpen}
        disabled={onOtherMachine}
        title={onOtherMachine ? `Only available on ${link.hostname}` : link.path}
        className={clsx('flex w-full flex-1 flex-col items-start gap-2 text-left', onOtherMachine && 'cursor-not-allowed opacity-50')}
      >
        <Icon size={22} className="text-accentMoney" />
        <p className="text-sm font-medium leading-snug">{link.label}</p>
        <p className="w-full truncate text-xs text-muted">{link.path}</p>
      </button>
      <div className="flex w-full items-center justify-between gap-2">
        <span
          className={clsx(
            'flex items-center gap-1 truncate text-[11px]',
            onOtherMachine ? 'text-amber-500' : 'text-emerald-500'
          )}
          title={link.hostname}
        >
          <Monitor size={11} className="shrink-0" />
          {link.hostname}
        </span>
        <button onClick={onRemove} className="shrink-0 text-muted opacity-0 hover:text-red-500 group-hover:opacity-100">
          <Trash2 size={13} />
        </button>
      </div>
    </Card>
  );
}

function NewCategoryDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState('');

  const submit = () => {
    if (!name.trim()) return;
    onCreate(name.trim());
    setName('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title="New category">
      <div className="space-y-3">
        <Field label="Name">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Cybersecurity"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!name.trim()}>
            Create
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function NewLinkDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (label: string, path: string, isFolder: boolean) => void;
}) {
  const [label, setLabel] = useState('');
  const [path, setPath] = useState('');
  const [isFolder, setIsFolder] = useState(true);

  const browse = async () => {
    const picked = await getApi().dialog.pickFileOrFolder();
    if (picked) {
      setPath(picked.path);
      setIsFolder(picked.isFolder);
      if (!label.trim()) {
        const base = picked.path.split(/[\\/]/).filter(Boolean).pop() ?? picked.path;
        setLabel(base);
      }
    }
  };

  const submit = () => {
    if (!label.trim() || !path.trim()) return;
    onCreate(label.trim(), path.trim(), isFolder);
    setLabel('');
    setPath('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title="Add folder or file link">
      <div className="space-y-3">
        <Field label="Path">
          <div className="flex gap-2">
            <Input value={path} readOnly placeholder="No path selected" className="flex-1" />
            <Button variant="outline" size="sm" onClick={browse} type="button">
              Browse
            </Button>
          </div>
        </Field>
        <Field label="Label">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Nmap scripts" />
        </Field>
        <p className="text-xs text-muted">
          Linked to this machine — if this category is ever viewed on another one (e.g. after Drive sync), this entry
          shows up there too but can't be opened, since the path won't exist there.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!label.trim() || !path.trim()}>
            Add
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
