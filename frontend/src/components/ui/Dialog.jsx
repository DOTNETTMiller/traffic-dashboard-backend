import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from './cn';

/**
 * Modal dialog with portal rendering, backdrop, ESC + click-outside to close,
 * body scroll lock. Spring-curve enter/exit. Uses the existing keyframes from
 * App.css (cc-sheet-backdrop-in/out) repurposed; we add new ones for centered
 * dialogs in this file's <style> block.
 *
 * Composed: <Dialog open onOpenChange><DialogContent>...</DialogContent></Dialog>
 */
export function Dialog({ open, onOpenChange, children }) {
  const [closing, setClosing] = useState(false);

  const requestClose = () => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onOpenChange?.(false);
    }, 200);
  };

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') requestClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      role="presentation"
      style={{ position: 'fixed', inset: 0, zIndex: 30000 }}
    >
      <div
        onClick={requestClose}
        className={cn(
          'absolute inset-0 bg-black/32 backdrop-blur-[2px]',
          'animate-[cc-sheet-backdrop-in_220ms_cubic-bezier(0.22,1,0.36,1)_both]',
          closing && 'animate-[cc-sheet-backdrop-out_180ms_cubic-bezier(0.22,1,0.36,1)_both]'
        )}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none"
      >
        <div
          className={cn(
            'pointer-events-auto bg-surface rounded-[14px] border border-border',
            'shadow-[0_1px_2px_rgba(0,0,0,0.04),0_24px_48px_rgba(0,0,0,0.16)]',
            'w-full max-w-[480px] flex flex-col',
            'animate-[cc-dialog-in_240ms_cubic-bezier(0.32,0.72,0,1)_both]',
            closing && 'animate-[cc-dialog-out_180ms_cubic-bezier(0.32,0.72,0,1)_both]'
          )}
        >
          {typeof children === 'function' ? children({ requestClose }) : children}
        </div>
      </div>
      <style>{`
        @keyframes cc-dialog-in {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes cc-dialog-out {
          from { opacity: 1; transform: scale(1) translateY(0); }
          to   { opacity: 0; transform: scale(0.97) translateY(4px); }
        }
      `}</style>
    </div>,
    document.body
  );
}

export function DialogHeader({ className, ...props }) {
  return (
    <div
      className={cn(
        'flex items-start justify-between px-5 pt-5 pb-3 gap-4',
        className
      )}
      {...props}
    />
  );
}

export function DialogTitle({ className, ...props }) {
  return (
    <h2
      className={cn(
        'm-0 text-[17px] font-semibold tracking-tight text-fg',
        className
      )}
      {...props}
    />
  );
}

export function DialogDescription({ className, ...props }) {
  return (
    <p
      className={cn('m-0 mt-1 text-[12px] text-fg-muted', className)}
      {...props}
    />
  );
}

export function DialogBody({ className, ...props }) {
  return (
    <div
      className={cn('px-5 py-2 overflow-y-auto', className)}
      {...props}
    />
  );
}

export function DialogFooter({ className, ...props }) {
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-2 px-5 py-4 border-t border-border',
        className
      )}
      {...props}
    />
  );
}
