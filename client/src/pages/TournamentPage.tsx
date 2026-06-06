import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { getHeaders, BASE_URL } from '../api/helpers';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { fetchCharacter } from '../api/character';
import BackButton from '../components/ui/BackButton';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { formatMoney } from '../utils/money';

const divisionColors: Record<string, string> = {
    copper: '#b8703a', steel: '#909090', mithril: '#40b0d0', adamant: '#e03030',
};

export default function TournamentPage() {
    const { user } = useAuth();
    const { setCharacter } = useGame();
    const navigate = useNavigate();

    const [data, setData] = useState<any>(null);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    useEffect(() => { if (!user) navigate('/login'); else if (!user.isGuest) load(); }, [user]);

    const isGuest = user?.isGuest || false;

    const load = async () => {
        try {
            const res = await fetch(`${BASE_URL}/tournament`, { headers: getHeaders() });
            setData(await res.json());
        } catch (e: any) { setError(e.message); }
    };

    const handleRegister = async (division: string, golden?: boolean) => {
        try {
            const res = await fetch(`${BASE_URL}/tournament/register`, {
                method: 'POST', headers: getHeaders(),
                body: JSON.stringify({ division, goldenTicket: golden || false }),
            });
            const d = await res.json();
            if (!res.ok) { setError(d.error); return; }
            setMessage('Зарегистрирован!');
            const fresh = await fetchCharacter(); setCharacter(fresh);
            load();
        } catch (e: any) { setError(e.message); }
    };

    if (!data) return <div className="p-4">Загрузка...</div>;

    if (isGuest) {
        return (
            <div className="max-w-3xl mx-auto px-4 py-4">
                <BackButton to="/" />
                <h1 className="text-xl font-bold mb-4"><Icon icon="game-icons:trophy" width="22" height="22" className="inline mr-2" />Турнир «Кровавый Шпиль»</h1>
                <Card className="text-center py-6">
                    <Icon icon="game-icons:lock" width="40" height="40" className="mx-auto mb-3 text-[var(--color-text-muted)]" />
                    <p className="text-sm text-[var(--color-text-muted)]">
                        Турниры недоступны на гостевом аккаунте.
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">
                        Зарегистрируйтесь, чтобы участвовать в турнирах.
                    </p>
                </Card>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto px-4 py-4">
            <BackButton to="/" />
            <h1 className="text-xl font-bold mb-4"><Icon icon="game-icons:trophy" width="22" height="22" className="inline mr-2" />Турнир «Кровавый Шпиль»</h1>
            <p className="text-xs text-[var(--color-text-muted)] italic mb-4">
                «Раз в неделю ворота Арены закрываются. Наружу выходит только один.»
            </p>

            {message && <p className="text-sm text-[var(--color-accent-success)] mb-3">{message}</p>}
            {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

            {data.tournaments.map((t: any) => {
                const myReg = t.myRegistration;
                const isMyDivision = data.userLevel >= (t.division === 'copper' ? 1 : t.division === 'steel' ? 16 : t.division === 'mithril' ? 36 : 61)
                    && data.userLevel <= (t.division === 'copper' ? 15 : t.division === 'steel' ? 35 : t.division === 'mithril' ? 60 : 999);

                return (
                    <Card key={t.id} className="mb-3" style={{ borderColor: isMyDivision ? divisionColors[t.division] : undefined }}>
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="font-bold" style={{ color: divisionColors[t.division] }}>
                                {t.division === 'copper' ? '🥉' : t.division === 'steel' ? '🥈' : t.division === 'mithril' ? '🥇' : '👑'} {t.division === 'copper' ? 'Медный' : t.division === 'steel' ? 'Стальной' : t.division === 'mithril' ? 'Мифриловый' : 'Адамантовый'}
                            </h3>
                            <span className="text-xs text-[var(--color-text-muted)]">{t.status === 'registration' ? 'Регистрация' : t.status}</span>
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)] mb-2">
                            <p>Призовой фонд: {formatMoney(t.prizePool)}</p>
                            <p>Участников: {t.participantCount}</p>
                            {t.participants.slice(0, 5).map((p: any) => (
                                <span key={p.id} className="mr-2">{p.username}{p.goldenTicket ? '🎫' : ''}</span>
                            ))}
                            {t.participantCount > 5 && <span>+ ещё {t.participantCount - 5}</span>}
                        </div>

                        {t.status === 'registration' && isMyDivision && !myReg && (
                            <div className="flex gap-2">
                                <Button variant="danger" size="xs" onClick={() => handleRegister(t.division)}>
                                    Записаться (бесплатно)
                                </Button>
                                <Button variant="secondary" size="xs" onClick={() => handleRegister(t.division, true)}>
                                    🎫 Золотой билет (1000)
                                </Button>
                            </div>
                        )}
                        {myReg && <p className="text-xs text-[var(--color-accent-success)]">✅ Вы записаны {myReg.goldenTicket ? '🎫' : ''}</p>}

                        {t.matches && t.matches.length > 0 && (
                            <div className="mt-2">
                                <h4 className="text-xs font-bold mb-1">Бои</h4>
                                {t.matches.map((m: any) => (
                                    <div key={m.id} className="text-xs text-[var(--color-text-muted)]">
                                        Раунд {m.round}: {m.winnerId ? '✅ завершён' : '⏳ ожидание'}
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                );
            })}
        </div>
    );
}
