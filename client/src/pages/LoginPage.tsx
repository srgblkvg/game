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
                    placeholder="Email или логин"
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
                    <a href={`${BASE_URL}/yandex`} className="flex items-center justify-center w-full p-2 rounded text-sm font-medium bg-[#FC3F1D] text-white hover:bg-[#E5391A] transition-colors">
                        Яндекс ID
                    </a>
                    <a href={`${BASE_URL}/vk`} className="flex items-center justify-center w-full p-2 rounded text-sm font-medium bg-[#0077FF] text-white hover:bg-[#0066DD] transition-colors">
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
