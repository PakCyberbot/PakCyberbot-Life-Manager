import { useEffect, useState } from 'react';
import { Globe, Newspaper, Plus, Trash2 } from 'lucide-react';
import { useNewsStore } from '@life-manager/core';
import type { NewsCategory } from '@life-manager/shared';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input, Textarea } from '../ui/FormControls';

/** News & Updates category management, extracted out of an ever-growing inline Settings card into
 * a popup — the category list plus both "add" mini-forms kept growing the Settings page's own
 * scroll every time a custom category or blog/website was added, so this content now scrolls
 * *inside* the dialog instead. Exactly the same components/store calls as before, just relocated;
 * opened from both Settings' summary card and News & Updates' own "Manage categories" button (and
 * its "needs a location"/"add a blog" empty-state prompts), so the fix reads consistently from
 * every entry point rather than only one of them. */
export function NewsCategoriesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { categories, fetchCategories, addCustomCategory, addBlogCategory, updateCategory, removeCategory, loaded } = useNewsStore();
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [blogUrl, setBlogUrl] = useState('');
  const [blogLabel, setBlogLabel] = useState('');
  const [addingBlog, setAddingBlog] = useState(false);

  useEffect(() => {
    if (open && !loaded) fetchCategories();
  }, [open, loaded, fetchCategories]);

  const submit = async () => {
    if (!name.trim() || !prompt.trim()) return;
    await addCustomCategory(name.trim(), prompt.trim());
    setName('');
    setPrompt('');
  };

  const submitBlog = async () => {
    if (!blogUrl.trim()) return;
    setAddingBlog(true);
    await addBlogCategory(blogUrl.trim(), blogLabel.trim());
    setAddingBlog(false);
    setBlogUrl('');
    setBlogLabel('');
  };

  return (
    <Dialog open={open} onClose={onClose} title="News & Updates categories" className="max-w-xl">
      <div className="space-y-4">
        <p className="flex items-start gap-2 text-sm text-muted">
          <Newspaper size={16} className="mt-0.5 shrink-0" />
          Each category becomes a section on the News & Updates page. Custom categories are fully yours (name +
          what the AI should judge as relevant); Country/City just need a location; Blogs & Websites show a live,
          scrollable preview of a real page instead of an AI-summarized digest.
        </p>

        <div className="space-y-2">
          {categories.map((c) => (
            <CategoryRow key={c.id} category={c} onUpdate={updateCategory} onRemove={removeCategory} />
          ))}
        </div>

        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-xs font-medium text-muted">Add a custom category</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, e.g. AI Research" />
            <Input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="What should count as relevant?" />
          </div>
          <Button size="sm" onClick={submit} disabled={!name.trim() || !prompt.trim()}>
            <Plus size={14} /> Add category
          </Button>
        </div>

        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-xs font-medium text-muted">Add a blog or website</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Input value={blogUrl} onChange={(e) => setBlogUrl(e.target.value)} placeholder="https://..." />
            <Input value={blogLabel} onChange={(e) => setBlogLabel(e.target.value)} placeholder="Label (optional)" />
          </div>
          <Button size="sm" onClick={submitBlog} disabled={!blogUrl.trim() || addingBlog}>
            <Globe size={14} /> {addingBlog ? 'Fetching preview…' : 'Add blog/website'}
          </Button>
        </div>

        <div className="flex justify-end border-t border-border pt-3">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function CategoryRow({
  category,
  onUpdate,
  onRemove,
}: {
  category: NewsCategory;
  onUpdate: (id: string, patch: Partial<NewsCategory>) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const [name, setName] = useState(category.name);
  const [prompt, setPrompt] = useState(category.prompt ?? '');
  const [location, setLocation] = useState(category.locationValue ?? '');
  const [blogUrl, setBlogUrl] = useState(category.url ?? '');

  return (
    <div className="space-y-2 rounded-lg bg-background p-3">
      <div className="flex items-center justify-between">
        <Badge tone="library" className="capitalize">
          {category.type.replace('-', ' ')}
        </Badge>
        {(category.type === 'custom' || category.type === 'blog') && (
          <button onClick={() => onRemove(category.id)} className="text-muted hover:text-red-500">
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {category.type === 'custom' ? (
        <>
          <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => onUpdate(category.id, { name })} />
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onBlur={() => onUpdate(category.id, { prompt })}
            placeholder="What should count as relevant?"
          />
        </>
      ) : category.type === 'country' || category.type === 'city' ? (
        <Input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          onBlur={() => onUpdate(category.id, { locationValue: location })}
          placeholder={category.type === 'country' ? 'e.g. Pakistan' : 'e.g. Karachi'}
        />
      ) : category.type === 'blog' ? (
        <>
          <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => onUpdate(category.id, { name })} placeholder="Label" />
          <Input
            value={blogUrl}
            onChange={(e) => setBlogUrl(e.target.value)}
            onBlur={() => onUpdate(category.id, { url: blogUrl })}
            placeholder="https://..."
          />
        </>
      ) : (
        <p className="text-sm font-medium">{category.name}</p>
      )}
    </div>
  );
}
