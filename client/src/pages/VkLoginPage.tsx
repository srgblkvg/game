import { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Card from '../components/ui/Card';

declare global {
  interface Window { vkBridge?: any; }
}

export default function VkLoginPage() {
    const { loginUser } = useAuth();
    const [error, setError] = useState('');
    const [done, setDone] = useState(false);

    const doLogin = useCallback(async () => {
        setError('');
        try {
            const params = new URLSearchParams(window.location.search);
            const vkUserId = params.get('vk_user_id');
            const sign = params.get('sign');

            if (!vkUserId || !sign) {
                setError('Нет параметров запуска VK');
                return;
            }

            // Получаем данные пользователя через VK Bridge (имя, фото, пол)
            let vkUserInfo: any = null;
            try {
                if (window.vkBridge) {
                    vkUserInfo = await window.vkBridge.send('VKWebAppGetUserInfo', {}) as any;
                }
            } catch { /* игнорируем */ }

            const res = await fetch('/api/auth/vk-bridge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    vkUserId,
                    sign,
                    vkAppId: params.get('vk_app_id'),
                    launchParams: window.location.search.substring(1),
                    vkUserInfo,  // доп. данные из VK Bridge
                }),
            });

            const data = await res.json();
            if (!res.ok || data.error) {
                throw new Error(data.error || `Ошибка ${res.status}`);
            }

            loginUser(data.user, data.token);
            localStorage.setItem('isVK', '1');
            setDone(true);
        } catch (err: any) {
            setError(err.message || 'Ошибка входа');
        }
    }, [loginUser]);

    useEffect(() => {
        if (new URLSearchParams(window.location.search).get('nologin') === '1') return;
        doLogin();
    }, []);

    if (done) return <Navigate to="/" />;

    if (error) {
        return (
            <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 100px)' }}>
                <Card className="p-6 max-w-sm w-full text-center">
                    <h1 className="text-xl font-bold mb-2">MMO Arena</h1>
                    <div className="p-3 rounded bg-red-500/10 border border-red-500/30 text-sm text-red-400 mb-4">
                        {error}
                    </div>
                    <button onClick={doLogin} className="w-full py-2 px-4 rounded-lg bg-[var(--color-accent-red)] text-white font-bold hover:opacity-90 transition-opacity cursor-pointer">
                        Попробовать снова
                    </button>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 100px)' }}>
            <div className="text-[var(--color-text-muted)] text-sm">Вход...</div>
        </div>
    );
}
