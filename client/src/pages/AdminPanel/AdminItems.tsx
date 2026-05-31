// client/src/pages/AdminPanel/AdminItems.tsx
import { useState, useEffect } from 'react';
import { fetchAdminItems, createAdminItem, updateAdminItem, deleteAdminItem } from '../../api/admin';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';

interface Rarity {
    id: number;
    name: string;
    display_name: string;
    color: string;
}

const inputClass = 'w-full p-1.5 mb-1 bg-[var(--color-bg-input)] border border-[var(--color-border-light)] rounded text-[var(--color-text-primary)] text-sm';
const smallInputClass = 'w-16 p-1 bg-[var(--color-bg-input)] border border-[var(--color-border-light)] rounded text-[var(--color-text-primary)] text-sm';
const selectClass = 'w-full p-1.5 mb-1 bg-[var(--color-bg-input)] border border-[var(--color-border-light)] rounded text-[var(--color-text-primary)] text-sm';

const slots = [
    { value: 'helmet', label: 'Шлем' },
    { value: 'chest', label: 'Нагрудник' },
    { value: 'gloves', label: 'Перчатки' },
    { value: 'boots', label: 'Ботинки' },
    { value: 'amulet', label: 'Амулет' },
    { value: 'ring1', label: 'Кольцо 1' },
    { value: 'ring2', label: 'Кольцо 2' },
    { value: 'belt', label: 'Пояс' },
    { value: 'weapon1', label: 'Оружие 1' },
    { value: 'weapon2', label: 'Оружие 2' },
];

