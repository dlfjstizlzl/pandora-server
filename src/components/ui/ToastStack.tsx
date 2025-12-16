import { useEffect } from 'react';
import { useToastStore } from '../../store/useToast';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function ToastStack() {
  const { toasts, removeToast } = useToastStore();
  const navigate = useNavigate();

  useEffect(() => {
    toasts.forEach((toast) => {
      if (!toast.timeout) return;
      const timer = window.setTimeout(() => removeToast(toast.id), toast.timeout);
      return () => window.clearTimeout(timer);
    });
  }, [toasts, removeToast]);

  if (!toasts.length) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-3 w-[280px]">
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => {
            if (t.href) navigate(t.href);
          }}
          className={`border border-white/15 bg-pandora-surface/90 backdrop-blur-md rounded-2xl shadow-lg p-3 text-pandora-text animate-slideDown ${
            t.href ? 'cursor-pointer hover:border-white/30' : ''
          }`}
        >
          <div className="flex items-start gap-2">
            <div className="flex-1">
              {t.title && <div className="text-sm font-semibold">{t.title}</div>}
              {t.description && <div className="text-xs text-pandora-muted mt-1">{t.description}</div>}
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="text-pandora-muted hover:text-pandora-text"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// Tailwind keyframes extension (if not already present) should include:
// @keyframes slideDown {
//   from { transform: translateY(-12px); opacity: 0; }
//   to { transform: translateY(0); opacity: 1; }
// }
