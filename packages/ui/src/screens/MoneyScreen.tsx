import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Wallet } from 'lucide-react';
import { computeAccountBalance, useMoneyStore, useSettingsStore } from '@life-manager/core';
import { formatCurrency, formatDate, isSameMonth, type AccountType, type TransactionType } from '@life-manager/shared';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { Field, Input, Select } from '../components/ui/FormControls';
import { Badge } from '../components/ui/Badge';
import { ProgressBar } from '../components/ui/ProgressBar';
import { EmptyState } from '../components/ui/EmptyState';

export function MoneyScreen() {
  const {
    accounts,
    transactions,
    budgets,
    fetchAll,
    addAccount,
    removeAccount,
    addTransaction,
    removeTransaction,
    addBudget,
    removeBudget,
    loaded,
  } = useMoneyStore();

  const { currency: defaultCurrency, loaded: settingsLoaded, load: loadSettings } = useSettingsStore();

  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [txnDialogOpen, setTxnDialogOpen] = useState(false);
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);

  useEffect(() => {
    if (!loaded) fetchAll();
    if (!settingsLoaded) loadSettings();
  }, [loaded, fetchAll, settingsLoaded, loadSettings]);

  const today = new Date();
  const netWorth = useMemo(
    () => accounts.reduce((sum, a) => sum + computeAccountBalance(a, transactions), 0),
    [accounts, transactions]
  );
  const monthTxns = useMemo(() => transactions.filter((t) => isSameMonth(t.date, today)), [transactions]);
  const income = useMemo(() => monthTxns.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0), [monthTxns]);
  const expense = useMemo(() => monthTxns.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0), [monthTxns]);
  const spentByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of monthTxns) {
      if (t.type !== 'expense' || !t.category) continue;
      map[t.category] = (map[t.category] ?? 0) + t.amount;
    }
    return map;
  }, [monthTxns]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Money</h1>
          <p className="mt-1 text-sm text-muted">Accounts, transactions, and budgets, together.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setAccountDialogOpen(true)}>
            <Plus size={14} /> Account
          </Button>
          <Button size="sm" onClick={() => setTxnDialogOpen(true)}>
            <Plus size={14} /> Transaction
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs text-muted">Net worth</p>
          <p className="mt-1 text-2xl font-semibold">{formatCurrency(netWorth, defaultCurrency)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-muted">Income this month</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-500">{formatCurrency(income, defaultCurrency)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-muted">Expenses this month</p>
          <p className="mt-1 text-2xl font-semibold text-red-500">{formatCurrency(expense, defaultCurrency)}</p>
        </Card>
      </div>

      <div>
        <p className="mb-3 text-sm font-semibold">Accounts</p>
        {accounts.length === 0 ? (
          <EmptyState icon={<Wallet size={24} />} title="No accounts yet" description="Add a cash, bank, or credit account to start tracking." />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {accounts.map((a) => (
              <Card key={a.id} className="p-4">
                <div className="mb-1 flex items-center justify-between">
                  <Badge tone="money">{a.type}</Badge>
                  <button onClick={() => removeAccount(a.id)} className="text-muted hover:text-red-500">
                    <Trash2 size={13} />
                  </button>
                </div>
                <p className="text-sm font-medium">{a.name}</p>
                <p className="mt-1 text-lg font-semibold">{formatCurrency(computeAccountBalance(a, transactions), a.currency)}</p>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent transactions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {transactions.length === 0 ? (
              <p className="text-sm text-muted">No transactions yet.</p>
            ) : (
              transactions.slice(0, 8).map((t) => {
                const account = accounts.find((a) => a.id === t.accountId);
                return (
                  <div key={t.id} className="flex items-center justify-between gap-2 rounded-lg px-1 py-1.5 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{t.category || t.note || t.type}</p>
                      <p className="text-xs text-muted">
                        {formatDate(t.date)} · {account?.name ?? 'Unknown account'}
                      </p>
                    </div>
                    <span className={t.type === 'expense' ? 'font-medium text-red-500' : 'font-medium text-emerald-500'}>
                      {t.type === 'expense' ? '-' : '+'}
                      {formatCurrency(t.amount, account?.currency)}
                    </span>
                    <button onClick={() => removeTransaction(t.id)} className="text-muted hover:text-red-500">
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Budgets this month</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setBudgetDialogOpen(true)}>
              <Plus size={14} /> Add
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {budgets.length === 0 ? (
              <p className="text-sm text-muted">No budgets set yet.</p>
            ) : (
              budgets.map((b) => {
                const spent = spentByCategory[b.category] ?? 0;
                const pct = b.monthlyLimit > 0 ? Math.round((spent / b.monthlyLimit) * 100) : 0;
                return (
                  <div key={b.id}>
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="font-medium">{b.category}</span>
                      <span className="text-muted">
                        {formatCurrency(spent, defaultCurrency)} / {formatCurrency(b.monthlyLimit, defaultCurrency)}
                      </span>
                    </div>
                    <ProgressBar value={pct} toneClassName={pct >= 100 ? 'bg-red-500' : 'bg-accentMoney'} />
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <AccountDialog open={accountDialogOpen} onClose={() => setAccountDialogOpen(false)} onCreate={addAccount} />
      <TransactionDialog
        open={txnDialogOpen}
        onClose={() => setTxnDialogOpen(false)}
        accounts={accounts}
        onCreate={addTransaction}
      />
      <BudgetDialog open={budgetDialogOpen} onClose={() => setBudgetDialogOpen(false)} onCreate={addBudget} />
    </div>
  );
}

function AccountDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: ReturnType<typeof useMoneyStore.getState>['addAccount'];
}) {
  const defaultCurrency = useSettingsStore((s) => s.currency);
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('cash');
  const [currency, setCurrency] = useState(defaultCurrency);
  const [startingBalance, setStartingBalance] = useState('0');

  useEffect(() => setCurrency(defaultCurrency), [defaultCurrency]);

  const submit = async () => {
    if (!name.trim()) return;
    await onCreate({ name: name.trim(), type, currency, startingBalance: Number(startingBalance) || 0 });
    setName('');
    setStartingBalance('0');
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title="New account">
      <div className="space-y-3">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Main bank account" autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select value={type} onChange={(e) => setType(e.target.value as AccountType)}>
              <option value="cash">Cash</option>
              <option value="bank">Bank</option>
              <option value="credit">Credit</option>
              <option value="investment">Investment</option>
            </Select>
          </Field>
          <Field label="Currency">
            <Input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} />
          </Field>
        </div>
        <Field label="Starting balance">
          <Input type="number" value={startingBalance} onChange={(e) => setStartingBalance(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!name.trim()}>
            Create account
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function TransactionDialog({
  open,
  onClose,
  accounts,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  accounts: ReturnType<typeof useMoneyStore.getState>['accounts'];
  onCreate: ReturnType<typeof useMoneyStore.getState>['addTransaction'];
}) {
  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>('expense');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');

  useEffect(() => {
    if (open && !accountId && accounts.length > 0) setAccountId(accounts[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, accounts]);

  const submit = async () => {
    const numericAmount = Number(amount);
    if (!accountId || !numericAmount) return;
    await onCreate({ accountId, amount: numericAmount, type, category: category.trim() || null, date, note: note.trim() || null });
    setAmount('');
    setCategory('');
    setNote('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title="New transaction">
      {accounts.length === 0 ? (
        <p className="text-sm text-muted">Add an account first.</p>
      ) : (
        <div className="space-y-3">
          <Field label="Account">
            <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount">
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" autoFocus />
            </Field>
            <Field label="Type">
              <Select value={type} onChange={(e) => setType(e.target.value as TransactionType)}>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
                <option value="transfer">Transfer</option>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Groceries" />
            </Field>
            <Field label="Date">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </div>
          <Field label="Note">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={!accountId || !Number(amount)}>
              Add transaction
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function BudgetDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: ReturnType<typeof useMoneyStore.getState>['addBudget'];
}) {
  const [category, setCategory] = useState('');
  const [monthlyLimit, setMonthlyLimit] = useState('');

  const submit = async () => {
    if (!category.trim() || !Number(monthlyLimit)) return;
    await onCreate({ category: category.trim(), monthlyLimit: Number(monthlyLimit) });
    setCategory('');
    setMonthlyLimit('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title="New budget">
      <div className="space-y-3">
        <Field label="Category">
          <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Groceries" autoFocus />
        </Field>
        <Field label="Monthly limit">
          <Input type="number" value={monthlyLimit} onChange={(e) => setMonthlyLimit(e.target.value)} placeholder="0.00" />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!category.trim() || !Number(monthlyLimit)}>
            Create budget
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