export default function AdminItems() {
    const [items, setItems] = useState<any[]>([]);
    const [rarities, setRarities] = useState<Rarity[]>([]);
    const [message, setMessage] = useState('');
    const [editingItem, setEditingItem] = useState<any>(null);
    const [newItem, setNewItem] = useState({
        name: '', slot: 'helmet', rarity_id: 0,
        bonuses: { s: 0, a: 0, d: 0, m: 0 },
        extra: { stamReg: 0, crit: 0, dodge: 0, counter: 0, fullBlock: 0, hpRegen: 0 },
        image: '',
    });

    const loadItems = async () => {
        try { setItems(await fetchAdminItems()); } catch (e) { console.error(e); }
    };

    const loadRarities = async () => {
        try {
            const res = await fetch('/api/admin/rarities', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
            if (res.ok) setRarities(await res.json());
        } catch (e) { console.error(e); }
    };

    useEffect(() => { loadItems(); loadRarities(); }, []);

    const handleCreateItem = async () => {
        try {
            await createAdminItem(newItem);
            setMessage('Предмет создан');
            loadItems();
            setNewItem({ name: '', slot: 'helmet', rarity_id: 0, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { stamReg: 0, crit: 0, dodge: 0, counter: 0, fullBlock: 0, hpRegen: 0 }, image: '' });
        } catch (e: any) { setMessage(e.message); }
    };

    const handleUpdateItem = async (form: any) => {
        try {
            await updateAdminItem(editingItem.id, form);
            setMessage('Предмет обновлён');
            setEditingItem(null);
            loadItems();
        } catch (e: any) { setMessage(e.message); }
    };

    const handleDeleteItem = async (id: number) => {
        if (!confirm('Удалить предмет?')) return;
        try { await deleteAdminItem(id); loadItems(); } catch (e: any) { setMessage(e.message); }
    };

    return (
        <div>
            {/* Форма создания */}
            <Card className="mb-4">
                <h3 className="font-bold mb-2">Добавить предмет</h3>
                <div className="grid grid-cols-2 gap-2">
                    <input placeholder="Название" value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} className={inputClass} />
                    <select value={newItem.slot} onChange={e => setNewItem({ ...newItem, slot: e.target.value })} className={selectClass}>
                        {slots.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                    <select value={newItem.rarity_id} onChange={e => setNewItem({ ...newItem, rarity_id: +e.target.value })} className={selectClass}>
                        {rarities.map(r => <option key={r.id} value={r.id} style={{ color: r.color }}>{r.display_name}</option>)}
                    </select>
                    <input placeholder="Изображение (имя файла в public)" value={newItem.image || ''} onChange={e => setNewItem({ ...newItem, image: e.target.value })} className={inputClass} />
                </div>
                <details className="mt-2">
                    <summary className="cursor-pointer text-sm mb-1">Бонусы и доп. характеристики</summary>
                    <div className="grid grid-cols-2 gap-2">
                        <label className="text-xs">Сила <input type="number" value={newItem.bonuses.s} onChange={e => setNewItem({ ...newItem, bonuses: { ...newItem.bonuses, s: +e.target.value } })} className={smallInputClass} /></label>
                        <label className="text-xs">Ловк <input type="number" value={newItem.bonuses.a} onChange={e => setNewItem({ ...newItem, bonuses: { ...newItem.bonuses, a: +e.target.value } })} className={smallInputClass} /></label>
                        <label className="text-xs">Защ <input type="number" value={newItem.bonuses.d} onChange={e => setNewItem({ ...newItem, bonuses: { ...newItem.bonuses, d: +e.target.value } })} className={smallInputClass} /></label>
                        <label className="text-xs">Маст <input type="number" value={newItem.bonuses.m} onChange={e => setNewItem({ ...newItem, bonuses: { ...newItem.bonuses, m: +e.target.value } })} className={smallInputClass} /></label>
                        <label className="text-xs">Реген вын. <input type="number" value={newItem.extra.stamReg} onChange={e => setNewItem({ ...newItem, extra: { ...newItem.extra, stamReg: +e.target.value } })} className={smallInputClass} /></label>
                        <label className="text-xs">Крит % <input type="number" value={newItem.extra.crit} onChange={e => setNewItem({ ...newItem, extra: { ...newItem.extra, crit: +e.target.value } })} className={smallInputClass} /></label>
                        <label className="text-xs">Уклонение % <input type="number" value={newItem.extra.dodge} onChange={e => setNewItem({ ...newItem, extra: { ...newItem.extra, dodge: +e.target.value } })} className={smallInputClass} /></label>
                        <label className="text-xs">Контрудар % <input type="number" value={newItem.extra.counter} onChange={e => setNewItem({ ...newItem, extra: { ...newItem.extra, counter: +e.target.value } })} className={smallInputClass} /></label>
                        <label className="text-xs">Полный блок % <input type="number" value={newItem.extra.fullBlock} onChange={e => setNewItem({ ...newItem, extra: { ...newItem.extra, fullBlock: +e.target.value } })} className={smallInputClass} /></label>
                        <label className="text-xs">Реген HP <input type="number" value={newItem.extra.hpRegen} onChange={e => setNewItem({ ...newItem, extra: { ...newItem.extra, hpRegen: +e.target.value } })} className={smallInputClass} /></label>
                    </div>
                </details>
                <Button variant="success" size="sm" className="mt-3" onClick={handleCreateItem}>Создать</Button>
            </Card>

            {/* Таблица предметов */}
            <Card>
                <h3 className="font-bold mb-2">Все предметы</h3>
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                        <thead>
                            <tr className="border-b border-[var(--color-border-default)]">
                                <th className="text-left p-1.5">Название</th>
                                <th className="text-left p-1.5">Слот</th>
                                <th className="text-left p-1.5">Редкость</th>
                                <th className="text-left p-1.5">Действия</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item: any) => (
                                <tr key={item.id} className="border-b border-[var(--color-border-light)]">
                                    <td className="p-1.5">{item.name}</td>
                                    <td className="p-1.5">{item.slot}</td>
                                    <td className="p-1.5" style={{ color: item.rarity_color }}>{item.rarity_display}</td>
                                    <td className="p-1.5">
                                        <Button variant="primary" size="xs" className="mr-1" onClick={() => setEditingItem({ ...item, bonuses: JSON.parse(item.bonuses || '{}'), extra: JSON.parse(item.extra || '{}') })}>Ред.</Button>
                                        <Button variant="danger" size="xs" onClick={() => handleDeleteItem(item.id)}>Удалить</Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Модалка редактирования */}
            {editingItem && (
                <EditItemModal
                    item={editingItem}
                    rarities={rarities}
                    onSave={handleUpdateItem}
                    onClose={() => setEditingItem(null)}
                />
            )}

            {message && (
                <div className="mt-4 p-3 bg-[var(--color-bg-card)] rounded text-sm">{message}</div>
            )}
        </div>
    );
}

