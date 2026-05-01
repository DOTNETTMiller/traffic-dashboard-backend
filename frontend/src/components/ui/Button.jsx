import { forwardRef } from 'react';
import { cva } from 'class-variance-authority';
import { cn } from './cn';

const buttonVariants = cva(
  // Base — Apple-grade pill, spring motion, focus ring.
  [
    'inline-flex items-center justify-center gap-1.5',
    'rounded-full font-sans font-medium tracking-tight',
    'cursor-pointer select-none whitespace-nowrap',
    'transition-[background-color,color,border-color,transform] duration-200',
    'ease-[cubic-bezier(0.32,0.72,0,1)]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
    'active:scale-[0.97]',
    'disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100'
  ].join(' '),
  {
    variants: {
      variant: {
        primary: 'bg-accent text-white hover:bg-accent-hover',
        secondary: 'bg-surface text-fg border border-border hover:bg-surface-alt',
        outline: 'bg-transparent text-fg-muted border border-border hover:bg-surface-alt hover:text-fg',
        ghost: 'bg-transparent text-fg-muted hover:bg-black/5 hover:text-fg',
        destructive: 'bg-transparent text-fg-muted border border-border hover:bg-severity-major/10 hover:text-severity-major hover:border-severity-major/40'
      },
      size: {
        sm: 'h-7 px-3 text-[12px]',
        md: 'h-8 px-4 text-[13px]',
        lg: 'h-10 px-5 text-[14px]'
      }
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md'
    }
  }
);

const Button = forwardRef(function Button(
  { className, variant, size, type = 'button', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
});

export { Button, buttonVariants };
