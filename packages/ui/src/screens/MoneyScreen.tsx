import { useEffect, useMemo, useState } from 'react';
import { Gift, Minus, Plane, Plus, Repeat, ShoppingBag, TrendingUp, Trash2, Wallet } from 'lucide-react';
import { computeTotalSavings, useMoneyStore, useSettingsStore } from '@life-manager/core';
import {
  formatCurrency,
  formatDate,
  isSameMonth,
  type SavingsEntryType,
  type WishlistCategory,
  type WishlistStatus,
} from '@life-manager/shared';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { Field, Input, Select, Textarea } from '../components/ui/FormControls';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import clsx from 'clsx';

const CATEGORY_META: Record<WishlistCategory, { label: string; icon: typeof ShoppingBag }> = {
  purchase: { label: 'Purchase', icon: ShoppingBag },
  trip: { label: 'Trip', icon: Plane },
  subscription: { label: 'Subscription', icon: Repeat },
  investment: { label: 'Investment', icon: TrendingUp },
  other: { label: 'Other', icon: Gift },
};

const STATUS_TONE: Record<WishlistStatus, 'default' | 'success' | 'danger'> = {
  planned: 'default',
  done: 'success',
  cancelled: 'danger',
};

export function MoneyScreen() {
  const { entries, wishlist, fetchAll, removeEntry, setWishlistStatus, removeWishlistItem, loaded } = useMoneyStore();
  const { currency: defaultCurrency, loaded: settingsLoaded, load: loadSettings } = useSettingsStore();
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [wishlistDialogOpen, setWishlistDialogOpen] = useState(false);

  useEffect(() => {
    if (!loaded) fetchAll();
    if (!settingsLoaded) loadSettings();
  }, [loaded, fetchAll, settingsLoaded, loadSettings]);

  const today = new Date();
  const total = useMemo(() => computeTotalSavings(entries), [entries]);
  const monthEntries = useMemo(() => entries.filter((e) => isSameMonth(e.date, today)), [entries]);
  const addedThisMonth = useMemo(
    () => monthEntries.filter((e) => e.type === 'add').reduce((s, e) => s + e.amount, 0),
    [monthEntries]
  );
  const spentThisMonth = useMemo(
    () => monthEntries.filter((e) => e.type === 'expense').reduce((s, e) => s + e.amount, 0),
    [monthEntries]
  );
  const sortedEntries = useMemo(() => [...entries].sort((a, b) => b.date.localeCompare(a.date)), [entries]);
  const activeWishlist = wishlist.filter((w) => w.status === 'planned');
  const wishlistTotal = activeWishlist.reduce((s, w) => s + (w.estimatedCost ?? 0), 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Savings</h1>
          <p className="mt-1 text-sm text-muted">Your personal total, and what you're saving toward.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setWishlistDialogOpen(true)}>
            <Plus size={14} /> Wishlist item
          </Button>
          <Button size="sm" onClick={() => setEntryDialogOpen(true)}>
            <Plus size={14} /> Add / Expense
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="p-5">
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <Wallet size={13} /> Total savings
          </p>
          <p className="mt-1 text-2xl font-semibold">{formatCurrency(total, defaultCurrency)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-muted">Added this month</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-500">{formatCurrency(addedThisMonth, defaultCurrency)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-muted">Spent this month</p>
          <p className="mt-1 text-2xl font-semibold text-red-500">{formatCurrency(spentThisMonth, defaultCurrency)}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {sortedEntries.length === 0 ? (
              <p className="text-sm text-muted">Nothing logged yet — add your first amount.</p>
            ) : (
              sortedEntries.slice(0, 12).map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-2 rounded-lg px-1 py-1.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{e.note || (e.type === 'add' ? 'Added' : 'Expense')}</p>
                    <p className="text-xs text-muted">{formatDate(e.date)}</p>
                  </div>
                  <span className={e.type === 'expense' ? 'font-medium text-red-500' : 'font-medium text-emerald-500'}>
                    {e.type === 'expense' ? '-' : '+'}
                    {formatCurrency(e.amount, defaultCurrency)}
                  </span>
                  <button onClick={() => removeEntry(e.id)} className="text-muted hover:text-red-500">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Wishlist</CardTitle>
            <Badge tone="money">
              {activeWishlist.length} planned · {formatCurrency(wishlistTotal, defaultCurrency)}
            </Badge>
          </CardHeader>
          <CardContent>
            {wishlist.length === 0 ? (
              <EmptyState
                icon={<Gift size={24} />}
                title="Nothing on the wishlist yet"
                description="A purchase, a trip, a subscription, an investment plan — anything you're saving toward."
                action={
                  <Button size="sm" onClick={() => setWishlistDialogOpen(true)}>
                    <Plus size={14} /> Wishlist item
                  </Button>
                }
              />
            ) : (
              <div className="space-y-1.5">
                {wishlist.map((w) => {
                  const { label, icon: Icon } = CATEGORY_META[w.category];
                  return (
                    <div
                      key={w.id}
                      className={clsx(
                        'flex items-center gap-3 rounded-lg bg-background px-3 py-2.5',
                        w.status !== 'planned' && 'opacity-60'
                      )}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accentMoney/10 text-accentMoney">
                        <Icon size={15} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={clsx('truncate text-sm font-medium', w.status === 'done' && 'line-through')}>{w.title}</p>
                        <p className="truncate text-xs text-muted">
                          {label}
                          {w.estimatedCost != null ? ` · ${formatCurrency(w.estimatedCost, defaultCurrency)}` : ''}
                          {w.notes ? ` · ${w.notes}` : ''}
                        </p>
                      </div>
                      <Badge tone={STATUS_TONE[w.status]}>{w.status}</Badge>
                      <Select
                        value={w.status}
                        onChange={(e) => setWishlistStatus(w.id, e.target.value as WishlistStatus)}
                        className="h-7 w-auto text-xs"
                      >
                        <option value="planned">Planned</option>
                        <option value="done">Done</option>
                        <option value="cancelled">Cancelled</option>
                      </Select>
                      <button onClick={() => removeWishlistItem(w.id)} className="shrink-0 text-muted hover:text-red-500">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <NewEntryDialog open={entryDialogOpen} onClose={() => setEntryDialogOpen(false)} />
      <NewWishlistDialog open={wishlistDialogOpen} onClose={() => setWishlistDialogOpen(false)} />
    </div>
  );
}

function NewEntryDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addEntry } = useMoneyStore();
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<SavingsEntryType>('add');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');

  const submit = async () => {
    const numericAmount = Number(amount);
    if (!numericAmount) return;
    await addEntry({ amount: numericAmount, type, date, note: note.trim() || null });
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
              className={clsx(
                'flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                type === t ? 'bg-surface text-accentMoney shadow-sm' : 'text-muted hover:text-foreground'
              )}
            >
              {t === 'add' ? <Plus size={14} /> : <Minus size={14} />}
              {t === 'add' ? 'Add amount' : 'Expense'}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount">
            <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" autoFocus />
          </Field>
          <Field label="Date">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
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
    await addWishlistItem({
      title: title.trim(),
      category,
      estimatedCost: estimatedCost ? Number(estimatedCost) : null,
      notes: notes.trim() || null,
    });
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
        <div className="grid grid-cols-2 gap-3">
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
        </div>
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
