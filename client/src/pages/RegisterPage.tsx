import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { register, verifyEmail, resendCode } from '../api';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';

export default function RegisterPage() {
    const { loginUser } = useAuth();
    const navigate = useNavigate();

    // Шаг 1: ввод данных
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Шаг 2: подтверждение кода
    const [step, setStep] = useState<'form' | 'code'>('form');
    const [code, setCode] = useState('');
    const [resendMsg, setResendMsg] = useState('');

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

    const handleResend = async () => {
        try {
            setResendMsg('');
            setLoading(true);
            await resendCode(email);
            setResendMsg('Код отправлен повторно');
        } catch (e: any) {
            setResendMsg(e.message);
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

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && username && email && password) handleRegister();
    };

    if (step === 'code') {
        return (
            <div className="max-w-md mx-auto mt-8 px-4">
                <Card padding="lg">
                    <h1 className="text-xl font-bold mb-2">Подтверждение почты</h1>
                    <p className="text-sm text-[var(--color-text-muted)] mb-2">
                        Код отправлен на <span className="text-[var(--color-text-primary)]">{email}</span>
                    </p>
                    <p className="text-xs text-white bg-[var(--color-accent-warning)]/10 border border-[var(--color-accent-warning)]/20 rounded p-2 mb-3">
                        ⚠ Письмо может попасть в спам. Если не пришло — проверьте папку «Спам».
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
                    {error && <p className="text-[var(--color-accent-danger)] mt-2 text-sm">{error}</p>}
                    {resendMsg && <p className={`text-sm mt-2 ${resendMsg.includes('отправлен') ? 'text-[var(--color-accent-success)]' : 'text-[var(--color-accent-danger)]'}`}>{resendMsg}</p>}
                    <div className="flex gap-2 mt-3">
                        <button onClick={handleResend} disabled={loading} className="flex-1 text-sm text-[var(--color-accent-info)] hover:underline">
                            Отправить код повторно
                        </button>
                        <button onClick={() => setStep('form')} className="flex-1 text-sm text-[var(--color-text-muted)] hover:underline">
                            ← Назад
                        </button>
                    </div>
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
                    onKeyDown={handleKeyDown}
                    className="w-full p-2 mb-2 bg-[var(--color-bg-input)] border border-[var(--color-border-light)] rounded text-[var(--color-text-primary)] text-sm outline-none focus:border-[var(--color-accent-info)]"
                />
                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="w-full p-2 mb-2 bg-[var(--color-bg-input)] border border-[var(--color-border-light)] rounded text-[var(--color-text-primary)] text-sm outline-none focus:border-[var(--color-accent-info)]"
                />
                <div className="relative mb-1">
                    <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Пароль"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="w-full p-2 pr-10 bg-[var(--color-bg-input)] border border-[var(--color-border-light)] rounded text-[var(--color-text-primary)] text-sm outline-none focus:border-[var(--color-accent-info)]"
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                    >
                        {showPassword ? '🙈' : '👁'}
                    </button>
                </div>
                <p className="text-xs text-[var(--color-text-muted)] mb-3">Минимум 8 символов, цифра и спецсимвол</p>
                <Button variant="danger" fullWidth onClick={handleRegister} disabled={!username || !email || !password || loading}>
                    {loading ? '...' : 'Зарегистрироваться'}
                </Button>
                {error && <p className="text-[var(--color-accent-danger)] mt-2 text-sm">{error}</p>}

                <p className="text-center text-sm text-[var(--color-text-muted)] mt-4">
                    Уже есть аккаунт?{' '}
                    <Link to="/login" className="text-[var(--color-accent-info)] hover:underline">
                        Войти
                    </Link>
                </p>

                <div className="flex items-center gap-2 my-4">
                    <div className="flex-1 h-px bg-[var(--color-border-light)]" />
                    <span className="text-xs text-[var(--color-text-muted)]">или</span>
                    <div className="flex-1 h-px bg-[var(--color-border-light)]" />
                </div>

                <div className="flex flex-col gap-2">
                    <a href="/api/oauth/yandex" className="flex items-center justify-center w-full p-2 rounded text-sm font-medium bg-[#FC3F1D] text-white hover:bg-[#E5391A] transition-colors">
                        Яндекс ID
                    </a>
                    <a href="/api/oauth/vk" className="flex items-center justify-center w-full p-2 rounded text-sm font-medium bg-[#0077FF] text-white hover:bg-[#0066DD] transition-colors">
                        VK ID
                    </a>
                </div>

            </Card>
        </div>
    );
}
