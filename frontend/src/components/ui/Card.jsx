import { forwardRef } from 'react';
import { cn } from './cn';

/**
 * Card — surface with hairline border. Composed: Card / CardHeader /
 * CardTitle / CardDescription / CardContent / CardFooter.
 */
const Card = forwardRef(function Card({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        'bg-surface text-fg rounded-[14px] border border-border',
        'shadow-[0_1px_2px_rgba(0,0,0,0.02)]',
        className
      )}
      {...props}
    />
  );
});

const CardHeader = forwardRef(function CardHeader({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn('px-5 pt-5 pb-3 flex flex-col gap-1', className)}
      {...props}
    />
  );
});

const CardTitle = forwardRef(function CardTitle({ className, ...props }, ref) {
  return (
    <h3
      ref={ref}
      className={cn(
        'm-0 text-[15px] font-semibold tracking-tight text-fg',
        className
      )}
      {...props}
    />
  );
});

const CardDescription = forwardRef(function CardDescription({ className, ...props }, ref) {
  return (
    <p
      ref={ref}
      className={cn('m-0 text-[12px] text-fg-muted', className)}
      {...props}
    />
  );
});

const CardContent = forwardRef(function CardContent({ className, ...props }, ref) {
  return (
    <div ref={ref} className={cn('px-5 pb-5', className)} {...props} />
  );
});

const CardFooter = forwardRef(function CardFooter({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        'px-5 py-4 border-t border-border flex items-center justify-end gap-2',
        className
      )}
      {...props}
    />
  );
});

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
