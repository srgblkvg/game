import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { login, verifyEmail, resendCode } from '../api';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';

const BASE_URL = '/api/oauth';

export default function LoginPage() {
    const { loginUser } = useAuth();
    const navigate = useNavigate();

    // Шаг 1: логин/пароль
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');

    // Шаг 2: подтверждение почты (если не подтверждена)
    const [verifyEmailAddr, setVerifyEmailAddr] = useState('');
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [resendMsg, setResendMsg] = useState('');

    const handleLogin = async () => {
        try {
            setError('');
            setLoading(true);
            const result = await login(username, password);
            loginUser(result.user, result.token);
            navigate(result.user.role === 'admin' ? '/adminpanel' : '/');
        } catch (e: any) {
            // Если почта не подтверждена — показываем поле кода
            if (e.message?.includes('Почта не подтверждена')) {
                // Извлекаем email из ответа (если сервер его вернул)
                setVerifyEmailAddr(username.includes('@') ? username : '');
                setError(e.message);
            } else {
                setError(e.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async () => {
        try {
            setError('');
            setLoading(true);
            const email = verifyEmailAddr || username;
            const result = await verifyEmail(email, code);
            loginUser(result.user, result.token);
            navigate('/');
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
            const email = verifyEmailAddr || username;
            await resendCode(email);
            setResendMsg('Код отправлен повторно');
        } catch (e: any) {
            setResendMsg(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && username && password) handleLogin();
    };

    // Показываем поле кода если есть ошибка о неподтверждённой почте
    const showVerification = error.includes('Почта не подтверждена');

    return (
        <div className="max-w-md mx-auto mt-8 px-4">
            <Card padding="lg">
                <h1 className="text-xl font-bold mb-4">Вход в игру</h1>

                {showVerification ? (
                    <>
                        <p className="text-sm text-[var(--color-text-muted)] mb-2">
                            Введите код подтверждения, отправленный на почту
                        </p>
                        <p className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded p-2 mb-3">
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
                        {resendMsg && <p className={`text-sm mt-2 ${resendMsg.includes('отправлен') ? 'text-green-400' : 'text-red-500'}`}>{resendMsg}</p>}
                        {error && <p className="text-red-500 mt-2 text-sm">{error}</p>}
                        <div className="flex gap-2 mt-3">
                            <button onClick={handleResend} disabled={loading} className="flex-1 text-sm text-[var(--color-accent-info)] hover:underline">
                                Отправить код повторно
                            </button>
                            <button onClick={() => { setError(''); setVerifyEmailAddr(''); setCode(''); }} className="flex-1 text-sm text-[var(--color-text-muted)] hover:underline">
                                ← Назад
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <input
                            type="text"
                            placeholder="Email или логин"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="w-full p-2 mb-2 bg-[var(--color-bg-input)] border border-[var(--color-border-light)] rounded text-[var(--color-text-primary)] text-sm outline-none focus:border-[var(--color-accent-info)]"
                        />
                        <div className="relative mb-3">
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
                        <Button variant="danger" fullWidth onClick={handleLogin} disabled={loading}>
                            {loading ? '...' : 'Войти'}
                        </Button>
                        {error && <p className="text-red-500 mt-2 text-sm">{error}</p>}

                        <p className="text-center text-sm text-[var(--color-text-muted)] mt-4">
                            Нет аккаунта?{' '}
                            <Link to="/register" className="text-[var(--color-accent-info)] hover:underline">
                                Зарегистрироваться
                            </Link>
                        </p>

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
                    </>
                )}
            </Card>
        </div>
    );
}
