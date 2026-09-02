import { useEffect } from 'react';
import { useMoneyStore, useSettingsStore, computeTotalSavings } from '@life-manager/core';
import { formatCurrency, formatDate } from '@life-manager/shared';
import { Card, CardContent, Badge, EmptyState } from '@life-manager/ui';
import { Wallet } from 'lucide-react';
import { SectionHeader } from '../../components/SectionHeader';
import type { MobileScreenId } from '../../navigation';

export function SavingsView({ onNavigate }: { onNavigate: (s: MobileScreenId) => void }) {
  const { entries, wishlist, fetchAll, loaded } = useMoneyStore();
  const { currency, loaded: settingsLoaded, load: loadSettings } = useSettingsStore();

  useEffect(() => {
    if (!loaded) fetchAll();
    if (!settingsLoaded) loadSettings();
  }, [loaded, fetchAll, settingsLoaded, loadSettings]);

  const total = computeTotalSavings(entries);

  return (
    <div>
      <SectionHeader title="Savings" subtitle="View only — manage from desktop" onBack={() => onNavigate('more')} />

      <Card className="mb-5 p-5 text-center">
        <p className="text-xs text-muted">Total savings</p>
        <p className="mt-1 text-3xl font-semibold tracking-tight text-accentMoney">{formatCurrency(total, currency)}</p>
      </Card>

      <h2 className="mb-2 text-sm font-semibold text-muted">Wishlist</h2>
      {wishlist.length === 0 ? (
        <EmptyState icon={<Wallet size={20} />} title="Nothing on the wishlist" />
      ) : (
        <div className="mb-6 space-y-2.5">
          {wishlist.map((w) => (
            <Card key={w.id} className="flex items-center justify-between p-3.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{w.title}</p>
                <p className="text-xs capitalize text-muted">{w.category}</p>
              </div>
              <div className="ml-3 shrink-0 text-right">
                {w.estimatedCost != null && <p className="text-sm font-medium">{formatCurrency(w.estimatedCost, currency)}</p>}
                <Badge tone={w.status === 'done' ? 'success' : w.status === 'cancelled' ? 'danger' : 'money'} className="mt-0.5 capitalize">
                  {w.status}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      )}

      <h2 className="mb-2 text-sm font-semibold text-muted">Recent activity</h2>
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
                <p className={`text-sm font-medium ${e.type === 'add' ? 'text-emerald-500' : 'text-red-500'}`}>
                  {e.type === 'add' ? '+' : '-'}
                  {formatCurrency(e.amount, currency)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
