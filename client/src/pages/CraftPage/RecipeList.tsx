import { useState } from 'react';
import ItemIcon from '../../components/ui/ItemIcon';
import ItemTooltip from '../../components/ItemTooltip';

interface Props {
  groupedRecipes: Record<string, any[]>;
  openCategories: Record<string, boolean>;
  activeRecipe: any;
  onToggleCategory: (cat: string) => void;
  onRecipeClick: (recipe: any) => void;
}

export default function RecipeList({ groupedRecipes, openCategories, activeRecipe, onToggleCategory, onRecipeClick }: Props) {
  const [tooltip, setTooltip] = useState<{ item: any; x: number; y: number } | null>(null);

  if (Object.keys(groupedRecipes).length === 0) return null;

  const handleMouseEnter = (e: React.MouseEvent, recipe: any) => {
    const rtype = recipe.result_type;
    if (recipe.result && rtype !== 'random_item' && rtype !== 'craft_item') {
      setTooltip({ item: recipe.result, x: e.clientX, y: e.clientY });
    }
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (tooltip) setTooltip(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
  };
  const handleMouseLeave = () => setTooltip(null);

  return (
    <div className="mb-4 max-h-[400px] overflow-y-auto bg-[var(--color-bg-secondary)] rounded-lg p-2">
      <h3 className="font-bold text-sm mb-2 px-1">Рецепты</h3>
      {Object.keys(groupedRecipes).map(cat => (
        <div key={cat}>
          <div
            onClick={() => onToggleCategory(cat)}
            className="flex items-center gap-2 cursor-pointer font-bold text-sm py-1 select-none"
          >
            <span>{openCategories[cat] ? '−' : '+'}</span>
            <span>{cat}</span>
          </div>
          {openCategories[cat] && (
            <div className="ml-4">
              {groupedRecipes[cat].map((recipe: any) => (
                <div
                  key={recipe.id}
                  onClick={() => onRecipeClick(recipe)}
                  onMouseEnter={(e) => handleMouseEnter(e, recipe)}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={handleMouseLeave}
                  className={`flex items-center justify-between py-1 px-2 border-b border-[var(--color-border-light)] text-xs cursor-pointer ${
                    activeRecipe?.id === recipe.id ? 'bg-[var(--color-bg-card-hover)]' : 'bg-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {recipe.result ? (
                      <ItemIcon
                        color={recipe.result.rarity_color || '#555'}
                        image={recipe.result.image}
                        name={recipe.result_type === 'random_item' ? '?' : (recipe.result.name || '?')}
                        size="md"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded border border-[var(--color-border-light)] bg-[var(--color-bg-input)] flex-shrink-0" />
                    )}
                    <div>
                      <strong>{recipe.name}</strong>
                      <div className="text-[0.65rem] text-[var(--color-text-muted)]">
                        {recipe.ingredients.map((ing: any) => `${ing.name} x${ing.quantity}`).join(', ')}
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-[0.65rem]">
                    <span className={recipe.success_chance < 100 ? 'text-[var(--color-accent-warning)]' : 'text-[var(--color-accent-success)]'}>
                      {recipe.success_chance ?? 100}%
                    </span>
                    <span className="text-[var(--color-text-muted)] ml-1">{recipe.money_cost} серебра</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      {tooltip && <ItemTooltip item={tooltip.item} position={{ x: tooltip.x, y: tooltip.y }} onDismiss={() => setTooltip(null)} />}
    </div>
  );
}
