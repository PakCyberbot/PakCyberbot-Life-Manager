import { useEffect } from 'react';
import { getApi, useNewsStore } from '@life-manager/core';
import { formatDate } from '@life-manager/shared';
import { Card, CardHeader, CardTitle, Badge, EmptyState } from '@life-manager/ui';
import { ExternalLink, Newspaper, RefreshCw } from 'lucide-react';
import { SectionHeader } from '../../components/SectionHeader';
import clsx from 'clsx';
import type { MobileScreenId } from '../../navigation';

export function NewsView({ onNavigate }: { onNavigate: (s: MobileScreenId) => void }) {
  const { categories, itemsByCategory, loadingByCategory, errorByCategory, fetchCategories, fetchCachedItems, refreshCategory, loaded } =
    useNewsStore();

  useEffect(() => {
    if (!loaded) fetchCategories();
  }, [loaded, fetchCategories]);

  useEffect(() => {
    for (const c of categories) fetchCachedItems(c.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories.length]);

  const digestCategories = categories.filter((c) => c.type !== 'blog');
  const blogCategories = categories.filter((c) => c.type === 'blog');

  return (
    <div>
      <SectionHeader
        title="News & Updates"
        subtitle="Tap refresh to fetch new — new categories are added from desktop"
        onBack={() => onNavigate('more')}
      />
      {categories.length === 0 ? (
        <EmptyState icon={<Newspaper size={24} />} title="Nothing yet" description="Set up categories on desktop and sync." />
      ) : (
        <div className="space-y-6">
          {blogCategories.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-muted">Blogs & Websites</h2>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {blogCategories.map((c) => (
                  <div key={c.id} className="w-40 shrink-0 overflow-hidden rounded-xl border border-border bg-surface text-left">
                    <button
                      onClick={() => c.url && getApi().system.openWebsite(c.url, c.name)}
                      className="block h-20 w-full bg-background"
                    >
                      {c.previewImage && <img src={c.previewImage} alt="" className="h-full w-full object-cover" />}
                    </button>
                    <div className="flex items-center justify-between gap-1 p-2">
                      <p className="truncate text-xs font-medium">{c.name}</p>
                      <button
                        onClick={() => refreshCategory(c.id)}
                        disabled={!!loadingByCategory[c.id]}
                        className="shrink-0 text-muted active:text-accentLibrary"
                      >
                        <RefreshCw size={12} className={clsx(loadingByCategory[c.id] && 'animate-spin')} />
                      </button>
                    </div>
                    {errorByCategory[c.id] && <p className="px-2 pb-2 text-[10px] text-red-500">{errorByCategory[c.id]}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {digestCategories.map((c) => (
            <div key={c.id}>
              <div className="mb-2 flex items-center gap-2">
                <h2 className="flex-1 text-sm font-semibold text-muted">{c.name}</h2>
                <Badge tone="library" className="capitalize">
                  {c.type.replace('-', ' ')}
                </Badge>
                <button
                  onClick={() => refreshCategory(c.id)}
                  disabled={!!loadingByCategory[c.id]}
                  className="shrink-0 rounded-md p-1 text-muted active:bg-surface active:text-accentLibrary"
                >
                  <RefreshCw size={14} className={clsx(loadingByCategory[c.id] && 'animate-spin')} />
                </button>
              </div>
              {errorByCategory[c.id] && <p className="mb-2 text-xs text-red-500">{errorByCategory[c.id]}</p>}
              {(itemsByCategory[c.id] ?? []).length === 0 ? (
                <p className="text-xs text-muted">{loadingByCategory[c.id] ? 'Fetching…' : 'Nothing cached yet — tap refresh.'}</p>
              ) : (
                <div className="space-y-2">
                  {(itemsByCategory[c.id] ?? []).map((item) => (
                    <Card key={item.id}>
                      <CardHeader className="items-start p-3.5 pb-2">
                        <CardTitle className="pr-2 text-sm leading-snug">{item.title}</CardTitle>
                        <button onClick={() => getApi().system.openExternal(item.url)} className="shrink-0 text-muted">
                          <ExternalLink size={14} />
                        </button>
                      </CardHeader>
                      {item.summary && <p className="px-3.5 pb-3 text-xs text-muted">{item.summary}</p>}
                      <p className="px-3.5 pb-3 text-[11px] text-muted">
                        {item.source ?? 'Unknown source'}
                        {item.publishedAt && ` · ${formatDate(item.publishedAt)}`}
                      </p>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
