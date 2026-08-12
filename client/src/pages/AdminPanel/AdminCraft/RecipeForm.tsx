import Button from '../../../components/ui/Button';
import { inputClass, selectClass } from '../../../utils/formStyles';

interface Props {
  recipe: any;
  onChange: (recipe: any) => void;
  onSubmit: () => void;
  submitText: string;
  onCancel?: () => void;
  categories: any[];
  items: any[];
  resources: any[];
}

export default function RecipeForm({ recipe, onChange, onSubmit, submitText, onCancel, categories, items, resources }: Props) {
  const addIngredient = () => onChange({ ...recipe, ingredients: [...recipe.ingredients, { craft_item_id: 0, quantity: 1 }] });
  const removeIngredient = (idx: number) => onChange({ ...recipe, ingredients: recipe.ingredients.filter((_: any, i: number) => i !== idx) });

  return (
    <div>
      <input placeholder="Название" value={recipe.name} onChange={e => onChange({ ...recipe, name: e.target.value })} className={inputClass} />
      <input placeholder="Описание" value={recipe.description} onChange={e => onChange({ ...recipe, description: e.target.value })} className={inputClass} />
      <label className="text-sm">Стоимость (монет)
        <input type="number" value={recipe.money_cost} onChange={e => onChange({ ...recipe, money_cost: +e.target.value })} className={inputClass} />
      </label>
      <label className="text-sm">Категория:
        <select value={recipe.category_id || ''} onChange={e => onChange({ ...recipe, category_id: e.target.value ? +e.target.value : null })} className={selectClass}>
          <option value="">Без категории</option>
          {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <label className="text-sm">Тип результата:
        <select value={recipe.result_type} onChange={e => onChange({ ...recipe, result_type: e.target.value, result_id: 0 })} className={selectClass}>
          <option value="">Без результата</option>
          <option value="item">Предмет (снаряжение)</option>
          <option value="craft_item">Ресурс</option>
        </select>
      </label>
      {recipe.result_type === 'item' && (
        <select value={recipe.result_id} onChange={e => onChange({ ...recipe, result_id: +e.target.value })} className={selectClass}>
          <option value={0}>Выберите предмет</option>
          {items.map((it: any) => <option key={it.id} value={it.id}>{it.name}</option>)}
        </select>
      )}
      {recipe.result_type === 'craft_item' && (
        <select value={recipe.result_id} onChange={e => onChange({ ...recipe, result_id: +e.target.value })} className={selectClass}>
          <option value={0}>Выберите ресурс</option>
          {resources.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      )}
      <label className="text-sm">Шанс создания (%):
        <input type="number" min="0" max="100" value={recipe.success_chance ?? 100} onChange={e => onChange({ ...recipe, success_chance: +e.target.value })} className={`${inputClass} w-20`} />
      </label>
      <div className="mt-2">
        <strong className="text-sm">Ингредиенты:</strong>
        {recipe.ingredients.map((ing: any, idx: number) => (
          <div key={idx} className="flex gap-2 mt-1">
            <select value={ing.craft_item_id} onChange={e => {
              const n = [...recipe.ingredients]; n[idx].craft_item_id = +e.target.value;
              onChange({ ...recipe, ingredients: n });
            }} className={selectClass}>
              <option value={0}>Выберите ресурс</option>
              {resources.map(r => <option key={r.id} value={r.id}>{r.name} ({r.rarity_display})</option>)}
            </select>
            <input type="number" placeholder="Кол-во" value={ing.quantity} onChange={e => {
              const n = [...recipe.ingredients]; n[idx].quantity = +e.target.value;
              onChange({ ...recipe, ingredients: n });
            }} className={`${inputClass} w-20`} />
            <Button variant="danger" size="md" onClick={() => removeIngredient(idx)}>×</Button>
          </div>
        ))}
        <Button size="md" className="mt-1" onClick={addIngredient}>+ Добавить ингредиент</Button>
      </div>
      <Button variant="success" size="md" className="mt-3" onClick={onSubmit}>{submitText}</Button>
      {onCancel && <Button variant="danger" size="md" className="ml-2 mt-3" onClick={onCancel}>Отмена</Button>}
    </div>
  );
}
