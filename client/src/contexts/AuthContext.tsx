import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface User {
    id: number;
    username: string;
    level: number;
    role: 'player' | 'admin';
    gender?: string;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    loginUser: (u: User, t: string) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));

    // Проверка JWT из URL (OAuth редирект)
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const jwt = params.get('jwt');
        if (jwt) {
            localStorage.setItem('token', jwt);
            setToken(jwt);
            // Убираем jwt из URL
            const url = new URL(window.location.href);
            url.searchParams.delete('jwt');
            window.history.replaceState({}, '', url.toString());
        }
    }, []);

    useEffect(() => {
        if (!token) return;
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            setUser({
                id: payload.adminId || payload.userId,
                username: '',
                level: payload.role === 'admin' ? 0 : 1,
                role: payload.role,
                gender: payload.gender || 'male',
            });
        } catch { }
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
