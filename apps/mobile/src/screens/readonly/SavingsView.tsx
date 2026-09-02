import { useState, useEffect } from 'react';
import { useMoneyStore, useSettingsStore, computeTotalSavings } from '@life-manager/core';
import { formatCurrency, formatDate, type SavingsEntryType, type WishlistCategory, type WishlistItem, type WishlistStatus } from '@life-manager/shared';
import { Card, CardContent, Badge, Button, Dialog, EmptyState, Field, Input, Select, Textarea } from '@life-manager/ui';
import { Minus, Pencil, Plus, Trash2, Wallet } from 'lucide-react';
import { SectionHeader } from '../../components/SectionHeader';
import type { MobileScreenId } from '../../navigation';

// Savings display is exactly as before; editing is new and gated behind a
// top-right "Edit" toggle (same pattern as Goals' Quick Tasks) so a stray
// tap on a small phone screen can't misfire into a delete — off means pure
// display, on reveals Add/Edit/Delete everywhere.
export function SavingsView({ onNavigate }: { onNavigate: (s: MobileScreenId) => void }) {
  const { entries, wishlist, fetchAll, loaded, removeEntry, setWishlistStatus, removeWishlistItem } = useMoneyStore();
  const { currency, loaded: settingsLoaded, load: loadSettings } = useSettingsStore();
  const [editMode, setEditMode] = useState(false);
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [wishlistDialogOpen, setWishlistDialogOpen] = useState(false);
  const [editingWishlistItem, setEditingWishlistItem] = useState<WishlistItem | null>(null);

  useEffect(() => {
    if (!loaded) fetchAll();
    if (!settingsLoaded) loadSettings();
  }, [loaded, fetchAll, settingsLoaded, loadSettings]);

  const total = computeTotalSavings(entries);

  return (
    <div>
      <SectionHeader
        title="Savings"
        subtitle={editMode ? 'Editing' : 'Tap Edit to add or change anything'}
        onBack={() => onNavigate('more')}
        right={
          <Button size="sm" variant={editMode ? 'primary' : 'outline'} onClick={() => setEditMode((v) => !v)}>
            {editMode ? 'Done' : 'Edit'}
          </Button>
        }
      />

      <Card className="mb-5 p-5 text-center">
        <p className="text-xs text-muted">Total savings</p>
        <p className="mt-1 text-3xl font-semibold tracking-tight text-accentMoney">{formatCurrency(total, currency)}</p>
      </Card>

      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted">Wishlist</h2>
        {editMode && (
          <Button size="sm" variant="outline" onClick={() => setWishlistDialogOpen(true)}>
            <Plus size={13} /> Add
          </Button>
        )}
      </div>
      {wishlist.length === 0 ? (
        <EmptyState icon={<Wallet size={20} />} title="Nothing on the wishlist" />
      ) : (
        <div className="mb-6 space-y-2.5">
          {wishlist.map((w) => (
            <Card key={w.id} className="flex items-center gap-2 p-3.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{w.title}</p>
                <p className="text-xs capitalize text-muted">{w.category}</p>
              </div>
              <div className="shrink-0 text-right">
                {w.estimatedCost != null && <p className="text-sm font-medium">{formatCurrency(w.estimatedCost, currency)}</p>}
                {editMode ? (
                  <select
                    value={w.status}
                    onChange={(e) => setWishlistStatus(w.id, e.target.value as WishlistStatus)}
                    className="mt-0.5 w-fit rounded-md border border-border bg-background px-1.5 py-0.5 text-[11px] capitalize"
                  >
                    <option value="planned">Planned</option>
                    <option value="done">Done</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                ) : (
                  <Badge tone={w.status === 'done' ? 'success' : w.status === 'cancelled' ? 'danger' : 'money'} className="mt-0.5 capitalize">
                    {w.status}
                  </Badge>
                )}
              </div>
              {editMode && (
                <div className="flex shrink-0 flex-col gap-1.5">
                  <button onClick={() => setEditingWishlistItem(w)} className="text-muted active:text-foreground">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => removeWishlistItem(w.id)} className="text-muted active:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted">Recent activity</h2>
        {editMode && (
          <Button size="sm" variant="outline" onClick={() => setEntryDialogOpen(true)}>
            <Plus size={13} /> Add
          </Button>
        )}
      </div>
      {entries.length === 0 ? (
        <EmptyState title="No entries yet" />
      ) : (
        <Card>
          <CardContent className="space-y-2 p-3">
            {entries.slice(0, 20).map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded-lg bg-background px-3 py-2">
                <div>
                  <p className="text-sm">{e.note || (e.type === 'add' ? 'Added' : 'Spent')}</p>
                  <p className="text-xs text-muted">{formatDate(e.date)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <p className={`text-sm font-medium ${e.type === 'add' ? 'text-emerald-500' : 'text-red-500'}`}>
                    {e.type === 'add' ? '+' : '-'}
                    {formatCurrency(e.amount, currency)}
                  </p>
                  {editMode && (
                    <button onClick={() => removeEntry(e.id)} className="text-muted active:text-red-500">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <NewEntryDialog open={entryDialogOpen} onClose={() => setEntryDialogOpen(false)} />
      <NewWishlistDialog open={wishlistDialogOpen} onClose={() => setWishlistDialogOpen(false)} />
      {editingWishlistItem && <EditWishlistDialog item={editingWishlistItem} onClose={() => setEditingWishlistItem(null)} />}
    </div>
  );
}

function NewEntryDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addEntry } = useMoneyStore();
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<SavingsEntryType>('add');
  const [note, setNote] = useState('');

  const submit = async () => {
    const numericAmount = Number(amount);
    if (!numericAmount) return;
    await addEntry({ amount: numericAmount, type, date: new Date().toISOString().slice(0, 10), note: note.trim() || null });
    setAmount('');
    setNote('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title="Add to savings or log an expense">
      <div className="space-y-3">
        <div className="inline-flex w-full items-center gap-0.5 rounded-lg border border-border bg-background p-0.5">
          {(['add', 'expense'] as SavingsEntryType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${
                type === t ? 'bg-surface text-accentMoney shadow-sm' : 'text-muted'
              }`}
            >
              {t === 'add' ? <Plus size={14} /> : <Minus size={14} />}
              {t === 'add' ? 'Add amount' : 'Expense'}
            </button>
          ))}
        </div>
        <Field label="Amount">
          <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" autoFocus />
        </Field>
        <Field label="Note (optional)">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Salary, groceries" />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!Number(amount)}>
            {type === 'add' ? 'Add' : 'Log expense'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function NewWishlistDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addWishlistItem } = useMoneyStore();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<WishlistCategory>('purchase');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [notes, setNotes] = useState('');

  const submit = async () => {
    if (!title.trim()) return;
    await addWishlistItem({ title: title.trim(), category, estimatedCost: estimatedCost ? Number(estimatedCost) : null, notes: notes.trim() || null });
    setTitle('');
    setEstimatedCost('');
    setNotes('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title="New wishlist item">
      <div className="space-y-3">
        <Field label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. New laptop, Japan trip" autoFocus />
        </Field>
        <Field label="Category">
          <Select value={category} onChange={(e) => setCategory(e.target.value as WishlistCategory)}>
            <option value="purchase">Purchase</option>
            <option value="trip">Trip</option>
            <option value="subscription">Subscription</option>
            <option value="investment">Investment</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field label="Estimated cost (optional)">
          <Input type="number" min={0} step="0.01" value={estimatedCost} onChange={(e) => setEstimatedCost(e.target.value)} />
        </Field>
        <Field label="Notes (optional)">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!title.trim()}>
            Add to wishlist
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function EditWishlistDialog({ item, onClose }: { item: WishlistItem; onClose: () => void }) {
  const { editWishlistItem } = useMoneyStore();
  const [title, setTitle] = useState(item.title);
  const [category, setCategory] = useState<WishlistCategory>(item.category);
  const [estimatedCost, setEstimatedCost] = useState(item.estimatedCost != null ? String(item.estimatedCost) : '');
  const [notes, setNotes] = useState(item.notes ?? '');

  const submit = async () => {
    if (!title.trim()) return;
    await editWishlistItem(item.id, {
      title: title.trim(),
      category,
      estimatedCost: estimatedCost ? Number(estimatedCost) : null,
      notes: notes.trim() || null,
    });
    onClose();
  };

  return (
    <Dialog open onClose={onClose} title="Edit wishlist item">
      <div className="space-y-3">
        <Field label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </Field>
        <Field label="Category">
          <Select value={category} onChange={(e) => setCategory(e.target.value as WishlistCategory)}>
            <option value="purchase">Purchase</option>
            <option value="trip">Trip</option>
            <option value="subscription">Subscription</option>
            <option value="investment">Investment</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field label={item.status === 'done' ? 'Actual cost' : 'Estimated cost'}>
          <Input type="number" min={0} step="0.01" value={estimatedCost} onChange={(e) => setEstimatedCost(e.target.value)} />
        </Field>
        <Field label="Notes (optional)">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {item.status === 'done' && item.purchaseEntryId && (
          <p className="text-[11px] text-muted">Already marked done — changing the cost updates the linked savings transaction to match.</p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!title.trim()}>
            Save changes
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
