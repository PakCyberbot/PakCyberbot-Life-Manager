import { useEffect } from 'react';
import { useJobsStore } from '@life-manager/core';
import { Card, EmptyState } from '@life-manager/ui';
import { Briefcase } from 'lucide-react';
import { SectionHeader } from '../../components/SectionHeader';
import type { MobileScreenId } from '../../navigation';

export function JobsView({ onNavigate }: { onNavigate: (s: MobileScreenId) => void }) {
  const { searches, listingsBySearch, fetchSearches, fetchCachedListings, loaded } = useJobsStore();

  useEffect(() => {
    if (!loaded) fetchSearches();
  }, [loaded, fetchSearches]);

  useEffect(() => {
    for (const s of searches) fetchCachedListings(s.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searches.length]);

  const allListings = searches.flatMap((s) => listingsBySearch[s.id] ?? []);

  return (
    <div>
      <SectionHeader title="Jobs" subtitle="View only — manage from desktop" onBack={() => onNavigate('more')} />
      {allListings.length === 0 ? (
        <EmptyState icon={<Briefcase size={24} />} title="No listings yet" description="Refresh a search on desktop and sync." />
      ) : (
        <div className="space-y-2.5">
          {allListings.map((j) => (
            <Card key={j.id} className="p-3.5">
              <p className="text-sm font-medium">{j.title}</p>
              <p className="text-xs text-muted">
                {j.company ?? 'Unknown company'}
                {j.location && ` · ${j.location}`}
              </p>
              {j.aiNote && <p className="mt-1 text-xs text-muted">{j.aiNote}</p>}
              <p className="mt-1 text-[11px] uppercase tracking-wide text-muted">{j.source}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
