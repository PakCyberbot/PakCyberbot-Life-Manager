import { create } from 'zustand';
import { newId, nowIso, type Account, type Budget, type Transaction } from '@life-manager/shared';
import { getApi } from '../api';

export interface NewAccountInput {
  name: string;
  type: Account['type'];
  currency: string;
  startingBalance: number;
}

export interface NewTransactionInput {
  accountId: string;
  amount: number;
  type: Transaction['type'];
  category?: string | null;
  date: string;
  note?: string | null;
}

export interface NewBudgetInput {
  category: string;
  monthlyLimit: number;
}

interface MoneyState {
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  loading: boolean;
  loaded: boolean;
  fetchAll: () => Promise<void>;

  addAccount: (input: NewAccountInput) => Promise<void>;
  removeAccount: (id: string) => Promise<void>;

  addTransaction: (input: NewTransactionInput) => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;

  addBudget: (input: NewBudgetInput) => Promise<void>;
  removeBudget: (id: string) => Promise<void>;
}

export const useMoneyStore = create<MoneyState>((set, get) => ({
  accounts: [],
  transactions: [],
  budgets: [],
  loading: false,
  loaded: false,

  async fetchAll() {
    set({ loading: true });
    const [accounts, transactions, budgets] = await Promise.all([
      getApi().db.list<Account>('accounts'),
      getApi().db.list<Transaction>('transactions'),
      getApi().db.list<Budget>('budgets'),
    ]);
    set({ accounts, transactions, budgets, loading: false, loaded: true });
  },

  async addAccount(input) {
    const account: Account = {
      id: newId(),
      name: input.name,
      type: input.type,
      currency: input.currency,
      startingBalance: input.startingBalance,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      deletedAt: null,
    };
    await getApi().db.create('accounts', account);
    set({ accounts: [account, ...get().accounts] });
  },

  async removeAccount(id) {
    await getApi().db.remove('accounts', id);
    set({ accounts: get().accounts.filter((a) => a.id !== id) });
  },

  async addTransaction(input) {
    const transaction: Transaction = {
      id: newId(),
      accountId: input.accountId,
      amount: input.amount,
      type: input.type,
      category: input.category ?? null,
      date: input.date,
      note: input.note ?? null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      deletedAt: null,
    };
    await getApi().db.create('transactions', transaction);
    set({ transactions: [transaction, ...get().transactions] });
  },

  async removeTransaction(id) {
    await getApi().db.remove('transactions', id);
    set({ transactions: get().transactions.filter((t) => t.id !== id) });
  },

  async addBudget(input) {
    const budget: Budget = {
      id: newId(),
      category: input.category,
      monthlyLimit: input.monthlyLimit,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      deletedAt: null,
    };
    await getApi().db.create('budgets', budget);
    set({ budgets: [budget, ...get().budgets] });
  },

  async removeBudget(id) {
    await getApi().db.remove('budgets', id);
    set({ budgets: get().budgets.filter((b) => b.id !== id) });
  },
}));

/** Current balance = starting balance + signed sum of all transactions on that account. */
export function computeAccountBalance(account: Account, transactions: Transaction[]): number {
  const delta = transactions
    .filter((t) => t.accountId === account.id)
    .reduce((sum, t) => sum + (t.type === 'expense' ? -t.amount : t.amount), 0);
  return account.startingBalance + delta;
}
