import { useState, useEffect } from 'react';
import {
    fetchAdminCraftItems, createCraftItem, updateCraftItem, deleteCraftItem,
    fetchAdminRecipes, createRecipe, updateRecipe, deleteRecipe,
    fetchAdminItems,
    fetchRecipeCategories, createRecipeCategory, updateRecipeCategory, deleteRecipeCategory,
    fetchUpgradeChances, createUpgradeChance, updateUpgradeChance, deleteUpgradeChance
} from '../../api/admin';

const rarityNames = ['Серый', 'Белый', 'Зелёный', 'Синий', 'Фиолетовый', 'Жёлтый', 'Красный'];

export default function AdminCraft() {
    const [tab, setTab] = useState<'resources' | 'recipes' | 'categories' | 'upgrade'>('resources');
    const [message, setMessage] = useState('');

    // ----- Resources -----
    const [resources, setResources] = useState<any[]>([]);
    const [editingResource, setEditingResource] = useState<any>(null);
    const [newResource, setNewResource] = useState({ name: '', rarity: 0, description: '', type: 'craft', image: '' });

    const loadResources = async () => {
        try { setResources(await fetchAdminCraftItems()); } catch (e) { console.error(e); }
    };

    useEffect(() => { loadResources(); }, []);

    const handleCreateResource = async () => {
        try {
            await createCraftItem(newResource);
            setMessage('Ресурс создан');
            loadResources();
            setNewResource({ name: '', rarity: 0, description: '', type: 'craft', image: '' });
        } catch (e: any) { setMessage(e.message); }
    };

    const handleUpdateResource = async () => {
        try {
            await updateCraftItem(editingResource.id, editingResource);
            setMessage('Ресурс обновлён');
            setEditingResource(null);
            loadResources();
        } catch (e: any) { setMessage(e.message); }
    };

    const handleDeleteResource = async (id: number) => {
        if (!confirm('Удалить ресурс?')) return;
        try { await deleteCraftItem(id); loadResources(); } catch (e: any) { setMessage(e.message); }
    };

    // ----- Recipes -----
    const [recipes, setRecipes] = useState<any[]>([]);
    const [editingRecipe, setEditingRecipe] = useState<any>(null);
    const [newRecipe, setNewRecipe] = useState({
        name: '',
        description: '',
        money_cost: 0,
        result_type: '',
        result_id: 0,
        success_chance: 100,
        category_id: null as number | null,
        ingredients: [] as { craft_item_id: number; quantity: number }[],
    });
    const [items, setItems] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);

    const loadRecipes = async () => {
        try { setRecipes(await fetchAdminRecipes()); } catch (e) { console.error(e); }
    };

    useEffect(() => { loadRecipes(); }, []);

    useEffect(() => {
        fetchAdminItems().then(setItems).catch(console.error);
        fetchRecipeCategories().then(setCategories).catch(console.error);
    }, []);

    const handleCreateRecipe = async () => {
        try {
            await createRecipe(newRecipe);
            setMessage('Рецепт создан');
            loadRecipes();
            setNewRecipe({ name: '', description: '', money_cost: 0, result_type: '', result_id: 0, success_chance: 100, category_id: null, ingredients: [] });
        } catch (e: any) { setMessage(e.message); }
    };

    const handleUpdateRecipe = async () => {
        try {
            await updateRecipe(editingRecipe.id, editingRecipe);
            setMessage('Рецепт обновлён');
            setEditingRecipe(null);
            loadRecipes();
        } catch (e: any) { setMessage(e.message); }
    };

    const handleDeleteRecipe = async (id: number) => {
        if (!confirm('Удалить рецепт?')) return;
        try { await deleteRecipe(id); loadRecipes(); } catch (e: any) { setMessage(e.message); }
    };

    // ----- Categories -----
    const [editingCategory, setEditingCategory] = useState<any>(null);
    const [newCategory, setNewCategory] = useState({ name: '', sort_order: 0 });

    const loadCategories = async () => {
        try { setCategories(await fetchRecipeCategories()); } catch (e) { console.error(e); }
    };

    useEffect(() => { loadCategories(); }, []);

    const handleCreateCategory = async () => {
        try {
            await createRecipeCategory(newCategory);
            setMessage('Категория создана');
            loadCategories();
            setNewCategory({ name: '', sort_order: 0 });
        } catch (e: any) { setMessage(e.message); }
    };

    const handleUpdateCategory = async () => {
        try {
            await updateRecipeCategory(editingCategory.id, editingCategory);
            setMessage('Категория обновлена');
            setEditingCategory(null);
            loadCategories();
        } catch (e: any) { setMessage(e.message); }
    };

    const handleDeleteCategory = async (id: number) => {
        if (!confirm('Удалить категорию?')) return;
        try { await deleteRecipeCategory(id); loadCategories(); } catch (e: any) { setMessage(e.message); }
    };

    // ----- Upgrade chances -----
    const [upgradeChances, setUpgradeChances] = useState<any[]>([]);
    const [editingChance, setEditingChance] = useState<any>(null);
    const [newChance, setNewChance] = useState({ level: 1, chance: 100, money_cost: 100 });

    const loadUpgradeChances = async () => {
        try { setUpgradeChances(await fetchUpgradeChances()); } catch (e) { console.error(e); }
    };

    useEffect(() => { loadUpgradeChances(); }, []);

    const handleCreateChance = async () => {
        try {
            await createUpgradeChance(newChance);
            setMessage('Шанс улучшения создан');
            loadUpgradeChances();
            setNewChance({ level: 1, chance: 100, money_cost: 100 });
        } catch (e: any) { setMessage(e.message); }
    };

    const handleUpdateChance = async () => {
        try {
            await updateUpgradeChance(editingChance.level, editingChance);
            setMessage('Шанс улучшения обновлён');
            setEditingChance(null);
            loadUpgradeChances();
        } catch (e: any) { setMessage(e.message); }
    };

    const handleDeleteChance = async (level: number) => {
        if (!confirm('Удалить шанс улучшения?')) return;
        try { await deleteUpgradeChance(level); loadUpgradeChances(); } catch (e: any) { setMessage(e.message); }
    };

    // ---------- helpers ----------
    const addIngredient = (setter: any) => {
        setter((prev: any) => ({
            ...prev,
            ingredients: [...prev.ingredients, { craft_item_id: 0, quantity: 1 }],
        }));
    };

    const removeIngredient = (index: number, setter: any) => {
        setter((prev: any) => ({
            ...prev,
            ingredients: prev.ingredients.filter((_: any, i: number) => i !== index),
        }));
    };

    // ---------- forms ----------
    const renderResourceForm = (resource: any, setter: any, submitText: string, onSubmit: () => void) => (
        <div>
            <input placeholder="Название" value={resource.name} onChange={e => setter({ ...resource, name: e.target.value })} style={inputStyle} />
            <select value={resource.rarity} onChange={e => setter({ ...resource, rarity: +e.target.value })} style={inputStyle}>
                {rarityNames.map((name, i) => <option key={i} value={i}>{name}</option>)}
            </select>
            <input placeholder="Описание" value={resource.description} onChange={e => setter({ ...resource, description: e.target.value })} style={inputStyle} />
            <label>Тип:
                <input list="type-list" value={resource.type || ''} onChange={e => setter({ ...resource, type: e.target.value })} style={inputStyle} />
                <datalist id="type-list">
                    {[...new Set(resources.map(r => r.type).filter(Boolean))].map(t => <option key={t} value={t} />)}
                </datalist>
            </label>
            <label>Изображение:
                <input placeholder="имя файла в public" value={resource.image || ''} onChange={e => setter({ ...resource, image: e.target.value })} style={inputStyle} />
            </label>
            <button onClick={onSubmit} style={{ ...buttonStyle, background: '#2ecc71' }}>{submitText}</button>
        </div>
    );

    const renderRecipeForm = (recipe: any, setter: any, submitText: string, onSubmit: () => void) => (
        <div>
            <input placeholder="Название" value={recipe.name} onChange={e => setter({ ...recipe, name: e.target.value })} style={inputStyle} />
            <input placeholder="Описание" value={recipe.description} onChange={e => setter({ ...recipe, description: e.target.value })} style={inputStyle} />
            <label>Стоимость (монет)
                <input type="number" value={recipe.money_cost} onChange={e => setter({ ...recipe, money_cost: +e.target.value })} style={inputStyle} />
            </label>
            <label>Категория:
                <select value={recipe.category_id || ''} onChange={e => setter({ ...recipe, category_id: e.target.value ? +e.target.value : null })} style={inputStyle}>
                    <option value="">Без категории</option>
                    {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </label>
            <label>Тип результата:
                <select value={recipe.result_type} onChange={e => setter({ ...recipe, result_type: e.target.value, result_id: 0 })} style={inputStyle}>
                    <option value="">Без результата</option>
                    <option value="item">Предмет (снаряжение)</option>
                    <option value="craft_item">Ресурс</option>
                </select>
            </label>
            {recipe.result_type === 'item' && (
                <select value={recipe.result_id} onChange={e => setter({ ...recipe, result_id: +e.target.value })} style={inputStyle}>
                    <option value={0}>Выберите предмет</option>
                    {items.map((it: any) => <option key={it.id} value={it.id}>{it.name}</option>)}
                </select>
            )}
            {recipe.result_type === 'craft_item' && (
                <select value={recipe.result_id} onChange={e => setter({ ...recipe, result_id: +e.target.value })} style={inputStyle}>
                    <option value={0}>Выберите ресурс</option>
                    {resources.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
            )}
            <label>Шанс создания (%):
                <input type="number" min="0" max="100" value={recipe.success_chance ?? 100} onChange={e => setter({ ...recipe, success_chance: +e.target.value })} style={{ width: '80px', ...inputStyle }} />
            </label>
            <div>
                <strong>Ингредиенты:</strong>
                {recipe.ingredients.map((ing: any, idx: number) => (
                    <div key={idx} style={{ display: 'flex', gap: '0.5rem', marginTop: '0.3rem' }}>
                        <select value={ing.craft_item_id} onChange={e => {
                            const newIngs = [...recipe.ingredients];
                            newIngs[idx].craft_item_id = +e.target.value;
                            setter({ ...recipe, ingredients: newIngs });
                        }} style={inputStyle}>
                            <option value={0}>Выберите ресурс</option>
                            {resources.map(r => <option key={r.id} value={r.id}>{r.name} ({rarityNames[r.rarity]})</option>)}
                        </select>
                        <input type="number" placeholder="Кол-во" value={ing.quantity} onChange={e => {
                            const newIngs = [...recipe.ingredients];
                            newIngs[idx].quantity = +e.target.value;
                            setter({ ...recipe, ingredients: newIngs });
                        }} style={{ width: '80px', ...inputStyle }} />
                        <button onClick={() => removeIngredient(idx, setter)} style={{ background: '#c0392b', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>×</button>
                    </div>
                ))}
                <button onClick={() => addIngredient(setter)} style={{ marginTop: '0.3rem', background: '#3498db', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>+ Добавить ингредиент</button>
            </div>
            <button onClick={onSubmit} style={{ marginTop: '1rem', ...buttonStyle, background: '#2ecc71' }}>{submitText}</button>
        </div>
    );

    const renderCategoryForm = (category: any, setter: any, submitText: string, onSubmit: () => void) => (
        <div>
            <input placeholder="Название" value={category.name} onChange={e => setter({ ...category, name: e.target.value })} style={inputStyle} />
            <label>Порядок сортировки:
                <input type="number" value={category.sort_order} onChange={e => setter({ ...category, sort_order: +e.target.value })} style={inputStyle} />
            </label>
            <button onClick={onSubmit} style={{ ...buttonStyle, background: '#2ecc71' }}>{submitText}</button>
        </div>
    );

    const renderChanceForm = (chance: any, setter: any, submitText: string, onSubmit: () => void) => (
        <div>
            <label>Уровень:
                <input type="number" value={chance.level} onChange={e => setter({ ...chance, level: +e.target.value })} style={inputStyle} />
            </label>
            <label>Шанс (%):
                <input type="number" value={chance.chance} onChange={e => setter({ ...chance, chance: +e.target.value })} style={inputStyle} />
            </label>
            <label>Стоимость:
                <input type="number" value={chance.money_cost} onChange={e => setter({ ...chance, money_cost: +e.target.value })} style={inputStyle} />
            </label>
            <button onClick={onSubmit} style={{ ...buttonStyle, background: '#2ecc71' }}>{submitText}</button>
        </div>
    );

    return (
        <div>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                {(['resources', 'recipes', 'categories', 'upgrade'] as const).map(t => (
                    <button key={t} onClick={() => setTab(t)} style={{
                        padding: '0.5rem 1rem', background: tab === t ? '#e63946' : '#555',
                        border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer',
                        fontWeight: tab === t ? 'bold' : 'normal',
                    }}>
                        {t === 'resources' ? 'Ресурсы' : t === 'recipes' ? 'Рецепты' : t === 'categories' ? 'Категории' : 'Шансы улучшения'}
                    </button>
                ))}
            </div>

            {/* Ресурсы */}
            {tab === 'resources' && (
                <>
                    <div style={{ marginBottom: '1rem', background: '#1e1e30', padding: '1rem', borderRadius: '8px' }}>
                        <h3>{editingResource ? 'Редактировать ресурс' : 'Добавить ресурс'}</h3>
                        {editingResource
                            ? renderResourceForm(editingResource, setEditingResource, 'Сохранить', handleUpdateResource)
                            : renderResourceForm(newResource, setNewResource, 'Создать', handleCreateResource)
                        }
                        {editingResource && (
                            <button onClick={() => setEditingResource(null)} style={{ ...buttonStyle, background: '#e74c3c', marginLeft: '0.5rem' }}>Отмена</button>
                        )}
                    </div>
                    <div style={{ background: '#1e1e30', padding: '1rem', borderRadius: '8px' }}>
                        <h3>Все ресурсы</h3>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead><tr style={{ borderBottom: '1px solid #444' }}><th>ID</th><th>Название</th><th>Редкость</th><th>Тип</th><th>Описание</th><th>Действия</th></tr></thead>
                            <tbody>
                                {resources.map((r: any) => (
                                    <tr key={r.id} style={{ borderBottom: '1px solid #333' }}>
                                        <td>{r.id}</td><td>{r.name}</td><td style={{ color: ['#888', '#ccc', '#2ecc71', '#3498db', '#9b59b6', '#f1c40f', '#e74c3c'][r.rarity] }}>{rarityNames[r.rarity]}</td><td>{r.type || 'craft'}</td><td>{r.description}</td>
                                        <td>
                                            <button onClick={() => setEditingResource(r)} style={{ ...buttonStyle, background: '#3498db', marginRight: '0.3rem' }}>Ред.</button>
                                            <button onClick={() => handleDeleteResource(r.id)} style={{ ...buttonStyle, background: '#c0392b' }}>Удалить</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* Рецепты */}
            {tab === 'recipes' && (
                <>
                    <div style={{ marginBottom: '1rem', background: '#1e1e30', padding: '1rem', borderRadius: '8px' }}>
                        <h3>{editingRecipe ? 'Редактировать рецепт' : 'Добавить рецепт'}</h3>
                        {editingRecipe
                            ? renderRecipeForm(editingRecipe, setEditingRecipe, 'Сохранить', handleUpdateRecipe)
                            : renderRecipeForm(newRecipe, setNewRecipe, 'Создать', handleCreateRecipe)
                        }
                        {editingRecipe && (
                            <button onClick={() => setEditingRecipe(null)} style={{ ...buttonStyle, background: '#e74c3c', marginLeft: '0.5rem' }}>Отмена</button>
                        )}
                    </div>
                    <div style={{ background: '#1e1e30', padding: '1rem', borderRadius: '8px' }}>
                        <h3>Все рецепты</h3>
                        {recipes.map((recipe: any) => (
                            <div key={recipe.id} style={{ borderBottom: '1px solid #333', padding: '0.5rem 0' }}>
                                <strong>{recipe.name}</strong> (стоимость: {recipe.money_cost})<br />
                                <small>{recipe.description}</small>
                                <div>Ингредиенты: {recipe.ingredients.map((i: any) => `${i.name} x${i.quantity}`).join(', ') || 'нет'}</div>
                                {recipe.result && (
                                    <div>Результат: {recipe.result.name} ({rarityNames[recipe.result.rarity]})</div>
                                )}
                                <div>Категория: {recipe.category?.name || '—'}</div>
                                <div>Шанс: {recipe.success_chance ?? 100}%</div>
                                <button onClick={() => setEditingRecipe(recipe)} style={{ ...buttonStyle, background: '#3498db', marginRight: '0.3rem' }}>Ред.</button>
                                <button onClick={() => handleDeleteRecipe(recipe.id)} style={{ ...buttonStyle, background: '#c0392b' }}>Удалить</button>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* Категории */}
            {tab === 'categories' && (
                <>
                    <div style={{ marginBottom: '1rem', background: '#1e1e30', padding: '1rem', borderRadius: '8px' }}>
                        <h3>{editingCategory ? 'Редактировать категорию' : 'Добавить категорию'}</h3>
                        {editingCategory
                            ? renderCategoryForm(editingCategory, setEditingCategory, 'Сохранить', handleUpdateCategory)
                            : renderCategoryForm(newCategory, setNewCategory, 'Создать', handleCreateCategory)
                        }
                        {editingCategory && (
                            <button onClick={() => setEditingCategory(null)} style={{ ...buttonStyle, background: '#e74c3c', marginLeft: '0.5rem' }}>Отмена</button>
                        )}
                    </div>
                    <div style={{ background: '#1e1e30', padding: '1rem', borderRadius: '8px' }}>
                        <h3>Все категории</h3>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead><tr style={{ borderBottom: '1px solid #444' }}><th>ID</th><th>Название</th><th>Порядок</th><th>Действия</th></tr></thead>
                            <tbody>
                                {categories.map((c: any) => (
                                    <tr key={c.id} style={{ borderBottom: '1px solid #333' }}>
                                        <td>{c.id}</td><td>{c.name}</td><td>{c.sort_order}</td>
                                        <td>
                                            <button onClick={() => setEditingCategory(c)} style={{ ...buttonStyle, background: '#3498db', marginRight: '0.3rem' }}>Ред.</button>
                                            <button onClick={() => handleDeleteCategory(c.id)} style={{ ...buttonStyle, background: '#c0392b' }}>Удалить</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* Шансы улучшения */}
            {tab === 'upgrade' && (
                <>
                    <div style={{ marginBottom: '1rem', background: '#1e1e30', padding: '1rem', borderRadius: '8px' }}>
                        <h3>{editingChance ? 'Редактировать шанс' : 'Добавить шанс'}</h3>
                        {editingChance
                            ? renderChanceForm(editingChance, setEditingChance, 'Сохранить', handleUpdateChance)
                            : renderChanceForm(newChance, setNewChance, 'Создать', handleCreateChance)
                        }
                        {editingChance && (
                            <button onClick={() => setEditingChance(null)} style={{ ...buttonStyle, background: '#e74c3c', marginLeft: '0.5rem' }}>Отмена</button>
                        )}
                    </div>
                    <div style={{ background: '#1e1e30', padding: '1rem', borderRadius: '8px' }}>
                        <h3>Все шансы улучшения</h3>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead><tr style={{ borderBottom: '1px solid #444' }}><th>Уровень</th><th>Шанс (%)</th><th>Стоимость</th><th>Действия</th></tr></thead>
                            <tbody>
                                {upgradeChances.map((uc: any) => (
                                    <tr key={uc.level} style={{ borderBottom: '1px solid #333' }}>
                                        <td>{uc.level}</td><td>{uc.chance}</td><td>{uc.money_cost}</td>
                                        <td>
                                            <button onClick={() => setEditingChance(uc)} style={{ ...buttonStyle, background: '#3498db', marginRight: '0.3rem' }}>Ред.</button>
                                            <button onClick={() => handleDeleteChance(uc.level)} style={{ ...buttonStyle, background: '#c0392b' }}>Удалить</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
            {message && <div style={{ marginTop: '1rem', background: '#2a2a3e', padding: '0.5rem', borderRadius: '4px' }}>{message}</div>}
        </div>
    );
}

const inputStyle: React.CSSProperties = { width: '100%', padding: '0.3rem', marginBottom: '0.5rem', background: '#333', border: '1px solid #555', borderRadius: '4px', color: '#fff' };
const buttonStyle: React.CSSProperties = { border: 'none', color: '#fff', padding: '0.3rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' };