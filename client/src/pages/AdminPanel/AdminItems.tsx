// client/src/pages/AdminPanel/AdminItems.tsx
import { useState, useEffect } from 'react';
import { fetchAdminItems, createAdminItem, updateAdminItem, deleteAdminItem } from '../../api/admin';
import { getHeaders } from '../../api/helpers';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import { inputClass, selectClass, smallInputClass } from '../../utils/formStyles';
import EditItemModal from './EditItemModal';

interface Rarity {
    id: number;
    name: string;
    display_name: string;
    color: string;
}

const slots = [
    { value: 'helmet', label: 'Шлем' },
    { value: 'chest', label: 'Нагрудник' },
    { value: 'gloves', label: 'Перчатки' },
    { value: 'boots', label: 'Ботинки' },
    { value: 'amulet', label: 'Амулет' },
    { value: 'ring1', label: 'Кольцо' },
    { value: 'ring2', label: 'Кольцо' },
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
        extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0, hpRegen: 0 },
        image: '',
    });

    const loadItems = async () => {
        try { setItems(await fetchAdminItems()); } catch (e) { console.error(e); }
    };

    const loadRarities = async () => {
        try {
            const res = await fetch('/api/admin/rarities', { headers: getHeaders() });
            if (res.ok) setRarities(await res.json());
        } catch (e) { console.error(e); }
    };

    useEffect(() => { loadItems(); loadRarities(); }, []);

    const handleCreateItem = async () => {
        try {
            await createAdminItem(newItem);
            setMessage('Предмет создан');
            loadItems();
            setNewItem({ name: '', slot: 'helmet', rarity_id: 0, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0, hpRegen: 0 }, image: '' });
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
