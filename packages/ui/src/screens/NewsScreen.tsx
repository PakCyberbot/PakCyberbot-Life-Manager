import { useEffect } from 'react';
import { ExternalLink, Newspaper, RefreshCw, Settings as SettingsIcon } from 'lucide-react';
import { getApi, useNewsStore } from '@life-manager/core';
import { formatDate, type NewsCategory, type NewsItem } from '@life-manager/shared';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import type { ScreenId } from '../navigation';
import clsx from 'clsx';

export function NewsScreen({ onNavigate }: { onNavigate: (s: ScreenId) => void }) {
  const { categories, itemsByCategory, loadingByCategory, errorByCategory, loaded, fetchCategories, fetchCachedItems, refreshCategory } =
    useNewsStore();

  useEffect(() => {
    if (!loaded) fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  useEffect(() => {
    for (const c of categories) fetchCachedItems(c.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories.length]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">News & Updates</h1>
          <p className="mt-1 text-sm text-muted">Real articles, ranked and summarized for what you care about.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => onNavigate('settings')}>
          <SettingsIcon size={14} /> Manage categories
        </Button>
      </div>

      {categories.length === 0 ? (
        <EmptyState
          icon={<Newspaper size={28} />}
          title="No categories yet"
          description="Add one from Settings — starts seeded with Cybersecurity, Global Politics, and Country/City."
        />
      ) : (
        <div className="space-y-6">
          {categories.map((category) => (
            <CategorySection
              key={category.id}
              category={category}
              items={itemsByCategory[category.id] ?? []}
              loading={!!loadingByCategory[category.id]}
              error={errorByCategory[category.id] ?? null}
              onRefresh={() => refreshCategory(category.id)}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CategorySection({
  category,
  items,
  loading,
  error,
  onRefresh,
  onNavigate,
}: {
  category: NewsCategory;
  items: NewsItem[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onNavigate: (s: ScreenId) => void;
}) {
  const needsLocation = (category.type === 'country' || category.type === 'city') && !category.locationValue;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>{category.name}</CardTitle>
          <Badge tone="library" className="capitalize">
            {category.type.replace('-', ' ')}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {category.lastFetchedAt && (
            <span className="text-xs text-muted">Updated {new Date(category.lastFetchedAt).toLocaleString()}</span>
          )}
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading || needsLocation}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : undefined} /> {loading ? 'Fetching…' : 'Refresh'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {needsLocation ? (
          <EmptyState
            title={`Set a ${category.type} in Settings`}
            description="This category needs a location before it can fetch anything."
            action={
              <Button size="sm" variant="outline" onClick={() => onNavigate('settings')}>
                Go to Settings
              </Button>
            }
          />
        ) : error ? (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</p>
        ) : items.length === 0 ? (
          <EmptyState
            title="Nothing fetched yet"
            description="Click Refresh to pull the latest."
            action={
              <Button size="sm" onClick={onRefresh} disabled={loading}>
                <RefreshCw size={13} /> Refresh
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => getApi().system.openExternal(item.url)}
                className="group flex flex-col items-start gap-1 rounded-xl bg-background p-3 text-left transition-colors hover:bg-border/40"
              >
                <div className="flex w-full items-start justify-between gap-2">
                  <p className="text-sm font-medium leading-snug">{item.title}</p>
                  <ExternalLink size={13} className="mt-0.5 shrink-0 text-muted group-hover:text-foreground" />
                </div>
                {item.summary && <p className="text-xs text-muted">{item.summary}</p>}
                <p className={clsx('text-[11px] text-muted', !item.summary && 'mt-0.5')}>
                  {item.source ?? 'Unknown source'}
                  {item.publishedAt && ` · ${formatDate(item.publishedAt)}`}
                </p>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
