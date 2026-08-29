import {
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import clsx from 'clsx';

const fieldBase =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted focus:border-primary/60 focus:ring-2 focus:ring-primary/20';

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={clsx('mb-1.5 block text-xs font-medium text-muted', className)} {...props} />;
}

const PICKER_TYPES = new Set(['date', 'time', 'datetime-local', 'month', 'week']);

export function Input({ className, type, onClick, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const isPickerType = typeof type === 'string' && PICKER_TYPES.has(type);
  return (
    <input
      type={type}
      className={clsx(fieldBase, isPickerType && 'cursor-pointer', className)}
      onClick={(e) => {
        onClick?.(e);
        // Native date/time inputs only open their calendar/clock picker when you
        // hit the tiny indicator icon exactly — easy to miss, and otherwise the
        // field just looks like plain text you have to type into. showPicker()
        // opens it on a click anywhere in the field instead, same as clicking
        // the icon. Guarded: not every input type supports it, and it can throw
        // if called outside a direct user gesture.
        if (isPickerType && 'showPicker' in e.currentTarget) {
          try {
            (e.currentTarget as HTMLInputElement & { showPicker: () => void }).showPicker();
          } catch {
            // ignore — typing still works as a fallback
          }
        }
      }}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={clsx(fieldBase, 'resize-none', className)} rows={3} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={clsx(fieldBase, 'appearance-none', className)} {...props}>
      {children}
    </select>
  );
}

export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
