import { useState, useEffect } from 'react';
import { fetchAdminItems, createAdminItem, updateAdminItem, deleteAdminItem } from '../../api';
import EditItemModal from './EditItemModal';

const rarityNames = ['Серый', 'Белый', 'Зелёный', 'Синий', 'Фиолетовый', 'Жёлтый', 'Красный'];

export default function AdminItems() {
    const [items, setItems] = useState<any[]>([]);
    const [message, setMessage] = useState('');
    const [editingItem, setEditingItem] = useState<any>(null);
    const [newItem, setNewItem] = useState({
        name: '', slot: 'helmet', rarity: 0,
        bonuses: { s: 0, a: 0, d: 0, m: 0 },
        extra: { stamReg: 0, crit: 0, dodge: 0, counter: 0, fullBlock: 0, hpRegen: 0 },
        image: '',
    });

    const loadItems = async () => {
        try { setItems(await fetchAdminItems()); } catch (e) { console.error(e); }
    };

    useEffect(() => { loadItems(); }, []);

    const handleCreateItem = async () => {
        try {
            await createAdminItem(newItem);
            setMessage('Предмет создан');
            loadItems();
            setNewItem({ name: '', slot: 'helmet', rarity: 0, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { stamReg: 0, crit: 0, dodge: 0, counter: 0, fullBlock: 0, hpRegen: 0 }, image: '' });
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
            <div style={{ marginBottom: '1rem', background: '#1e1e30', padding: '1rem', borderRadius: '8px' }}>
                <h3>Добавить предмет</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <input placeholder="Название" value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} />
                    <select value={newItem.slot} onChange={e => setNewItem({ ...newItem, slot: e.target.value })}>
                        <option value="helmet">Шлем</option>
                        <option value="chest">Нагрудник</option>
                        <option value="gloves">Перчатки</option>
                        <option value="boots">Ботинки</option>
                        <option value="amulet">Амулет</option>
                        <option value="ring1">Кольцо 1</option>
                        <option value="ring2">Кольцо 2</option>
                        <option value="belt">Пояс</option>
                        <option value="weapon1">Оружие 1</option>
                        <option value="weapon2">Оружие 2</option>
                    </select>
                    <select value={newItem.rarity} onChange={e => setNewItem({ ...newItem, rarity: parseInt(e.target.value) })}>
                        {rarityNames.map((name, i) => <option key={i} value={i}>{name}</option>)}
                    </select>
                    <input
                        placeholder="Изображение (имя файла в public)"
                        value={newItem.image || ''}
                        onChange={e => setNewItem({ ...newItem, image: e.target.value })}
                    />
                </div>
                <details style={{ marginTop: '0.5rem' }}>
                    <summary>Бонусы и доп. характеристики</summary>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <label>Сила <input type="number" value={newItem.bonuses.s} onChange={e => setNewItem({ ...newItem, bonuses: { ...newItem.bonuses, s: +e.target.value } })} /></label>
                        <label>Ловк <input type="number" value={newItem.bonuses.a} onChange={e => setNewItem({ ...newItem, bonuses: { ...newItem.bonuses, a: +e.target.value } })} /></label>
                        <label>Защ <input type="number" value={newItem.bonuses.d} onChange={e => setNewItem({ ...newItem, bonuses: { ...newItem.bonuses, d: +e.target.value } })} /></label>
                        <label>Маст <input type="number" value={newItem.bonuses.m} onChange={e => setNewItem({ ...newItem, bonuses: { ...newItem.bonuses, m: +e.target.value } })} /></label>
                        <label>Реген вын. <input type="number" value={newItem.extra.stamReg} onChange={e => setNewItem({ ...newItem, extra: { ...newItem.extra, stamReg: +e.target.value } })} /></label>
                        <label>Крит % <input type="number" value={newItem.extra.crit} onChange={e => setNewItem({ ...newItem, extra: { ...newItem.extra, crit: +e.target.value } })} /></label>
                        <label>Уклонение % <input type="number" value={newItem.extra.dodge} onChange={e => setNewItem({ ...newItem, extra: { ...newItem.extra, dodge: +e.target.value } })} /></label>
                        <label>Контрудар % <input type="number" value={newItem.extra.counter} onChange={e => setNewItem({ ...newItem, extra: { ...newItem.extra, counter: +e.target.value } })} /></label>
                        <label>Полный блок % <input type="number" value={newItem.extra.fullBlock} onChange={e => setNewItem({ ...newItem, extra: { ...newItem.extra, fullBlock: +e.target.value } })} /></label>
                        <label>Реген HP <input type="number" value={newItem.extra.hpRegen} onChange={e => setNewItem({ ...newItem, extra: { ...newItem.extra, hpRegen: +e.target.value } })} /></label>
                    </div>
                </details>
                <button onClick={handleCreateItem} style={{ marginTop: '1rem', background: '#2ecc71', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}>Создать</button>
            </div>

            <div style={{ background: '#1e1e30', padding: '1rem', borderRadius: '8px' }}>
                <h3>Все предметы</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid #444' }}>
                            <th>Название</th><th>Слот</th><th>Редкость</th><th>Действия</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item: any) => (
                            <tr key={item.id} style={{ borderBottom: '1px solid #333' }}>
                                <td>{item.name}</td>
                                <td>{item.slot}</td>
                                <td style={{ color: ['#888', '#ccc', '#2ecc71', '#3498db', '#9b59b6', '#f1c40f', '#e74c3c'][item.rarity] }}>{rarityNames[item.rarity]}</td>
                                <td>
                                    <button onClick={() => setEditingItem({ ...item, bonuses: JSON.parse(item.bonuses || '{}'), extra: JSON.parse(item.extra || '{}') })} style={{ background: '#3498db', border: 'none', color: '#fff', padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: 'pointer', marginRight: '0.3rem' }}>Ред.</button>
                                    <button onClick={() => handleDeleteItem(item.id)} style={{ background: '#c0392b', border: 'none', color: '#fff', padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: 'pointer' }}>Удалить</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {editingItem && <EditItemModal item={editingItem} onSave={handleUpdateItem} onClose={() => setEditingItem(null)} />}
            {message && <div style={{ marginTop: '1rem', background: '#2a2a3e', padding: '0.5rem', borderRadius: '4px' }}>{message}</div>}
        </div>
    );
}