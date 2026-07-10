import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@iconify/react';

type ToastType = 'error' | 'success' | 'info' | 'warning';

interface Toast {
    id: number;
    message: string;
    type: ToastType;
    fading: boolean;
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType>({ showToast: () => {} });

const typeStyles: Record<ToastType, { bg: string; border: string; icon: string; color: string }> = {
    error:   { bg: 'bg-red-950/80',        border: 'border-red-700',     icon: 'game-icons:cancel',       color: '#ef4444' },
    success: { bg: 'bg-green-950/80',       border: 'border-green-700',   icon: 'game-icons:check-mark',   color: '#22c55e' },
    info:    { bg: 'bg-blue-950/80',        border: 'border-blue-700',    icon: 'game-icons:info',         color: '#3b82f6' },
    warning: { bg: 'bg-yellow-950/80',      border: 'border-yellow-700',  icon: 'game-icons:bright-explosion', color: '#eab308' },
};

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((message: string, type: ToastType = 'error') => {
        const id = nextId++;
        setToasts(prev => {
            const next = [...prev, { id, message, type, fading: false }];
            return next.length > 5 ? next.slice(-5) : next;
        });
        // Автоудаление через 4 сек
        setTimeout(() => {
            setToasts(prev => prev.map(t => t.id === id ? { ...t, fading: true } : t));
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== id));
            }, 300);
        }, 4000);
    }, []);

    const dismiss = useCallback((id: number) => {
        setToasts(prev => prev.map(t => t.id === id ? { ...t, fading: true } : t));
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 300);
    }, []);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            {toasts.length > 0 && createPortal(
                <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-2 max-w-[380px] w-[calc(100%-2rem)] pointer-events-none">
                    {toasts.map(t => {
                        const s = typeStyles[t.type] || typeStyles.error;
                        return (
                            <div
                                key={t.id}
                                className={`pointer-events-auto ${s.bg} border ${s.border} rounded-lg px-3 py-2.5 shadow-lg flex items-start gap-2 transition-all duration-300 ${
                                    t.fading ? 'opacity-0 -translate-y-2' : 'opacity-100 translate-y-0'
                                }`}
                                onClick={() => dismiss(t.id)}
                            >
                                <Icon icon={s.icon} width="18" height="18" className="mt-0.5 shrink-0" style={{ color: s.color }} />
                                <p className="text-xs text-white leading-snug flex-1 min-w-0">{t.message}</p>
                                <button
                                    className="shrink-0 text-white/50 hover:text-white leading-none mt-0.5"
                                    onClick={e => { e.stopPropagation(); dismiss(t.id); }}
                                >
                                    <Icon icon="game-icons:cross-mark" width="14" height="14" />
                                </button>
                            </div>
                        );
                    })}
                </div>,
                document.body
            )}
        </ToastContext.Provider>
    );
}

export function useToast(): ToastContextType {
    return useContext(ToastContext);
}
