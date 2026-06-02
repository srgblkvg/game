import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { register, verifyEmail } from '../api';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';

export default function RegisterPage() {
    const { loginUser } = useAuth();
    const navigate = useNavigate();

    // Шаг 1: ввод данных
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Шаг 2: подтверждение кода
    const [step, setStep] = useState<'form' | 'code'>('form');
    const [code, setCode] = useState('');

    const handleRegister = async () => {
        try {
            setError('');
            setLoading(true);
            await register(username, email, password);
            setStep('code');
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async () => {
        try {
            setError('');
            setLoading(true);
            const result = await verifyEmail(email, code);
            loginUser(result.user, result.token);
            navigate('/');
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    if (step === 'code') {
        return (
            <div className="max-w-md mx-auto mt-8 px-4">
                <Card padding="lg">
                    <h1 className="text-xl font-bold mb-2">Подтверждение почты</h1>
                    <p className="text-sm text-[var(--color-text-muted)] mb-4">
                        Код отправлен на <span className="text-[var(--color-text-primary)]">{email}</span>
                    </p>
                    <input
                        type="text"
                        placeholder="123456"
                        maxLength={6}
                        value={code}
                        onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                        className="w-full p-2 mb-3 bg-[var(--color-bg-input)] border border-[var(--color-border-light)] rounded text-[var(--color-text-primary)] text-center text-2xl tracking-[0.5em] outline-none focus:border-[var(--color-accent-info)]"
                        autoFocus
                    />
                    <Button variant="danger" fullWidth onClick={handleVerify} disabled={code.length !== 6 || loading}>
                        {loading ? '...' : 'Подтвердить'}
                    </Button>
                    {error && <p className="text-red-500 mt-2 text-sm">{error}</p>}
                    <p className="text-center text-sm text-[var(--color-text-muted)] mt-4">
                        <button onClick={() => setStep('form')} className="text-[var(--color-accent-info)] hover:underline">
                            ← Назад
                        </button>
                    </p>
                </Card>
            </div>
        );
    }

    return (
        <div className="max-w-md mx-auto mt-8 px-4">
            <Card padding="lg">
                <h1 className="text-xl font-bold mb-4">Регистрация</h1>
                <input
                    type="text"
                    placeholder="Логин"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="w-full p-2 mb-2 bg-[var(--color-bg-input)] border border-[var(--color-border-light)] rounded text-[var(--color-text-primary)] text-sm outline-none focus:border-[var(--color-accent-info)]"
                />
                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full p-2 mb-2 bg-[var(--color-bg-input)] border border-[var(--color-border-light)] rounded text-[var(--color-text-primary)] text-sm outline-none focus:border-[var(--color-accent-info)]"
                />
                <input
                    type="password"
                    placeholder="Пароль"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full p-2 mb-1 bg-[var(--color-bg-input)] border border-[var(--color-border-light)] rounded text-[var(--color-text-primary)] text-sm outline-none focus:border-[var(--color-accent-info)]"
                />
                <p className="text-xs text-[var(--color-text-muted)] mb-3">Минимум 8 символов, цифра и спецсимвол</p>
                <Button variant="danger" fullWidth onClick={handleRegister} disabled={!username || !email || !password || loading}>
                    {loading ? '...' : 'Зарегистрироваться'}
                </Button>
                {error && <p className="text-red-500 mt-2 text-sm">{error}</p>}

                <div className="flex items-center gap-2 my-4">
                    <div className="flex-1 h-px bg-[var(--color-border-light)]" />
                    <span className="text-xs text-[var(--color-text-muted)]">или</span>
                    <div className="flex-1 h-px bg-[var(--color-border-light)]" />
                </div>

                <div className="flex gap-2">
                    <a href="/api/oauth/yandex" className="flex-1">
                        <Button variant="secondary" fullWidth>Яндекс ID</Button>
                    </a>
                    <a href="/api/oauth/vk" className="flex-1">
                        <Button variant="secondary" fullWidth>VK ID</Button>
                    </a>
                </div>

                <p className="text-center text-sm text-[var(--color-text-muted)] mt-4">
                    Уже есть аккаунт?{' '}
                    <Link to="/login" className="text-[var(--color-accent-info)] hover:underline">
                        Войти
                    </Link>
                </p>
            </Card>
        </div>
    );
}
