import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { guestLogin } from '../api';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';

const BASE_URL = '/api/oauth';

export default function LoginPage() {
    const { loginUser } = useAuth();
    const navigate = useNavigate();
    const [nickname, setNickname] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handlePlay = async () => {
        const name = nickname.trim();
        if (!name || name.length < 2) { setError('Минимум 2 символа'); return; }
        if (name.length > 16) { setError('Максимум 16 символов'); return; }
        if (!/^[a-zA-Zа-яА-ЯёЁ0-9_\- ]+$/.test(name)) { setError('Только буквы, цифры, _ и -'); return; }
        setLoading(true);
        try {
            const result = await guestLogin(name);
            loginUser(result.user, result.token);
            navigate('/');
        } catch (e: any) { setError(e.message); }
        setLoading(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && nickname.trim().length >= 2) handlePlay();
    };

    return (
        <div className="min-h-[80vh] flex items-center justify-center px-4 pt-16 sm:pt-0">
            <div className="max-w-md w-full text-center">
                <Card padding="lg">
                    <h1 className="text-2xl font-bold mb-2">⚔️ MMO Arena</h1>
                    <p className="text-sm text-[var(--color-text-muted)] mb-6">
                        Добро пожаловать в мир битв, гильдий и турниров!
                    </p>

                    <div className="text-left mb-4">
                        <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Представьтесь:</label>
                        <input
                            type="text"
                            placeholder="Ваш никнейм"
                            value={nickname}
                            onChange={e => setNickname(e.target.value)}
                            onKeyDown={handleKeyDown}
                            maxLength={16}
                            autoFocus
                            className="w-full p-3 bg-[var(--color-bg-input)] border border-[var(--color-border-light)] rounded-lg text-[var(--color-text-primary)] text-lg text-center outline-none focus:border-[var(--color-accent-info)] transition-colors"
                        />
                        {error && <p className="text-[var(--color-accent-danger)] text-xs mt-1">{error}</p>}
                    </div>

                    <Button variant="danger" fullWidth onClick={handlePlay} disabled={loading} className="text-base py-3">
                        {loading ? '...' : '⚔️ В бой!'}
                    </Button>

                    <p className="text-[0.6rem] text-[var(--color-text-muted)] mt-3">
                        Без паролей и регистраций — просто назовите себя
                    </p>

                    <div className="flex items-center gap-2 my-4">
                        <div className="flex-1 h-px bg-[var(--color-border-light)]" />
                        <span className="text-xs text-[var(--color-text-muted)]">привязать аккаунт</span>
                        <div className="flex-1 h-px bg-[var(--color-border-light)]" />
                    </div>

                    <div className="flex flex-col gap-2">
                        <a href={`${BASE_URL}/yandex`} className="flex items-center justify-center w-full p-2.5 rounded-lg text-sm font-medium bg-[#FC3F1D] text-white hover:bg-[#E5391A] transition-colors">
                            Яндекс ID
                        </a>
                        <a href={`${BASE_URL}/vk`} className="flex items-center justify-center w-full p-2.5 rounded-lg text-sm font-medium bg-[#0077FF] text-white hover:bg-[#0066DD] transition-colors">
                            VK ID
                        </a>
                    </div>
                    <p className="text-[0.6rem] text-[var(--color-text-muted)] mt-2">
                        За привязку аккаунта — <span className="text-[var(--color-accent-gold)]">3 дня премиума</span>
                    </p>

                    <div className="flex items-center gap-2 my-4">
                        <div className="flex-1 h-px bg-[var(--color-border-light)]" />
                        <span className="text-xs text-[var(--color-text-muted)]">уже есть аккаунт</span>
                        <div className="flex-1 h-px bg-[var(--color-border-light)]" />
                    </div>

                    <Button variant="secondary" fullWidth onClick={() => navigate('/login-classic')} className="text-xs">
                        Войти через email и пароль
                    </Button>
                </Card>

                <p className="text-[0.7rem] text-[var(--color-text-muted)] mt-4 leading-relaxed">
                    Нажимая «⚔️ В бой!», вы принимаете{' '}
                    <Link to="/rules" className="text-[var(--color-accent-info)] hover:underline">правила игры</Link>
                    {' '}и соглашаетесь на{' '}
                    <Link to="/privacy" className="text-[var(--color-accent-info)] hover:underline">обработку данных</Link>
                </p>
            </div>
        </div>
    );
}
