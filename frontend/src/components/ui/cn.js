import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Standard shadcn helper — merge class names with Tailwind class de-dup.
 *
 *   cn('px-2', condition && 'bg-accent', extraClassName)
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
