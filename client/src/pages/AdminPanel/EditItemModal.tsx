// client/src/pages/AdminPanel/EditItemModal.tsx
import { useState } from 'react';

interface Rarity {
    id: number;
    name: string;
    display_name: string;
    color: string;
}

interface EditItemModalProps {
    item: any;
    rarities: Rarity[];
    onSave: (data: any) => void;
    onClose: () => void;
}

export default function EditItemModal({ item, rarities, onSave, onClose }: EditItemModalProps) {
    const [form, setForm] = useState({
        name: item.name || '',
        slot: item.slot || 'helmet',
        rarity_id: item.rarity_id ?? 0,
        bonuses: {
            s: item.bonuses?.s ?? 0,
            a: item.bonuses?.a ?? 0,
            d: item.bonuses?.d ?? 0,
            m: item.bonuses?.m ?? 0,
        },
        extra: {
            stamReg: item.extra?.stamReg ?? 0,
            crit: item.extra?.crit ?? 0,
            dodge: item.extra?.dodge ?? 0,
            counter: item.extra?.counter ?? 0,
            fullBlock: item.extra?.fullBlock ?? 0,
            hpRegen: item.extra?.hpRegen ?? 0,
        },
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
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 500 }}>
            <div style={{ background: '#2a2a3e', padding: '1.5rem', borderRadius: '12px', width: '90%', maxWidth: '500px', color: '#eee', maxHeight: '90vh', overflowY: 'auto' }}>
                <h3>Редактировать предмет</h3>
                <input placeholder="Название" value={form.name} onChange={e => set('name', e.target.value)} style={inputStyle} />
                <select value={form.slot} onChange={e => set('slot', e.target.value)} style={inputStyle}>
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
                <select value={form.rarity_id} onChange={e => set('rarity_id', +e.target.value)} style={inputStyle}>
                    {rarities.map(r => (
                        <option key={r.id} value={r.id} style={{ color: r.color }}>{r.display_name}</option>
                    ))}
                </select>
                <input placeholder="Изображение (имя файла в public)" value={form.image || ''} onChange={e => set('image', e.target.value)} style={inputStyle} />

                <details>
                    <summary style={{ cursor: 'pointer', margin: '0.5rem 0' }}>Бонусы и доп. характеристики</summary>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <label>Сила <input type="number" value={form.bonuses.s} onChange={e => set('bonuses.s', +e.target.value)} style={smallInputStyle} /></label>
                        <label>Ловк <input type="number" value={form.bonuses.a} onChange={e => set('bonuses.a', +e.target.value)} style={smallInputStyle} /></label>
                        <label>Защ <input type="number" value={form.bonuses.d} onChange={e => set('bonuses.d', +e.target.value)} style={smallInputStyle} /></label>
                        <label>Маст <input type="number" value={form.bonuses.m} onChange={e => set('bonuses.m', +e.target.value)} style={smallInputStyle} /></label>
                        <label>Реген вын. <input type="number" value={form.extra.stamReg} onChange={e => set('extra.stamReg', +e.target.value)} style={smallInputStyle} /></label>
                        <label>Крит % <input type="number" value={form.extra.crit} onChange={e => set('extra.crit', +e.target.value)} style={smallInputStyle} /></label>
                        <label>Уклонение % <input type="number" value={form.extra.dodge} onChange={e => set('extra.dodge', +e.target.value)} style={smallInputStyle} /></label>
                        <label>Контрудар % <input type="number" value={form.extra.counter} onChange={e => set('extra.counter', +e.target.value)} style={smallInputStyle} /></label>
                        <label>Полный блок % <input type="number" value={form.extra.fullBlock} onChange={e => set('extra.fullBlock', +e.target.value)} style={smallInputStyle} /></label>
                        <label>Реген HP <input type="number" value={form.extra.hpRegen} onChange={e => set('extra.hpRegen', +e.target.value)} style={smallInputStyle} /></label>
                    </div>
                </details>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', justifyContent: 'center' }}>
                    <button onClick={() => onSave(form)} style={{ background: '#2ecc71', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', color: '#fff' }}>Сохранить</button>
                    <button onClick={onClose} style={{ background: '#e74c3c', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', color: '#fff' }}>Отмена</button>
                </div>
            </div>
        </div>
    );
}

const inputStyle: React.CSSProperties = { width: '100%', padding: '0.3rem', marginBottom: '0.5rem', background: '#333', border: '1px solid #555', borderRadius: '4px', color: '#fff' };
const smallInputStyle: React.CSSProperties = { width: '60px', padding: '0.2rem', background: '#333', border: '1px solid #555', borderRadius: '4px', color: '#fff' };