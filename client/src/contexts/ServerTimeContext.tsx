import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface ServerTimeContextType {
    now: number; // Unix timestamp (server time)
}

const ServerTimeContext = createContext<ServerTimeContextType>({ now: Math.floor(Date.now() / 1000) });

export function ServerTimeProvider({ children }: { children: ReactNode }) {
    const [offset, setOffset] = useState<number>(0);
    const [tick, setTick] = useState(0);

    useEffect(() => {
        fetch('/api/time')
            .then(r => r.json())
            .then(d => setOffset(d.now - Math.floor(Date.now() / 1000)))
            .catch(() => setOffset(0));
    }, []);

    useEffect(() => {
        const t = setInterval(() => setTick(n => n + 1), 1000);
        return () => clearInterval(t);
    }, []);

    const now = Math.floor(Date.now() / 1000) + offset;

    return (
        <ServerTimeContext.Provider value={{ now }}>
            {children}
        </ServerTimeContext.Provider>
    );
}

export function useServerTime() {
    return useContext(ServerTimeContext);
}
