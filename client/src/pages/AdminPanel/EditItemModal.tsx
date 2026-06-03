import { useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import { inputClass, selectClass, smallInputClass } from '../../utils/formStyles';

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

const slots = [
  { value: 'helmet', label: 'Шлем' },
  { value: 'chest', label: 'Нагрудник' },
  { value: 'gloves', label: 'Перчатки' },
  { value: 'boots', label: 'Ботинки' },
  { value: 'amulet', label: 'Амулет' },
  { value: 'ring', label: 'Кольцо' },
  { value: 'belt', label: 'Пояс' },
  { value: 'weapon1', label: 'Оружие' },
  { value: 'shield', label: 'Щит' },
];

export default function EditItemModal({ item, rarities, onSave, onClose }: EditItemModalProps) {
  const [form, setForm] = useState({
    name: item.name || '',
    slot: item.slot || 'helmet',
    rarity_id: item.rarity_id ?? 0,
    bonuses: { s: item.bonuses?.s ?? 0, a: item.bonuses?.a ?? 0, d: item.bonuses?.d ?? 0, m: item.bonuses?.m ?? 0 },
    extra: { crit: item.extra?.crit ?? 0, dodge: item.extra?.dodge ?? 0, counter: item.extra?.counter ?? 0, fullBlock: item.extra?.fullBlock ?? 0 },
    cost: item.cost ?? '',
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
          <label className="text-xs">Крит % <input type="number" value={form.extra.crit} onChange={e => set('extra.crit', +e.target.value)} className={smallInputClass} /></label>
          <label className="text-xs">Уклонение % <input type="number" value={form.extra.dodge} onChange={e => set('extra.dodge', +e.target.value)} className={smallInputClass} /></label>
          <label className="text-xs">Контрудар % <input type="number" value={form.extra.counter} onChange={e => set('extra.counter', +e.target.value)} className={smallInputClass} /></label>
          <label className="text-xs">Полный блок % <input type="number" value={form.extra.fullBlock} onChange={e => set('extra.fullBlock', +e.target.value)} className={smallInputClass} /></label>
        </div>
      </details>

      <label className="text-xs mt-2 block">Стоимость (🥇, пусто = авто) <input type="number" value={form.cost} onChange={e => set('cost', e.target.value ? +e.target.value : '')} className={smallInputClass} style={{width:'100%'}} /></label>

      <div className="flex gap-4 justify-center mt-4">
        <Button variant="success" size="sm" onClick={() => onSave(form)}>Сохранить</Button>
        <Button variant="danger" size="sm" onClick={onClose}>Отмена</Button>
      </div>
    </Modal>
  );
}
