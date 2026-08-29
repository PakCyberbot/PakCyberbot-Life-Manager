import { useEffect } from 'react';
import { Briefcase, ExternalLink, RefreshCw, Settings as SettingsIcon } from 'lucide-react';
import { getApi, useJobsStore } from '@life-manager/core';
import { formatDate, type JobListing, type JobSearch } from '@life-manager/shared';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import type { ScreenId } from '../navigation';

export function JobsScreen({ onNavigate }: { onNavigate: (s: ScreenId) => void }) {
  const { searches, fetchSearches, fetchCachedListings, listingsBySearch, loadingBySearch, errorBySearch, refreshSearch, loaded } =
    useJobsStore();

  useEffect(() => {
    if (!loaded) fetchSearches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  useEffect(() => {
    for (const s of searches) fetchCachedListings(s.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searches.length]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
          <p className="mt-1 text-sm text-muted">Real listings from free job boards, ranked by your AI provider.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => onNavigate('settings')}>
          <SettingsIcon size={14} /> Manage searches
        </Button>
      </div>

      {searches.length === 0 ? (
        <EmptyState
          icon={<Briefcase size={28} />}
          title="No job searches yet"
          description="Add one from Settings — set keywords and what the AI should prioritize."
          action={
            <Button size="sm" onClick={() => onNavigate('settings')}>
              <SettingsIcon size={14} /> Go to Settings
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {searches.map((search) => (
            <SearchSection
              key={search.id}
              search={search}
              listings={listingsBySearch[search.id] ?? []}
              loading={!!loadingBySearch[search.id]}
              error={errorBySearch[search.id] ?? null}
              onRefresh={() => refreshSearch(search.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SearchSection({
  search,
  listings,
  loading,
  error,
  onRefresh,
}: {
  search: JobSearch;
  listings: JobListing[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{search.label}</CardTitle>
          <p className="mt-0.5 text-xs text-muted">{search.keywords}</p>
        </div>
        <div className="flex items-center gap-2">
          {search.lastFetchedAt && (
            <span className="text-xs text-muted">Updated {new Date(search.lastFetchedAt).toLocaleString()}</span>
          )}
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : undefined} /> {loading ? 'Searching…' : 'Refresh'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</p>
        ) : listings.length === 0 ? (
          <EmptyState
            title="Nothing fetched yet"
            description="Click Refresh to search RemoteOK, Arbeitnow, We Work Remotely, and Jobicy."
            action={
              <Button size="sm" onClick={onRefresh} disabled={loading}>
                <RefreshCw size={13} /> Refresh
              </Button>
            }
          />
        ) : (
          <div className="space-y-2">
            {listings.map((job) => (
              <button
                key={job.id}
                onClick={() => getApi().system.openExternal(job.url)}
                className="group flex w-full flex-col items-start gap-1 rounded-xl bg-background p-3 text-left transition-colors hover:bg-border/40"
              >
                <div className="flex w-full items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-snug">{job.title}</p>
                    <p className="text-xs text-muted">
                      {job.company ?? 'Unknown company'} {job.location && `· ${job.location}`}
                    </p>
                  </div>
                  <ExternalLink size={13} className="mt-0.5 shrink-0 text-muted group-hover:text-foreground" />
                </div>
                {job.aiNote && <p className="text-xs italic text-foreground/80">{job.aiNote}</p>}
                <div className="flex items-center gap-1.5 pt-0.5">
                  <Badge tone="money">{job.source}</Badge>
                  {job.postedAt && <span className="text-[11px] text-muted">{formatDate(job.postedAt)}</span>}
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
