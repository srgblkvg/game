import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { login } from '../api';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';

const BASE_URL = '/api/oauth';

export default function LoginPage() {
    const { loginUser } = useAuth();
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = async () => {
        try {
            setError('');
            const result = await login(username, password);
            loginUser(result.user, result.token);
            navigate(result.user.role === 'admin' ? '/adminpanel' : '/');
        } catch (e: any) {
            setError(e.message);
        }
    };

    return (
        <div className="max-w-md mx-auto mt-8 px-4">
            <Card padding="lg">
                <h1 className="text-xl font-bold mb-4">Вход в игру</h1>
                <input
                    type="text"
                    placeholder="Логин"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="w-full p-2 mb-2 bg-[var(--color-bg-input)] border border-[var(--color-border-light)] rounded text-[var(--color-text-primary)] text-sm outline-none focus:border-[var(--color-accent-info)]"
                />
                <input
                    type="password"
                    placeholder="Пароль"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full p-2 mb-3 bg-[var(--color-bg-input)] border border-[var(--color-border-light)] rounded text-[var(--color-text-primary)] text-sm outline-none focus:border-[var(--color-accent-info)]"
                />
                <Button variant="danger" fullWidth onClick={handleLogin}>Войти</Button>
                {error && <p className="text-red-500 mt-2 text-sm">{error}</p>}

                <div className="flex items-center gap-2 my-4">
                    <div className="flex-1 h-px bg-[var(--color-border-light)]" />
                    <span className="text-xs text-[var(--color-text-muted)]">или</span>
                    <div className="flex-1 h-px bg-[var(--color-border-light)]" />
                </div>

                <div className="flex flex-col gap-2">
                    <a href={`${BASE_URL}/yandex`} className="flex items-center justify-center gap-2 w-full p-2 rounded text-sm font-medium bg-[#FC3F1D] text-white hover:bg-[#E5391A] transition-colors">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm3.67 15.33h-1.97l-1.7-5.33-1.7 5.33H8.33L6 8.67h2.1l1.33 5.5L11.2 8.67h1.6l1.77 5.5 1.33-5.5H18l-2.33 8.66z"/></svg>
                        Яндекс ID
                    </a>
                    <a href={`${BASE_URL}/vk`} className="flex items-center justify-center gap-2 w-full p-2 rounded text-sm font-medium bg-[#0077FF] text-white hover:bg-[#0066DD] transition-colors">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M22.4 5.9c-.2-.6-.8-1-1.4-1H17c-1 0-1.4.5-1.7 1.1 0 0-1.7 4.3-3.9 7-.7.7-1 .9-1.4.9-.2 0-.5-.3-.5-1V5.9c0-.9-.3-1.3-1.1-1.3H5c-.6 0-1 .4-1 .8 0 .7 1 .9 1.1 3v4.6c0 1.2-.1 1.5.7 1.5 1.3 0 3.6-4.4 3.6-4.4s.4-.6.6-.6c.2 0 .2.3.2.4v2.9c0 .8-.2 1.1.7 1.1.8 0 2.3-1.5 4.2-4.4.5-.9.9-1.4 1.2-1.4.5 0 .5.8.1 2.2-.7 2.3-3.2 7-3.2 7-.3.8.1 1.2.9 1.2H17c.6 0 1.1-.3 1.4-.9 0 0 2.8-4.9 3.6-7.7.2-.4.3-.7.4-.9V6z"/></svg>
                        VK ID
                    </a>
                </div>

                <p className="text-center text-sm text-[var(--color-text-muted)] mt-4">
                    Нет аккаунта?{' '}
                    <Link to="/register" className="text-[var(--color-accent-info)] hover:underline">
                        Зарегистрироваться
                    </Link>
                </p>
            </Card>
        </div>
    );
}