function EditItemModal({ item, rarities, onSave, onClose }: { item: any; rarities: Rarity[]; onSave: (data: any) => void; onClose: () => void }) {
    const [form, setForm] = useState({
        name: item.name || '',
        slot: item.slot || 'helmet',
        rarity_id: item.rarity_id ?? 0,
        bonuses: { s: item.bonuses?.s ?? 0, a: item.bonuses?.a ?? 0, d: item.bonuses?.d ?? 0, m: item.bonuses?.m ?? 0 },
        extra: { stamReg: item.extra?.stamReg ?? 0, crit: item.extra?.crit ?? 0, dodge: item.extra?.dodge ?? 0, counter: item.extra?.counter ?? 0, fullBlock: item.extra?.fullBlock ?? 0, hpRegen: item.extra?.hpRegen ?? 0 },
        image: item.image || '',
    });

    const set = (path: string, value: any) => {
        setForm(prev => {
            const clone = structuredClone(prev);
            const keys = path.split('.');
            let target: any = clone;
            for (let i = 0; i < keys.length - 1; i++) target = target[keys[i]];
            target[keys[keys.length - 1]] = value;
            return clone;
        });
    };

    return (
        <Modal open={!!item} onClose={onClose} title="Редактировать предмет" maxWidth="500px" borderColor="var(--color-border-default)">
            <input placeholder="Название" value={form.name} onChange={e => set('name', e.target.value)} className={inputClass} />
            <select value={form.slot} onChange={e => set('slot', e.target.value)} className={selectClass}>
                {slots.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <select value={form.rarity_id} onChange={e => set('rarity_id', +e.target.value)} className={selectClass}>
                {rarities.map(r => <option key={r.id} value={r.id} style={{ color: r.color }}>{r.display_name}</option>)}
            </select>
            <input placeholder="Изображение (имя файла в public)" value={form.image || ''} onChange={e => set('image', e.target.value)} className={inputClass} />

            <details className="my-2">
                <summary className="cursor-pointer text-sm">Бонусы и доп. характеристики</summary>
                <div className="grid grid-cols-2 gap-2 mt-2">
                    <label className="text-xs">Сила <input type="number" value={form.bonuses.s} onChange={e => set('bonuses.s', +e.target.value)} className={smallInputClass} /></label>
                    <label className="text-xs">Ловк <input type="number" value={form.bonuses.a} onChange={e => set('bonuses.a', +e.target.value)} className={smallInputClass} /></label>
                    <label className="text-xs">Защ <input type="number" value={form.bonuses.d} onChange={e => set('bonuses.d', +e.target.value)} className={smallInputClass} /></label>
                    <label className="text-xs">Маст <input type="number" value={form.bonuses.m} onChange={e => set('bonuses.m', +e.target.value)} className={smallInputClass} /></label>
                    <label className="text-xs">Реген вын. <input type="number" value={form.extra.stamReg} onChange={e => set('extra.stamReg', +e.target.value)} className={smallInputClass} /></label>
                    <label className="text-xs">Крит % <input type="number" value={form.extra.crit} onChange={e => set('extra.crit', +e.target.value)} className={smallInputClass} /></label>
                    <label className="text-xs">Уклонение % <input type="number" value={form.extra.dodge} onChange={e => set('extra.dodge', +e.target.value)} className={smallInputClass} /></label>
                    <label className="text-xs">Контрудар % <input type="number" value={form.extra.counter} onChange={e => set('extra.counter', +e.target.value)} className={smallInputClass} /></label>
                    <label className="text-xs">Полный блок % <input type="number" value={form.extra.fullBlock} onChange={e => set('extra.fullBlock', +e.target.value)} className={smallInputClass} /></label>
                    <label className="text-xs">Реген HP <input type="number" value={form.extra.hpRegen} onChange={e => set('extra.hpRegen', +e.target.value)} className={smallInputClass} /></label>
                </div>
            </details>

            <div className="flex gap-4 justify-center mt-4">
                <Button variant="success" size="sm" onClick={() => onSave(form)}>Сохранить</Button>
                <Button variant="danger" size="sm" onClick={onClose}>Отмена</Button>
            </div>
        </Modal>
    );
}
