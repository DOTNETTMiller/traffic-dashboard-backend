import { useEffect, useState, createContext, useContext, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from './cn';

/**
 * Tiny toast system. Wrap app in <ToastProvider> at the root, then call
 * useToast() to get { toast } and emit messages from anywhere.
 *
 *   const { toast } = useToast();
 *   toast({ title: 'Saved', variant: 'success' });
 *   toast({ title: 'Failed', description: '…', variant: 'error' });
 */

const ToastContext = createContext(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Don't crash if a toast is fired before the provider mounts; just no-op.
    return { toast: () => {} };
  }
  return ctx;
}

export function ToastProvider({ children, duration = 4500 }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const remove = useCallback((id) => {
    setToasts(t => t.filter(toast => toast.id !== id));
  }, []);

  const toast = useCallback(({ title, description, variant = 'default' }) => {
    const id = ++idRef.current;
    setToasts(t => [...t, { id, title, description, variant }]);
    setTimeout(() => remove(id), duration);
    return id;
  }, [duration, remove]);

  return (
    <ToastContext.Provider value={{ toast, dismiss: remove }}>
      {children}
      {createPortal(
        <div
          aria-live="polite"
          style={{
            position: 'fixed',
            top: 16,
            right: 16,
            zIndex: 40000,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            pointerEvents: 'none'
          }}
        >
          {toasts.map(t => (
            <ToastItem key={t.id} {...t} onDismiss={() => remove(t.id)} />
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

const variantClasses = {
  default: 'border-border',
  success: 'border-[rgba(38,153,76,0.32)]',
  error: 'border-[rgba(216,58,58,0.34)]',
  warning: 'border-[rgba(201,122,22,0.32)]'
};

const variantDot = {
  default: 'bg-fg-muted',
  success: 'bg-[#26994c]',
  error: 'bg-severity-major',
  warning: 'bg-severity-moderate'
};

function ToastItem({ title, description, variant, onDismiss }) {
  return (
    <div
      role="status"
      onClick={onDismiss}
      className={cn(
        'pointer-events-auto cursor-pointer min-w-[260px] max-w-[380px]',
        'bg-surface border rounded-[12px] py-3 px-4',
        'shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_28px_rgba(0,0,0,0.10)]',
        'flex items-start gap-3',
        'animate-[cc-toast-in_220ms_cubic-bezier(0.32,0.72,0,1)_both]',
        variantClasses[variant] || variantClasses.default
      )}
    >
      <span
        aria-hidden
        className={cn('mt-1.5 w-1.5 h-1.5 rounded-full shrink-0', variantDot[variant] || variantDot.default)}
      />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold tracking-tight text-fg">{title}</div>
        {description && (
          <div className="text-[12px] text-fg-muted mt-0.5">{description}</div>
        )}
      </div>
      <style>{`
        @keyframes cc-toast-in {
          from { opacity: 0; transform: translateY(-6px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
