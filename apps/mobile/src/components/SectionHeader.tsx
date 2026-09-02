import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';

export function SectionHeader({ title, subtitle, onBack }: { title: string; subtitle?: string; onBack: () => void }) {
  return (
    <div className="mb-6 flex items-center gap-2">
      <button
        onClick={onBack}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors active:bg-surface"
      >
        <ChevronLeft size={18} />
      </button>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
      </div>
    </div>
  );
}

export function ReadOnlyRow({ children }: { children: ReactNode }) {
  return <div className="rounded-xl bg-background px-3.5 py-3">{children}</div>;
}
