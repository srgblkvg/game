import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function LogoutPage() {
    const { logout } = useAuth();

    useEffect(() => {
        logout();
        // Редирект на главную
        window.location.href = '/';
    }, []);

    return <div className="text-center text-[var(--color-text-muted)] py-10">Выход...</div>;
}
