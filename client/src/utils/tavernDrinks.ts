export type TavernDrink = {
    category?: string | null;
    [key: string]: unknown;
};

export function groupTavernDrinks(drinks: TavernDrink[]) {
    const categories: Record<string, TavernDrink[]> = {};
    for (const drink of drinks) {
        const category = drink.category || 'Прочее';
        (categories[category] ||= []).push(drink);
    }

    return Object.entries(categories).sort(([a], [b]) =>
        a === 'Универсальные' ? -1 : b === 'Универсальные' ? 1 : a.localeCompare(b),
    );
}
