import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';

export function SectionHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  /** Optional right-aligned slot (e.g. an "Edit" mode toggle) — kept small/optional
   * since most read-only views have nothing to put here. */
  right?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-center gap-2">
      <button
        onClick={onBack}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors active:bg-surface"
      >
        <ChevronLeft size={18} />
      </button>
      <div className="min-w-0 flex-1">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

export function ReadOnlyRow({ children }: { children: ReactNode }) {
  return <div className="rounded-xl bg-background px-3.5 py-3">{children}</div>;
}
