import { forwardRef } from 'react';
import { cn } from './cn';

/**
 * Single-line text input. Pair with <Label> from this folder.
 */
const Input = forwardRef(function Input({ className, type = 'text', ...props }, ref) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        'w-full h-9 px-3 rounded-[8px] bg-surface text-fg',
        'border border-border outline-none font-sans text-[13px]',
        'transition-[border-color,box-shadow] duration-200',
        'ease-[cubic-bezier(0.32,0.72,0,1)]',
        'placeholder:text-fg-muted/70',
        'focus:border-accent/60 focus:ring-2 focus:ring-accent/20',
        'disabled:opacity-60 disabled:cursor-not-allowed',
        className
      )}
      {...props}
    />
  );
});

const Label = forwardRef(function Label({ className, ...props }, ref) {
  return (
    <label
      ref={ref}
      className={cn(
        'block text-[10px] font-semibold uppercase tracking-[0.06em] text-fg-muted mb-1.5',
        className
      )}
      {...props}
    />
  );
});

const Select = forwardRef(function Select({ className, children, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        'w-full h-9 px-3 rounded-[8px] bg-surface text-fg',
        'border border-border outline-none font-sans text-[13px]',
        'transition-[border-color,box-shadow] duration-200',
        'ease-[cubic-bezier(0.32,0.72,0,1)]',
        'focus:border-accent/60 focus:ring-2 focus:ring-accent/20',
        'disabled:opacity-60 disabled:cursor-not-allowed',
        'cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
});

export { Input, Label, Select };
