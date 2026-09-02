import { useEffect } from 'react';
import { useEarningWaysStore } from '@life-manager/core';
import { Card, CardContent, CardHeader, CardTitle, Badge, EmptyState } from '@life-manager/ui';
import { Banknote } from 'lucide-react';
import { SectionHeader } from '../../components/SectionHeader';
import type { MobileScreenId } from '../../navigation';

export function EarningWaysView({ onNavigate }: { onNavigate: (s: MobileScreenId) => void }) {
  const { items, fetchItems, loaded } = useEarningWaysStore();

  useEffect(() => {
    if (!loaded) fetchItems();
  }, [loaded, fetchItems]);

  return (
    <div>
      <SectionHeader title="Earning Ways" subtitle="View only — manage from desktop" onBack={() => onNavigate('more')} />
      {items.length === 0 ? (
        <EmptyState icon={<Banknote size={24} />} title="No ideas yet" />
      ) : (
        <div className="space-y-2.5">
          {items.map((i) => (
            <Card key={i.id}>
              <CardHeader>
                <CardTitle>{i.title}</CardTitle>
                <Badge tone="money" className="capitalize">
                  {i.status}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-1.5">
                <p className="text-xs capitalize text-muted">
                  {i.category} · {i.source === 'ai' ? 'AI suggested' : 'Your idea'}
                </p>
                {i.notes && <p className="text-sm text-muted">{i.notes}</p>}
                {i.guideOverview && <p className="line-clamp-3 text-xs text-muted">{i.guideOverview}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
