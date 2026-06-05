import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface User {
    id: number;
    username: string;
    level: number;
    role: 'player' | 'admin';
    gender?: string;
    isGuest?: boolean;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    loginUser: (u: User, t: string) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

function getTokenFromURL(): string | null {
    const params = new URLSearchParams(window.location.search);
    const jwt = params.get('jwt');
    if (jwt) {
        const url = new URL(window.location.href);
        url.searchParams.delete('jwt');
        window.history.replaceState({}, '', url.toString());
    }
    return jwt;
}

function parseUserFromToken(token: string): User | null {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return {
            id: payload.adminId || payload.userId,
            username: '',
            level: payload.role === 'admin' ? 0 : 1,
            role: payload.role,
            gender: payload.gender || 'male',
            isGuest: payload.isGuest || false,
        };
    } catch {
        return null;
    }
}

export function AuthProvider({ children }: { children: ReactNode }) {
    // Синхронно при первом рендере: проверяем JWT из URL, затем из localStorage
    const [token, setToken] = useState<string | null>(() => {
        const urlJwt = getTokenFromURL();
        if (urlJwt) {
            localStorage.setItem('token', urlJwt);
            return urlJwt;
        }
        return localStorage.getItem('token');
    });

    const [user, setUser] = useState<User | null>(() => {
        const t = token;
        if (t) return parseUserFromToken(t);
        return null;
    });

    // Синхронизируем user при изменении token
    useEffect(() => {
        if (!token) {
            setUser(null);
            return;
        }
        const u = parseUserFromToken(token);
        if (u) setUser(u);
    }, [token]);

    const loginUser = (u: User, t: string) => {
        localStorage.setItem('token', t);
        setToken(t);
        setUser(u);
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('openPrivateTabs');
        setToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, token, loginUser, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
