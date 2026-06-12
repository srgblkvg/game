import ItemIcon from '../../components/ui/ItemIcon';

interface Props {
  groupedRecipes: Record<string, any[]>;
  openCategories: Record<string, boolean>;
  activeRecipe: any;
  onToggleCategory: (cat: string) => void;
  onRecipeClick: (recipe: any) => void;
}

export default function RecipeList({ groupedRecipes, openCategories, activeRecipe, onToggleCategory, onRecipeClick }: Props) {
  if (Object.keys(groupedRecipes).length === 0) return null;

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
                  className={`flex items-center justify-between py-1 px-2 border-b border-[var(--color-border-light)] text-xs cursor-pointer ${
                    activeRecipe?.id === recipe.id ? 'bg-[var(--color-bg-card-hover)]' : 'bg-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {recipe.result ? (
                      <ItemIcon
                        color={recipe.result.rarity_color || '#555'}
                        image={recipe.result.image}
                        name={recipe.result.name || '?'}
                        size="sm"
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
    </div>
  );
}
