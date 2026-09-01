import { useEffect } from 'react';
import { ExternalLink, Globe, MonitorPlay, Newspaper, RefreshCw, Settings as SettingsIcon } from 'lucide-react';
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

  const blogCategories = categories.filter((c) => c.type === 'blog');
  const digestCategories = categories.filter((c) => c.type !== 'blog');

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
        <>
          <BlogsSection
            categories={blogCategories}
            loadingByCategory={loadingByCategory}
            onRefresh={(id) => refreshCategory(id)}
            onNavigate={onNavigate}
          />

          <div className="space-y-6">
            {digestCategories.map((category) => (
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
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Blogs & Websites — live, scrollable previews of real pages, visually
// distinct from the AI-summarized article lists above/below: a horizontal
// strip of site cards rather than another vertical digest section.
// ---------------------------------------------------------------------------

function BlogsSection({
  categories,
  loadingByCategory,
  onRefresh,
  onNavigate,
}: {
  categories: NewsCategory[];
  loadingByCategory: Record<string, boolean>;
  onRefresh: (id: string) => void;
  onNavigate: (s: ScreenId) => void;
}) {
  if (categories.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-2 text-sm text-muted">
            <Globe size={16} className="shrink-0" />
            Add a blog or website in Settings for a live, scrollable preview right here.
          </div>
          <Button size="sm" variant="outline" onClick={() => onNavigate('settings')}>
            Add one
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-muted">Blogs & Websites</h2>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {categories.map((category) => (
          <BlogCard key={category.id} category={category} loading={!!loadingByCategory[category.id]} onRefresh={() => onRefresh(category.id)} />
        ))}
      </div>
    </div>
  );
}

function BlogCard({ category, loading, onRefresh }: { category: NewsCategory; loading: boolean; onRefresh: () => void }) {
  let domain = category.url ?? '';
  try {
    if (category.url) domain = new URL(category.url).hostname.replace(/^www\./, '');
  } catch {
    // leave domain as the raw url if it doesn't parse
  }

  return (
    <Card className="flex w-64 shrink-0 flex-col overflow-hidden">
      <div className="relative h-28 w-full overflow-hidden bg-background">
        {category.previewImage ? (
          <img src={category.previewImage} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-accentLibrary/25 to-transparent">
            {category.previewFavicon ? (
              <img src={category.previewFavicon} alt="" className="h-8 w-8" />
            ) : (
              <Globe size={24} className="text-accentLibrary" />
            )}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-center gap-1.5">
          {category.previewFavicon && <img src={category.previewFavicon} alt="" className="h-3.5 w-3.5 shrink-0" />}
          <span className="truncate text-[11px] text-muted">{domain}</span>
        </div>
        <p className="line-clamp-2 text-sm font-medium leading-snug">{category.name}</p>
        <div className="mt-auto flex items-center gap-1.5 pt-1">
          <Button
            size="sm"
            className="flex-1"
            onClick={() => category.url && getApi().system.openWebsite(category.url, category.name)}
            disabled={!category.url}
          >
            <MonitorPlay size={13} /> Open Live Preview
          </Button>
          <button
            onClick={onRefresh}
            disabled={loading}
            title="Refresh preview"
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-background hover:text-foreground"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : undefined} />
          </button>
        </div>
        {category.lastFetchedAt && (
          <span className="text-[10px] text-muted">Updated {new Date(category.lastFetchedAt).toLocaleString()}</span>
        )}
      </div>
    </Card>
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
