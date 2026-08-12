import Button from '../../../components/ui/Button';

interface Props {
  recipe: any;
  onEdit: () => void;
  onDelete: () => void;
}

export default function RecipeListItem({ recipe, onEdit, onDelete }: Props) {
  return (
    <div className="border-b border-[var(--color-border-light)] py-2 text-sm">
      <strong>{recipe.name}</strong> (стоимость: {recipe.money_cost})<br />
      <small>{recipe.description}</small>
      <div>Ингредиенты: {recipe.ingredients.map((i: any) => `${i.name} x${i.quantity}`).join(', ') || 'нет'}</div>
      {recipe.result && <div>Результат: {recipe.result.name} ({recipe.result.rarity_display})</div>}
      <div>Категория: {recipe.category?.name || '—'}</div>
      <div>Шанс: {recipe.success_chance ?? 100}%</div>
      <Button variant="primary" size="md" className="mr-1 mt-1" onClick={onEdit}>Ред.</Button>
      <Button variant="danger" size="md" className="mt-1" onClick={onDelete}>Удалить</Button>
    </div>
  );
}
