import { useState, useEffect } from 'react';
import { getHeaders } from '../../api/helpers';
import Button from '../../components/ui/Button';
import { inputClass } from '../../utils/formStyles';

interface CollectionSet {
    id: number;
    name: string;
    description: string;
    bonus_percent: number;
    sort_order: number;
    items?: { item_name: string; slot: string }[];
}

export default function AdminCollections() {
    const [sets, setSets] = useState<CollectionSet[]>([]);
    const [message, setMessage] = useState('');
    const [editing, setEditing] = useState<CollectionSet | null>(null);
    const [form, setForm] = useState({ name: '', description: '', bonus_percent: 1, sort_order: 0 });
    const [loading, setLoading] = useState(true);

    const load = async () => {
        try {
            const res = await fetch('/api/admin/collection-sets', { headers: getHeaders() });
            const data = await res.json();
            setSets(data);
        } catch { setMessage('Ошибка загрузки'); }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const resetForm = () => {
        setForm({ name: '', description: '', bonus_percent: 1, sort_order: 0 });
        setEditing(null);
    };

    const handleSave = async () => {
        if (!form.name.trim()) { setMessage('Название обязательно'); return; }
        try {
            const url = editing
                ? `/api/admin/collection-sets/${editing.id}`
                : '/api/admin/collection-sets';
            const method = editing ? 'PUT' : 'POST';
            const body: any = { ...form, items: undefined };

            const res = await fetch(url, {
                method,
                headers: { ...getHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error('Ошибка');
            setMessage(editing ? 'Сет обновлён' : 'Сет создан');
            resetForm();
            load();
        } catch { setMessage('Ошибка сохранения'); }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Удалить сет?')) return;
        try {
            await fetch(`/api/admin/collection-sets/${id}`, { method: 'DELETE', headers: getHeaders() });
            setMessage('Сет удалён');
            load();
        } catch { setMessage('Ошибка удаления'); }
    };

    const handleEdit = (set: CollectionSet) => {
        setEditing(set);
        setForm({ name: set.name, description: set.description, bonus_percent: set.bonus_percent, sort_order: set.sort_order });
    };

    if (loading) return <p className="text-sm text-[var(--color-text-muted)]">Загрузка...</p>;

    return (
        <div>
            {message && <p className="text-sm mb-2 text-[var(--color-accent-info)]">{message}</p>}

            {/* Form */}
            <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border-light)] rounded-lg p-3 mb-4 space-y-2">
                <h3 className="font-bold text-sm">{editing ? 'Редактировать сет' : 'Новый сет'}</h3>
                <input className={inputClass} placeholder="Название" value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })} />
                <input className={inputClass} placeholder="Описание" value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })} />
                <div className="flex gap-2">
                    <label className="text-xs text-[var(--color-text-muted)]">
                        Бонус %
                        <input type="number" className={inputClass + ' w-20 ml-1'} value={form.bonus_percent}
                            onChange={e => setForm({ ...form, bonus_percent: Number(e.target.value) })} min={0} max={100} />
                    </label>
                    <label className="text-xs text-[var(--color-text-muted)]">
                        Порядок
                        <input type="number" className={inputClass + ' w-16 ml-1'} value={form.sort_order}
                            onChange={e => setForm({ ...form, sort_order: Number(e.target.value) })} min={0} />
                    </label>
                </div>
                <div className="flex gap-2">
                    <Button variant="danger" size="sm" onClick={handleSave}>Сохранить</Button>
                    {editing && <Button variant="secondary" size="sm" onClick={resetForm}>Отмена</Button>}
                </div>
            </div>

            {/* List */}
            <div className="space-y-2">
                {sets.map(set => (
                    <div key={set.id} className="bg-[var(--color-bg-secondary)] border border-[var(--color-border-light)] rounded-lg p-3">
                        <div className="flex justify-between items-start">
                            <div>
                                <h4 className="font-bold text-sm">{set.name}</h4>
                                <p className="text-xs text-[var(--color-text-muted)]">{set.description}</p>
                                <p className="text-xs">Бонус: +{set.bonus_percent}% | Порядок: {set.sort_order} | Предметов: {set.items?.length || 0}</p>
                            </div>
                            <div className="flex gap-1">
                                <Button variant="secondary" size="sm" onClick={() => handleEdit(set)}>Ред.</Button>
                                <Button variant="danger" size="sm" onClick={() => handleDelete(set.id)}>Уд.</Button>
                            </div>
                        </div>
                    </div>
                ))}
                {sets.length === 0 && <p className="text-sm text-[var(--color-text-muted)]">Нет сетов</p>}
            </div>
        </div>
    );
}
