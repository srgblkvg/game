import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { getItemImage, getRarityColor } from '../utils/itemUtils';

export interface AcquireToast {
    id: number;
    item: any;
    quantity: number;
    action: string;
}

interface AcquireContextType {
    toasts: AcquireToast[];
    showAcquire: (item: any, quantity: number, action: string) => void;
}

const AcquireContext = createContext<AcquireContextType>({ toasts: [], showAcquire: () => {} });

let nextId = 1;

export function AcquireProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<AcquireToast[]>([]);

    const showAcquire = useCallback((item: any, quantity: number, action: string) => {
        const id = nextId++;
        setToasts(prev => [...prev, { id, item, quantity, action }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    }, []);

    return (
        <AcquireContext.Provider value={{ toasts, showAcquire }}>
            {children}
            {/* Всплывающие уведомления */}
            <div style={{
                position: 'fixed', bottom: '80px', right: '16px', zIndex: 9999,
                display: 'flex', flexDirection: 'column', gap: '8px', pointerEvents: 'none',
            }}>
                {toasts.map(t => {
                    const color = getRarityColor(t.item);
                    const img = getItemImage(t.item);
                    return (
                        <div key={t.id} style={{
                            background: 'var(--color-bg-card)', border: `2px solid ${color}`,
                            borderRadius: '10px', padding: '10px 14px',
                            display: 'flex', alignItems: 'center', gap: '10px',
                            minWidth: '220px', boxShadow: 'var(--shadow-card)',
                            animation: 'acquireToastIn 0.3s ease',
                        }}>
                            {img && (
                                <img src={img} alt="" style={{
                                    width: 40, height: 40, borderRadius: '6px',
                                    border: `1px solid ${color}`, background: 'var(--color-bg-input)',
                                }} />
                            )}
                            <div>
                                <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color }}>
                                    {t.item.name}
                                    {t.quantity > 1 && <span style={{ color: 'var(--color-text-muted)', marginLeft: '6px' }}>x{t.quantity}</span>}
                                </div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{t.action}</div>
                            </div>
                        </div>
                    );
                })}
            </div>
            <style>{`
                @keyframes acquireToastIn {
                    from { opacity: 0; transform: translateX(40px); }
                    to { opacity: 1; transform: translateX(0); }
                }
            `}</style>
        </AcquireContext.Provider>
    );
}

export function useAcquire() {
    return useContext(AcquireContext);
}
