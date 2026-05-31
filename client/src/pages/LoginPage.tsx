import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { login, register } from '../api';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';

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

    const handleRegister = async () => {
        try {
            setError('');
            const result = await register(username, password);
            loginUser(result.user, result.token);
            navigate('/');
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
                <div className="flex gap-2">
                    <Button variant="danger" fullWidth onClick={handleLogin}>Войти</Button>
                    <Button variant="secondary" fullWidth onClick={handleRegister}>Регистрация</Button>
                </div>
                {error && <p className="text-red-500 mt-2 text-sm">{error}</p>}
            </Card>
        </div>
    );
}
