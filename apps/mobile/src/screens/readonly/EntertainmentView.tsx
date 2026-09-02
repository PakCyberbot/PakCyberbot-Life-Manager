import { useEffect } from 'react';
import { useEntertainmentStore } from '@life-manager/core';
import { Card, Badge, EmptyState } from '@life-manager/ui';
import { Clapperboard } from 'lucide-react';
import { SectionHeader } from '../../components/SectionHeader';
import type { MobileScreenId } from '../../navigation';

const VERDICT_TONE = { 'Worth It': 'success', Mixed: 'warning', Skip: 'danger' } as const;

export function EntertainmentView({ onNavigate }: { onNavigate: (s: MobileScreenId) => void }) {
  const { items, fetchItems, loaded } = useEntertainmentStore();

  useEffect(() => {
    if (!loaded) fetchItems();
  }, [loaded, fetchItems]);

  return (
    <div>
      <SectionHeader title="Entertainment" subtitle="View only — manage from desktop" onBack={() => onNavigate('more')} />
      {items.length === 0 ? (
        <EmptyState icon={<Clapperboard size={24} />} title="Nothing added yet" />
      ) : (
        <div className="space-y-2.5">
          {items.map((i) => (
            <Card key={i.id} className="flex gap-3 p-3.5">
              {i.thumbnail ? (
                <img src={i.thumbnail} alt="" className="h-16 w-12 shrink-0 rounded-lg object-cover" />
              ) : (
                <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded-lg bg-accentLibrary/10">
                  <Clapperboard size={16} className="text-accentLibrary" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{i.title}</p>
                <p className="text-xs capitalize text-muted">{i.type}</p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  {i.verdict && <Badge tone={VERDICT_TONE[i.verdict]}>{i.verdict}</Badge>}
                  <span className="text-xs capitalize text-muted">{i.status.replace('-', ' ')}</span>
                </div>
                {i.reasoning && <p className="mt-1 line-clamp-2 text-xs text-muted">{i.reasoning}</p>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
