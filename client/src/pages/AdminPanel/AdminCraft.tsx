// client/src/pages/AdminPanel/AdminCraft.tsx
import { useState, useEffect } from 'react';
import {
    fetchAdminCraftItems, createCraftItem, updateCraftItem, deleteCraftItem,
    fetchAdminRecipes, createRecipe, updateRecipe, deleteRecipe,
    fetchAdminItems,
    fetchRecipeCategories, createRecipeCategory, updateRecipeCategory, deleteRecipeCategory,
    fetchUpgradeChances, createUpgradeChance, updateUpgradeChance, deleteUpgradeChance
} from '../../api/admin';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';

interface Rarity { id: number; name: string; display_name: string; color: string; }

const inputClass = 'w-full p-1.5 mb-1 bg-[var(--color-bg-input)] border border-[var(--color-border-light)] rounded text-[var(--color-text-primary)] text-sm';
const selectClass = 'w-full p-1.5 mb-1 bg-[var(--color-bg-input)] border border-[var(--color-border-light)] rounded text-[var(--color-text-primary)] text-sm';

const tabs = [
    { key: 'resources', label: 'Ресурсы' },
    { key: 'recipes', label: 'Рецепты' },
    { key: 'categories', label: 'Категории' },
    { key: 'upgrade', label: 'Шансы улучшения' },
] as const;
type Tab = typeof tabs[number]['key'];

