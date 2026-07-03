import { useState, useEffect } from 'react';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import { getHeaders } from '../../api/helpers';
import { formatMoney } from '../../utils/money';

const stepColors: Record<string, string> = {
  damage: '#e74c3c', crit: '#f1c40f', dodge: '#3498db',
  block: '#2ecc71', fullBlock: '#2ecc71', stun: '#9b59b6',
  counter: '#e67e22', end: '#f1c40f', money: '#f1c40f',
  attack: '#e74c3c', info: '#aaa',
};

const LIMIT = 20;

export default function AdminBattles() {
    const [battles, setBattles] = useState<any[]>([]);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [selected, setSelected] = useState<any>(null);

    const load = async () => {
        try {
            const res = await fetch(`/api/admin/battles?page=${page}&limit=${LIMIT}`, {
                headers: getHeaders(),
            });
            const data = await res.json();
            setBattles(data.battles || []);
            setTotal(data.total || 0);
        } catch (e) { console.error(e); }
    };

    useEffect(() => { load(); }, [page]);

    const totalPages = Math.ceil(total / LIMIT);

    const renderLog = () => {
        if (!selected) return null;
        let steps: any[] = [];
        try {
            steps = typeof selected.steps === 'string'
                ? JSON.parse(selected.steps)
                : (selected.steps || []);
        } catch { steps = []; }

        return (
            <Modal
                open={!!selected}
                onClose={() => setSelected(null)}
                title={`⚔ ${selected.attackerName} vs ${selected.defenderName}`}
                width="min(900px, calc(100vw - 2rem))"
                borderColor="var(--color-border-default)"
            >
                <div className="bg-black rounded-lg p-3 max-h-[60vh] overflow-y-auto font-mono text-xs leading-relaxed">
                    {steps.map((step: any, i: number) => (
                        <div key={i} className="mb-0.5" style={{ color: stepColors[step.type] || '#aaa' }}>
                            {step.message}
                        </div>
                    ))}
                </div>
                <div className="flex gap-4 justify-between mt-3 text-sm">
                    <span className={selected.winnerId === selected.attackerId ? 'text-[var(--color-accent-success)] font-bold' : 'text-[var(--color-accent-danger)] font-bold'}>
                        {selected.winnerId === selected.attackerId ? '🏆 Победил атакующий' : '💀 Победил защитник'}
                    </span>
                    <span>Опыт: +{selected.expGained || 0}</span>
                    {selected.moneyStolen > 0 && <span className="text-[var(--color-text-accent)]">Серебро: {formatMoney(selected.moneyStolen)}</span>}
                </div>
                <div className="flex justify-center mt-4">
                    <Button variant="secondary" size="sm" onClick={() => setSelected(null)}>Закрыть</Button>
                </div>
            </Modal>
        );
    };

    return (
        <div>
            <h3 className="font-bold mb-3">Все бои ({total})</h3>
            <Card>
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                        <thead>
                            <tr className="border-b border-[var(--color-border-default)]">
                                <th className="text-left p-1.5">ID</th>
                                <th className="text-left p-1.5">Атакующий</th>
                                <th className="text-left p-1.5">Защитник</th>
                                <th className="text-left p-1.5">Победитель</th>
                                <th className="text-left p-1.5">Опыт</th>
                                <th className="text-left p-1.5">Серебро</th>
                                <th className="text-left p-1.5">Время</th>
                                <th className="text-left p-1.5"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {battles.map((b: any) => (
                                <tr key={b.id} className="border-b border-[var(--color-border-light)]">
                                    <td className="p-1.5">{b.id}</td>
                                    <td className="p-1.5">{b.attackerName}</td>
                                    <td className="p-1.5">{b.defenderName}</td>
                                    <td className="p-1.5" style={{ color: b.winnerId === b.attackerId ? '#2ecc71' : '#e74c3c' }}>
                                        {b.winnerId === b.attackerId ? b.attackerName : b.defenderName}
                                    </td>
                                    <td className="p-1.5">{b.expGained || 0}</td>
                                    <td className="p-1.5 text-[var(--color-text-accent)]">{b.moneyStolen || 0}</td>
                                    <td className="p-1.5 text-xs">{new Date(b.createdAt).toLocaleString()}</td>
                                    <td className="p-1.5">
                                        <Button variant="primary" size="sm" onClick={() => setSelected(b)}>Лог</Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {totalPages > 1 && (
                    <div className="flex justify-center gap-4 mt-4 items-center">
                        <Button size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Назад</Button>
                        <span className="text-sm text-[var(--color-text-secondary)]">стр. {page} из {totalPages}</span>
                        <Button size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Вперёд →</Button>
                    </div>
                )}
            </Card>
            {renderLog()}
        </div>
    );
}
