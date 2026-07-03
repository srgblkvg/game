import { useEffect, useState } from 'react';
import { fetchAdminTournaments, createAdminTournament, updateAdminTournament, deleteAdminTournament, startAdminTournament, finishAdminTournament } from '../../api/admin';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { fmtSafeDate, safeDate } from "../../utils/date";
import { inputClass, selectClass } from '../../utils/formStyles';

interface Tournament {
    id: number;
    division: string;
    status: string;
    registrationStart: number;
    registrationEnd: number;
    prizePool: number;
    participantCount: number;
}

interface Division {
    name: string;
    label: string;
    basePool: number;
}

const STATUS_LABELS: Record<string, string> = {
    registration: 'Регистрация',
    in_progress: 'В процессе',
    completed: 'Завершён',
};

const STATUS_COLORS: Record<string, string> = {
    registration: 'text-[var(--color-accent-info)]',
    in_progress: 'text-[var(--color-accent-danger)]',
    completed: 'text-[var(--color-text-muted)]',
};

function formatDate(ts: number): string {
    if (!ts) return '—';
    return fmtSafeDate(ts, { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' });
}

export default function AdminTournaments() {
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [divisions, setDivisions] = useState<Division[]>([]);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState('');

    // Форма создания
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [form, setForm] = useState({ division: 'copper', registrationStart: '', registrationEnd: '', prizePool: 500, status: 'registration' });

    const load = async () => {
        setLoading(true);
        try {
            const data = await fetchAdminTournaments();
            setTournaments(data.tournaments || []);
            setDivisions(data.divisions || []);
        } catch { }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const resetForm = () => {
        setForm({ division: 'copper', registrationStart: '', registrationEnd: '', prizePool: 500, status: 'registration' });
        setEditingId(null);
        setShowForm(false);
    };

    const startEdit = (t: Tournament) => {
        const toLocal = (ts: number) => {
            const d = safeDate(ts);
            return d?.toISOString().slice(0, 16) ?? '';
        };
        setForm({
            division: t.division,
            registrationStart: toLocal(t.registrationStart),
            registrationEnd: toLocal(t.registrationEnd),
            prizePool: t.prizePool,
            status: t.status,
        });
        setEditingId(t.id);
        setShowForm(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMsg('');
        try {
            const body: any = {
                division: form.division,
                prizePool: +form.prizePool,
                status: form.status,
            };
            if (form.registrationStart) body.registrationStart = Math.floor(new Date(form.registrationStart).getTime() / 1000);
            if (form.registrationEnd) body.registrationEnd = Math.floor(new Date(form.registrationEnd).getTime() / 1000);

            if (editingId) {
                await updateAdminTournament(editingId, body);
                setMsg('Турнир обновлён');
            } else {
                await createAdminTournament(body);
                setMsg('Турнир создан');
            }
            resetForm();
            load();
        } catch (e: any) {
            setMsg(e.message || 'Ошибка');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Удалить турнир и всех участников?')) return;
        try {
            await deleteAdminTournament(id);
            setMsg('Турнир удалён');
            load();
        } catch (e: any) { setMsg(e.message); }
    };

    const handleStart = async (id: number) => {
        try {
            await startAdminTournament(id);
            setMsg('Турнир запущен');
            load();
        } catch (e: any) { setMsg(e.message); }
    };

    const handleFinish = async (id: number) => {
        try {
            await finishAdminTournament(id);
            setMsg('Турнир завершён');
            load();
        } catch (e: any) { setMsg(e.message); }
    };

    if (loading) return <div className="p-4">Загрузка...</div>;

    return (
        <div>
            <div className="flex items-center gap-2 mb-4">
                <Button variant="success" size="sm" onClick={() => { resetForm(); setShowForm(!showForm); }}>
                    {showForm ? 'Скрыть форму' : 'Создать турнир'}
                </Button>
            </div>

            {showForm && (
                <Card className="mb-4">
                    <h3 className="font-bold mb-2">{editingId ? 'Редактировать турнир' : 'Новый турнир'}</h3>
                    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
                        <div className="flex gap-2">
                            <label className="text-sm flex-1">Дивизион<br />
                                <select value={form.division} onChange={e => setForm({ ...form, division: e.target.value, prizePool: divisions.find(d => d.name === e.target.value)?.basePool || form.prizePool })} className={selectClass}>
                                    {divisions.map(d => <option key={d.name} value={d.name}>{d.label} (приз: {d.basePool})</option>)}
                                </select>
                            </label>
                            <label className="text-sm flex-1">Статус<br />
                                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={selectClass}>
                                    <option value="registration">Регистрация</option>
                                    <option value="in_progress">В процессе</option>
                                    <option value="completed">Завершён</option>
                                </select>
                            </label>
                            <label className="text-sm flex-1">Призовой фонд<br />
                                <input type="number" value={form.prizePool} onChange={e => setForm({ ...form, prizePool: +e.target.value })} className={inputClass} />
                            </label>
                        </div>
                        <div className="flex gap-2">
                            <label className="text-sm flex-1">Начало регистрации<br />
                                <input type="datetime-local" value={form.registrationStart} onChange={e => setForm({ ...form, registrationStart: e.target.value })} className={inputClass} />
                            </label>
                            <label className="text-sm flex-1">Конец регистрации<br />
                                <input type="datetime-local" value={form.registrationEnd} onChange={e => setForm({ ...form, registrationEnd: e.target.value })} className={inputClass} />
                            </label>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="success" size="sm" type="submit">{editingId ? 'Сохранить' : 'Создать'}</Button>
                            {editingId && <Button variant="danger" size="sm" onClick={resetForm}>Отмена</Button>}
                        </div>
                    </form>
                </Card>
            )}

            {msg && <div className="mb-4 p-3 bg-[var(--color-bg-card)] rounded text-sm">{msg}</div>}

            <Card>
                <h3 className="font-bold mb-2">Турниры</h3>
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                        <thead>
                            <tr className="border-b border-[var(--color-border-default)]">
                                <th className="text-left p-1">ID</th>
                                <th className="text-left p-1">Дивизион</th>
                                <th className="text-left p-1">Статус</th>
                                <th className="text-left p-1">Рег. с</th>
                                <th className="text-left p-1">Рег. по</th>
                                <th className="text-left p-1">Приз</th>
                                <th className="text-left p-1">Участ.</th>
                                <th className="text-left p-1">Действия</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tournaments.map((t: Tournament) => (
                                <tr key={t.id} className="border-b border-[var(--color-border-light)]">
                                    <td className="p-1">{t.id}</td>
                                    <td className="p-1">{t.division}</td>
                                    <td className={`p-1 font-medium ${STATUS_COLORS[t.status] || ''}`}>{STATUS_LABELS[t.status] || t.status}</td>
                                    <td className="p-1 text-xs">{formatDate(t.registrationStart)}</td>
                                    <td className="p-1 text-xs">{formatDate(t.registrationEnd)}</td>
                                    <td className="p-1">{t.prizePool}</td>
                                    <td className="p-1">{t.participantCount}</td>
                                    <td className="p-1">
                                        <Button variant="primary" size="sm" className="mr-1" onClick={() => startEdit(t)}>Ред.</Button>
                                        {t.status === 'registration' && (
                                            <Button variant="success" size="sm" className="mr-1" onClick={() => handleStart(t.id)}>Старт</Button>
                                        )}
                                        {t.status === 'in_progress' && (
                                            <Button variant="danger" size="sm" className="mr-1" onClick={() => handleFinish(t.id)}>Финиш</Button>
                                        )}
                                        <Button variant="danger" size="sm" onClick={() => handleDelete(t.id)}>Удалить</Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