export default function AdminCraft() {
    const [tab, setTab] = useState<Tab>('resources');
    const [message, setMessage] = useState('');
    const [rarities, setRarities] = useState<Rarity[]>([]);
    const [items, setItems] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);

    // Resources
    const [resources, setResources] = useState<any[]>([]);
    const [editingResource, setEditingResource] = useState<any>(null);
    const [newResource, setNewResource] = useState({ name: '', rarity_id: 0, description: '', type: 'craft', image: '' });

    // Recipes
    const [recipes, setRecipes] = useState<any[]>([]);
    const [editingRecipe, setEditingRecipe] = useState<any>(null);
    const [newRecipe, setNewRecipe] = useState({ name: '', description: '', money_cost: 0, result_type: '', result_id: 0, success_chance: 100, category_id: null as number | null, ingredients: [] as { craft_item_id: number; quantity: number }[] });

    // Categories
    const [editingCategory, setEditingCategory] = useState<any>(null);
    const [newCategory, setNewCategory] = useState({ name: '', sort_order: 0 });

    // Upgrade chances
    const [upgradeChances, setUpgradeChances] = useState<any[]>([]);
    const [editingChance, setEditingChance] = useState<any>(null);
    const [newChance, setNewChance] = useState({ level: 1, chance: 100, money_cost: 100 });

    // Loaders
    useEffect(() => {
        fetchAdminCraftItems().then(setResources).catch(console.error);
        fetch('/api/admin/rarities', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }).then(r => r.json()).then(setRarities).catch(console.error);
        fetchAdminRecipes().then(setRecipes).catch(console.error);
        fetchAdminItems().then(setItems).catch(console.error);
        fetchRecipeCategories().then(setCategories).catch(console.error);
        fetchUpgradeChances().then(setUpgradeChances).catch(console.error);
    }, []);

    // Handlers
    const handleCreateResource = async () => {
        try { await createCraftItem(newResource); setMessage('Ресурс создан'); setResources(await fetchAdminCraftItems()); setNewResource({ name: '', rarity_id: 0, description: '', type: 'craft', image: '' }); }
        catch (e: any) { setMessage(e.message); }
    };
    const handleUpdateResource = async () => {
        try { await updateCraftItem(editingResource.id, editingResource); setMessage('Ресурс обновлён'); setEditingResource(null); setResources(await fetchAdminCraftItems()); }
        catch (e: any) { setMessage(e.message); }
    };
    const handleDeleteResource = async (id: number) => {
        if (!confirm('Удалить ресурс?')) return;
        try { await deleteCraftItem(id); setResources(await fetchAdminCraftItems()); } catch (e: any) { setMessage(e.message); }
    };

    const handleCreateRecipe = async () => {
        try { await createRecipe(newRecipe); setMessage('Рецепт создан'); setRecipes(await fetchAdminRecipes()); setNewRecipe({ name: '', description: '', money_cost: 0, result_type: '', result_id: 0, success_chance: 100, category_id: null, ingredients: [] }); }
        catch (e: any) { setMessage(e.message); }
    };
    const handleUpdateRecipe = async () => {
        try { await updateRecipe(editingRecipe.id, editingRecipe); setMessage('Рецепт обновлён'); setEditingRecipe(null); setRecipes(await fetchAdminRecipes()); }
        catch (e: any) { setMessage(e.message); }
    };
    const handleDeleteRecipe = async (id: number) => {
        if (!confirm('Удалить рецепт?')) return;
        try { await deleteRecipe(id); setRecipes(await fetchAdminRecipes()); } catch (e: any) { setMessage(e.message); }
    };

    const handleCreateCategory = async () => {
        try { await createRecipeCategory(newCategory); setMessage('Категория создана'); setCategories(await fetchRecipeCategories()); setNewCategory({ name: '', sort_order: 0 }); }
        catch (e: any) { setMessage(e.message); }
    };
    const handleUpdateCategory = async () => {
        try { await updateRecipeCategory(editingCategory.id, editingCategory); setMessage('Категория обновлена'); setEditingCategory(null); setCategories(await fetchRecipeCategories()); }
        catch (e: any) { setMessage(e.message); }
    };
    const handleDeleteCategory = async (id: number) => {
        if (!confirm('Удалить категорию?')) return;
        try { await deleteRecipeCategory(id); setCategories(await fetchRecipeCategories()); } catch (e: any) { setMessage(e.message); }
    };

    const handleCreateChance = async () => {
        try { await createUpgradeChance(newChance); setMessage('Шанс улучшения создан'); setUpgradeChances(await fetchUpgradeChances()); setNewChance({ level: 1, chance: 100, money_cost: 100 }); }
        catch (e: any) { setMessage(e.message); }
    };
    const handleUpdateChance = async () => {
        try { await updateUpgradeChance(editingChance.level, editingChance); setMessage('Шанс улучшения обновлён'); setEditingChance(null); setUpgradeChances(await fetchUpgradeChances()); }
        catch (e: any) { setMessage(e.message); }
    };
    const handleDeleteChance = async (level: number) => {
        if (!confirm('Удалить шанс улучшения?')) return;
        try { await deleteUpgradeChance(level); setUpgradeChances(await fetchUpgradeChances()); } catch (e: any) { setMessage(e.message); }
    };

    const addIngredient = (setter: any) => setter((prev: any) => ({ ...prev, ingredients: [...prev.ingredients, { craft_item_id: 0, quantity: 1 }] }));
    const removeIngredient = (index: number, setter: any) => setter((prev: any) => ({ ...prev, ingredients: prev.ingredients.filter((_: any, i: number) => i !== index) }));

    const renderResourceForm = (res: any, setter: any, submitText: string, onSubmit: () => void) => (
        <div>
            <input placeholder="Название" value={res.name} onChange={e => setter({ ...res, name: e.target.value })} className={inputClass} />
            <select value={res.rarity_id} onChange={e => setter({ ...res, rarity_id: +e.target.value })} className={selectClass}>
                {rarities.map(r => <option key={r.id} value={r.id} style={{ color: r.color }}>{r.display_name}</option>)}
            </select>
            <input placeholder="Описание" value={res.description} onChange={e => setter({ ...res, description: e.target.value })} className={inputClass} />
            <label className="text-sm">Тип:
                <input list="type-list" value={res.type || ''} onChange={e => setter({ ...res, type: e.target.value })} className={inputClass} />
                <datalist id="type-list">{[...new Set(resources.map(r => r.type).filter(Boolean))].map(t => <option key={t} value={t} />)}</datalist>
            </label>
            <label className="text-sm">Изображение:
                <input placeholder="имя файла в public" value={res.image || ''} onChange={e => setter({ ...res, image: e.target.value })} className={inputClass} />
            </label>
            <Button variant="success" size="sm" onClick={onSubmit}>{submitText}</Button>
        </div>
    );

    const renderRecipeForm = (recipe: any, setter: any, submitText: string, onSubmit: () => void) => (
        <div>
            <input placeholder="Название" value={recipe.name} onChange={e => setter({ ...recipe, name: e.target.value })} className={inputClass} />
            <input placeholder="Описание" value={recipe.description} onChange={e => setter({ ...recipe, description: e.target.value })} className={inputClass} />
            <label className="text-sm">Стоимость (монет)
                <input type="number" value={recipe.money_cost} onChange={e => setter({ ...recipe, money_cost: +e.target.value })} className={inputClass} />
            </label>
            <label className="text-sm">Категория:
                <select value={recipe.category_id || ''} onChange={e => setter({ ...recipe, category_id: e.target.value ? +e.target.value : null })} className={selectClass}>
                    <option value="">Без категории</option>
                    {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </label>
            <label className="text-sm">Тип результата:
                <select value={recipe.result_type} onChange={e => setter({ ...recipe, result_type: e.target.value, result_id: 0 })} className={selectClass}>
                    <option value="">Без результата</option>
                    <option value="item">Предмет (снаряжение)</option>
                    <option value="craft_item">Ресурс</option>
                </select>
            </label>
            {recipe.result_type === 'item' && (
                <select value={recipe.result_id} onChange={e => setter({ ...recipe, result_id: +e.target.value })} className={selectClass}>
                    <option value={0}>Выберите предмет</option>
                    {items.map((it: any) => <option key={it.id} value={it.id}>{it.name}</option>)}
                </select>
            )}
            {recipe.result_type === 'craft_item' && (
                <select value={recipe.result_id} onChange={e => setter({ ...recipe, result_id: +e.target.value })} className={selectClass}>
                    <option value={0}>Выберите ресурс</option>
                    {resources.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
            )}
            <label className="text-sm">Шанс создания (%):
                <input type="number" min="0" max="100" value={recipe.success_chance ?? 100} onChange={e => setter({ ...recipe, success_chance: +e.target.value })} className={`${inputClass} w-20`} />
            </label>
            <div className="mt-2">
                <strong className="text-sm">Ингредиенты:</strong>
                {recipe.ingredients.map((ing: any, idx: number) => (
                    <div key={idx} className="flex gap-2 mt-1">
                        <select value={ing.craft_item_id} onChange={e => { const n = [...recipe.ingredients]; n[idx].craft_item_id = +e.target.value; setter({ ...recipe, ingredients: n }); }} className={selectClass}>
                            <option value={0}>Выберите ресурс</option>
                            {resources.map(r => <option key={r.id} value={r.id}>{r.name} ({r.rarity_display})</option>)}
                        </select>
                        <input type="number" placeholder="Кол-во" value={ing.quantity} onChange={e => { const n = [...recipe.ingredients]; n[idx].quantity = +e.target.value; setter({ ...recipe, ingredients: n }); }} className={`${inputClass} w-20`} />
                        <Button variant="danger" size="xs" onClick={() => removeIngredient(idx, setter)}>×</Button>
                    </div>
                ))}
                <Button size="xs" className="mt-1" onClick={() => addIngredient(setter)}>+ Добавить ингредиент</Button>
            </div>
            <Button variant="success" size="sm" className="mt-3" onClick={onSubmit}>{submitText}</Button>
        </div>
    );

    return (
        <div>
            <div className="flex gap-2 mb-4 overflow-x-auto hide-scrollbar">
                {tabs.map(t => (
                    <Button key={t.key} variant={tab === t.key ? 'danger' : 'secondary'} size="sm" onClick={() => setTab(t.key)} className="whitespace-nowrap">{t.label}</Button>
                ))}
            </div>

            {tab === 'resources' && (
                <>
                    <Card className="mb-4">
                        <h3 className="font-bold mb-2">{editingResource ? 'Редактировать ресурс' : 'Добавить ресурс'}</h3>
                        {editingResource
                            ? renderResourceForm(editingResource, setEditingResource, 'Сохранить', handleUpdateResource)
                            : renderResourceForm(newResource, setNewResource, 'Создать', handleCreateResource)}
                        {editingResource && <Button variant="danger" size="sm" className="ml-2 mt-2" onClick={() => setEditingResource(null)}>Отмена</Button>}
                    </Card>
                    <Card>
                        <h3 className="font-bold mb-2">Все ресурсы</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-sm">
                                <thead><tr className="border-b border-[var(--color-border-default)]"><th className="text-left p-1">ID</th><th className="text-left p-1">Название</th><th className="text-left p-1">Редкость</th><th className="text-left p-1">Тип</th><th className="text-left p-1">Описание</th><th className="text-left p-1">Действия</th></tr></thead>
                                <tbody>
                                    {resources.map((r: any) => (
                                        <tr key={r.id} className="border-b border-[var(--color-border-light)]">
                                            <td className="p-1">{r.id}</td><td className="p-1">{r.name}</td><td className="p-1" style={{ color: r.rarity_color }}>{r.rarity_display}</td><td className="p-1">{r.type || 'craft'}</td><td className="p-1">{r.description}</td>
                                            <td className="p-1">
                                                <Button variant="primary" size="xs" className="mr-1" onClick={() => setEditingResource(r)}>Ред.</Button>
                                                <Button variant="danger" size="xs" onClick={() => handleDeleteResource(r.id)}>Удалить</Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </>
            )}

            {tab === 'recipes' && (
                <>
                    <Card className="mb-4">
                        <h3 className="font-bold mb-2">{editingRecipe ? 'Редактировать рецепт' : 'Добавить рецепт'}</h3>
                        {editingRecipe
                            ? renderRecipeForm(editingRecipe, setEditingRecipe, 'Сохранить', handleUpdateRecipe)
                            : renderRecipeForm(newRecipe, setNewRecipe, 'Создать', handleCreateRecipe)}
                        {editingRecipe && <Button variant="danger" size="sm" className="ml-2 mt-2" onClick={() => setEditingRecipe(null)}>Отмена</Button>}
                    </Card>
                    <Card>
                        <h3 className="font-bold mb-2">Все рецепты</h3>
                        {recipes.map((recipe: any) => (
                            <div key={recipe.id} className="border-b border-[var(--color-border-light)] py-2 text-sm">
                                <strong>{recipe.name}</strong> (стоимость: {recipe.money_cost})<br />
                                <small>{recipe.description}</small>
                                <div>Ингредиенты: {recipe.ingredients.map((i: any) => `${i.name} x${i.quantity}`).join(', ') || 'нет'}</div>
                                {recipe.result && <div>Результат: {recipe.result.name} ({recipe.result.rarity_display})</div>}
                                <div>Категория: {recipe.category?.name || '—'}</div>
                                <div>Шанс: {recipe.success_chance ?? 100}%</div>
                                <Button variant="primary" size="xs" className="mr-1 mt-1" onClick={() => setEditingRecipe(recipe)}>Ред.</Button>
                                <Button variant="danger" size="xs" className="mt-1" onClick={() => handleDeleteRecipe(recipe.id)}>Удалить</Button>
                            </div>
                        ))}
                    </Card>
                </>
            )}

            {tab === 'categories' && (
                <>
                    <Card className="mb-4">
                        <h3 className="font-bold mb-2">{editingCategory ? 'Редактировать категорию' : 'Добавить категорию'}</h3>
                        <div>
                            <input placeholder="Название" value={editingCategory ? editingCategory.name : newCategory.name}
                                onChange={e => editingCategory ? setEditingCategory({ ...editingCategory, name: e.target.value }) : setNewCategory({ ...newCategory, name: e.target.value })} className={inputClass} />
                            <label className="text-sm">Порядок сортировки:
                                <input type="number" value={editingCategory ? editingCategory.sort_order : newCategory.sort_order}
                                    onChange={e => editingCategory ? setEditingCategory({ ...editingCategory, sort_order: +e.target.value }) : setNewCategory({ ...newCategory, sort_order: +e.target.value })} className={inputClass} />
                            </label>
                            <Button variant="success" size="sm" onClick={editingCategory ? handleUpdateCategory : handleCreateCategory}>
                                {editingCategory ? 'Сохранить' : 'Создать'}
                            </Button>
                            {editingCategory && <Button variant="danger" size="sm" className="ml-2" onClick={() => setEditingCategory(null)}>Отмена</Button>}
                        </div>
                    </Card>
                    <Card>
                        <h3 className="font-bold mb-2">Все категории</h3>
                        <table className="w-full border-collapse text-sm">
                            <thead><tr className="border-b border-[var(--color-border-default)]"><th className="text-left p-1">ID</th><th className="text-left p-1">Название</th><th className="text-left p-1">Порядок</th><th className="text-left p-1">Действия</th></tr></thead>
                            <tbody>
                                {categories.map((c: any) => (
                                    <tr key={c.id} className="border-b border-[var(--color-border-light)]">
                                        <td className="p-1">{c.id}</td><td className="p-1">{c.name}</td><td className="p-1">{c.sort_order}</td>
                                        <td className="p-1">
                                            <Button variant="primary" size="xs" className="mr-1" onClick={() => setEditingCategory(c)}>Ред.</Button>
                                            <Button variant="danger" size="xs" onClick={() => handleDeleteCategory(c.id)}>Удалить</Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Card>
                </>
            )}

            {tab === 'upgrade' && (
                <>
                    <Card className="mb-4">
                        <h3 className="font-bold mb-2">{editingChance ? 'Редактировать шанс' : 'Добавить шанс'}</h3>
                        <div>
                            <label className="text-sm">Уровень:
                                <input type="number" value={editingChance ? editingChance.level : newChance.level}
                                    onChange={e => editingChance ? setEditingChance({ ...editingChance, level: +e.target.value }) : setNewChance({ ...newChance, level: +e.target.value })} className={inputClass} />
                            </label>
                            <label className="text-sm">Шанс (%):
                                <input type="number" value={editingChance ? editingChance.chance : newChance.chance}
                                    onChange={e => editingChance ? setEditingChance({ ...editingChance, chance: +e.target.value }) : setNewChance({ ...newChance, chance: +e.target.value })} className={inputClass} />
                            </label>
                            <label className="text-sm">Стоимость:
                                <input type="number" value={editingChance ? editingChance.money_cost : newChance.money_cost}
                                    onChange={e => editingChance ? setEditingChance({ ...editingChance, money_cost: +e.target.value }) : setNewChance({ ...newChance, money_cost: +e.target.value })} className={inputClass} />
                            </label>
                            <Button variant="success" size="sm" onClick={editingChance ? handleUpdateChance : handleCreateChance}>
                                {editingChance ? 'Сохранить' : 'Создать'}
                            </Button>
                            {editingChance && <Button variant="danger" size="sm" className="ml-2" onClick={() => setEditingChance(null)}>Отмена</Button>}
                        </div>
                    </Card>
                    <Card>
                        <h3 className="font-bold mb-2">Все шансы улучшения</h3>
                        <table className="w-full border-collapse text-sm">
                            <thead><tr className="border-b border-[var(--color-border-default)]"><th className="text-left p-1">Уровень</th><th className="text-left p-1">Шанс (%)</th><th className="text-left p-1">Стоимость</th><th className="text-left p-1">Действия</th></tr></thead>
                            <tbody>
                                {upgradeChances.map((uc: any) => (
                                    <tr key={uc.level} className="border-b border-[var(--color-border-light)]">
                                        <td className="p-1">{uc.level}</td><td className="p-1">{uc.chance}</td><td className="p-1">{uc.money_cost}</td>
                                        <td className="p-1">
                                            <Button variant="primary" size="xs" className="mr-1" onClick={() => setEditingChance(uc)}>Ред.</Button>
                                            <Button variant="danger" size="xs" onClick={() => handleDeleteChance(uc.level)}>Удалить</Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Card>
                </>
            )}

            {message && <div className="mt-4 p-3 bg-[var(--color-bg-card)] rounded text-sm">{message}</div>}
        </div>
    );
}
