import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../contexts/GameContext';
import { useAuth } from '../contexts/AuthContext';
import { useGlobalChat } from '../contexts/ChatContext';
import { salvageItems } from '../api';
import { fetchRecipes, upgradeItem, fetchUpgradeInfo } from '../api/craft';
import Inventory from '../components/Inventory';
import LongPressItemSlot from '../components/LongPressItemSlot';
import LongPressResourceSlot from '../components/LongPressResourceSlot';
import ItemTooltip from '../components/ItemTooltip';
import { getRarityColor, isCraftItem } from '../utils/itemUtils';
import { formatMoney } from '../utils/money';

export default function CraftPage() {
    const { user } = useAuth();
    const { character, setCharacter } = useGame();
    const navigate = useNavigate();
    const [craftSlots, setCraftSlots] = useState<(any | null)[]>(Array(9).fill(null));
    const [materialUsage, setMaterialUsage] = useState<Record<string, number>>({});
    const [tooltipData, setTooltipData] = useState<{ item: any; x: number; y: number } | null>(null);
    const [recipes, setRecipes] = useState<any[]>([]);
    const [crafting, setCrafting] = useState(false);
    const [upgradeInfo, setUpgradeInfo] = useState<{
        item: any; stone: any; nextLevel: number; chance: number; cost: number;
    } | null>(null);
    const { sendItemLink } = useGlobalChat();

    // Категории: всегда начинаем с двух открытых
    const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
        'Материалы': true,
        'Улучшения': true,
    });

    useEffect(() => {
        const handleGlobalClick = () => setTooltipData(null);
        document.addEventListener('click', handleGlobalClick);
        return () => document.removeEventListener('click', handleGlobalClick);
    }, []);

    useEffect(() => {
        if (!user || !character) {
            navigate('/login');
        }
    }, [user, character, navigate]);

    // Fallback-функция должна быть объявлена ДО эффекта
    const getRecipeCategoryFallback = (recipe: any): string => {
        if (recipe.result_type === 'craft_item' && recipe.result?.itemType === 'upgrade') {
            return 'Улучшения';
        }
        return 'Материалы';
    };

    useEffect(() => {
        fetchRecipes()
            .then(data => {
                setRecipes(data);
                // Обновляем открытые категории на основе полученных рецептов
                const cats: Record<string, boolean> = {
                    'Материалы': true,
                    'Улучшения': true,
                };
                data.forEach((r: any) => {
                    const cat = r.category?.name || getRecipeCategoryFallback(r);
                    cats[cat] = true; // гарантируем, что категория будет открыта
                });
                setOpenCategories(prev => ({ ...cats, ...prev }));
            })
            .catch(console.error);
    }, []);

    if (!user || !character) return null;

    const getOriginalCraftItemCount = (itemId: string | number): number => {
        const original = character.inventory.find(
            (i: any) => isCraftItem(i) && i.id == itemId
        );
        return original && isCraftItem(original) ? original.count : 0;
    };

    const displayInventory = useMemo(() => {
        const slotIds = new Set(craftSlots.filter(s => s !== null && !isCraftItem(s)).map(s => s.id));
        return character.inventory
            .filter(item => !slotIds.has(item.id))
            .map(item => {
                if (isCraftItem(item)) {
                    const used = materialUsage[item.id] || 0;
                    const remaining = item.count - used;
                    return remaining > 0 ? { ...item, count: remaining } : null;
                }
                return item;
            })
            .filter(Boolean);
    }, [character.inventory, craftSlots, materialUsage]);

    useEffect(() => {
        const nonEmptySlots = craftSlots.filter(s => s !== null);
        if (nonEmptySlots.length !== 2) {
            setUpgradeInfo(null);
            return;
        }
        const items = nonEmptySlots.filter(s => !isCraftItem(s));
        const stones = nonEmptySlots.filter(s => isCraftItem(s) && s.itemType === 'upgrade');
        if (items.length !== 1 || stones.length !== 1) {
            setUpgradeInfo(null);
            return;
        }
        const item = items[0];
        const stone = stones[0];
        if (item.rarity !== stone.rarity) {
            setUpgradeInfo(null);
            return;
        }
        const nextLevel = (item.upgradeLevel || 0) + 1;
        fetchUpgradeInfo(nextLevel)
            .then((data: any) => {
                setUpgradeInfo({
                    item,
                    stone,
                    nextLevel,
                    chance: data.chance,
                    cost: data.money_cost,
                });
            })
            .catch(() => {
                setUpgradeInfo(null);
            });
    }, [craftSlots]);

    const handleLongPress = useCallback(
        (item: any, e: React.TouchEvent | React.MouseEvent) => {
            if (item) {
                const touch = (e as React.TouchEvent).touches?.[0] ?? e;
                setTooltipData({ item, x: touch.clientX, y: touch.clientY });
            }
        },
        []
    );

    const handleItemClick = useCallback((item: any) => {
        if (isCraftItem(item)) return;
        setTooltipData(null);
        const freeSlotIndex = craftSlots.findIndex(slot => slot === null);
        if (freeSlotIndex === -1) {
            alert('Все слоты заняты');
            return;
        }
        setCraftSlots(prev => {
            const newSlots = [...prev];
            newSlots[freeSlotIndex] = item;
            return newSlots;
        });
    }, [craftSlots]);

    const handleMaterialClick = useCallback((mat: any) => {
        if (!isCraftItem(mat)) return;
        setTooltipData(null);
        const freeSlotIndex = craftSlots.findIndex(slot => slot === null);
        if (freeSlotIndex === -1) {
            alert('Все слоты заняты');
            return;
        }
        const used = materialUsage[mat.id] || 0;
        const totalAvailable = getOriginalCraftItemCount(mat.id);
        if (used >= totalAvailable) {
            alert('Нет доступных ресурсов этого типа');
            return;
        }
        setMaterialUsage(prev => ({ ...prev, [mat.id]: (prev[mat.id] || 0) + 1 }));
        setCraftSlots(prev => {
            const newSlots = [...prev];
            newSlots[freeSlotIndex] = { ...mat, count: 1 };
            return newSlots;
        });
    }, [craftSlots, materialUsage, character.inventory]);

    const handleSlotClick = (index: number, e: React.MouseEvent) => {
        const item = craftSlots[index];
        if (!item) return;
        setTooltipData(null);
        if (e.shiftKey && !isCraftItem(item)) {
            e.stopPropagation();
            sendItemLink(item.id);
            return;
        }
        if (isCraftItem(item)) {
            setMaterialUsage(prev => {
                const newUsage = { ...prev };
                newUsage[item.id] = (newUsage[item.id] || 0) - 1;
                if (newUsage[item.id] <= 0) delete newUsage[item.id];
                return newUsage;
            });
        }
        setCraftSlots(prev => {
            const newSlots = [...prev];
            newSlots[index] = null;
            return newSlots;
        });
    };

    const handleDropOnSlot = (index: number, e: React.DragEvent) => {
        e.preventDefault();
        setTooltipData(null);
        const itemId = e.dataTransfer.getData('text/plain');
        if (!itemId) return;
        const numericItemId = parseFloat(itemId);
        let item = displayInventory.find((i: any) => i.id === numericItemId);
        if (!item) {
            item = character.inventory.find(
                (i: any) => i.id == numericItemId && isCraftItem(i)
            );
        }
        if (!item) return;

        if (isCraftItem(item)) {
            const used = materialUsage[item.id] || 0;
            const totalAvailable = getOriginalCraftItemCount(item.id);
            if (used >= totalAvailable) return;
            setMaterialUsage(prev => ({ ...prev, [item.id]: (prev[item.id] || 0) + 1 }));
            setCraftSlots(prev => {
                const newSlots = [...prev];
                newSlots[index] = { ...item, count: 1 };
                return newSlots;
            });
        } else {
            setCraftSlots(prev => {
                const newSlots = [...prev];
                newSlots[index] = item;
                return newSlots;
            });
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDragStartFromSlot = (e: React.DragEvent, item: any) => {
        e.dataTransfer.setData('text/plain', item.id);
        e.dataTransfer.effectAllowed = 'move';
        setTooltipData(null);
    };

    const handleDropOnInventory = (e: React.DragEvent) => {
        e.preventDefault();
        const itemId = e.dataTransfer.getData('text/plain');
        if (!itemId) return;
        const numericItemId = parseFloat(itemId);
        const slotIndex = craftSlots.findIndex(slot => slot && slot.id == numericItemId);
        if (slotIndex === -1) return;
        const item = craftSlots[slotIndex];
        if (!item) return;

        if (isCraftItem(item)) {
            setMaterialUsage(prev => {
                const newUsage = { ...prev };
                newUsage[item.id] = (newUsage[item.id] || 0) - 1;
                if (newUsage[item.id] <= 0) delete newUsage[item.id];
                return newUsage;
            });
        }
        setCraftSlots(prev => {
            const newSlots = [...prev];
            newSlots[slotIndex] = null;
            return newSlots;
        });
    };

    const handleRecipeClick = (recipe: any) => {
        setCraftSlots(Array(9).fill(null));
        setMaterialUsage({});

        const canCraft = recipe.ingredients.every((ing: any) => {
            const totalAvailable = getOriginalCraftItemCount(ing.craft_item_id);
            return totalAvailable >= ing.quantity;
        });

        if (!canCraft) {
            alert('Недостаточно необходимых ресурсов');
            return;
        }

        const newSlots: (any | null)[] = [];
        const newUsage: Record<string, number> = {};

        recipe.ingredients.forEach((ing: any) => {
            for (let i = 0; i < ing.quantity; i++) {
                newSlots.push({
                    type: 'craft_item',
                    id: ing.craft_item_id,
                    name: ing.name,
                    rarity: ing.rarity,
                    count: 1,
                    itemType: ing.itemType || 'craft',
                    image: ing.image || null,
                });
            }
        });

        while (newSlots.length < 9) {
            newSlots.push(null);
        }

        setCraftSlots(newSlots);

        recipe.ingredients.forEach((ing: any) => {
            newUsage[ing.craft_item_id] = ing.quantity;
        });
        setMaterialUsage(newUsage);
    };

    const activeRecipe = useMemo(() => {
        if (craftSlots.every(s => s === null)) return null;
        for (const recipe of recipes) {
            const recipeIngredientMap = new Map<number, number>();
            recipe.ingredients.forEach((ing: any) => {
                recipeIngredientMap.set(ing.craft_item_id, ing.quantity);
            });

            const slotIngredientMap = new Map<number, number>();
            for (const slot of craftSlots) {
                if (slot && isCraftItem(slot)) {
                    const id = Number(slot.id);
                    slotIngredientMap.set(id, (slotIngredientMap.get(id) || 0) + 1);
                }
            }

            let match = true;
            for (const [id, qty] of slotIngredientMap) {
                if ((recipeIngredientMap.get(id) || 0) !== qty) {
                    match = false;
                    break;
                }
            }
            if (match && recipeIngredientMap.size === slotIngredientMap.size) {
                return recipe;
            }
        }
        return null;
    }, [craftSlots, recipes]);

    const handleCreate = async () => {
        if (!activeRecipe) return;
        setCrafting(true);
        try {
            const res = await fetch('/api/craft/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
                body: JSON.stringify({
                    recipe_id: activeRecipe.id,
                    slots: craftSlots.filter(Boolean),
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Ошибка сервера');
            setCharacter({ ...character, inventory: data.inventory, money: data.moneyAfter });
            setCraftSlots(Array(9).fill(null));
            setMaterialUsage({});
            alert(data.message || (data.success ? 'Предмет создан!' : 'Неудача!'));
        } catch (err: any) {
            alert(err.message);
        } finally {
            setCrafting(false);
        }
    };

    const handleUpgrade = async () => {
        if (!upgradeInfo) return;
        setCrafting(true);
        try {
            const slots = craftSlots.filter(Boolean);
            const data = await upgradeItem(slots);
            setCharacter({ ...character, inventory: data.inventory, money: data.moneyAfter });
            setCraftSlots(Array(9).fill(null));
            setMaterialUsage({});
            alert(data.message || (data.success ? 'Предмет улучшен!' : 'Неудача!'));
        } catch (err: any) {
            alert(err.message);
        } finally {
            setCrafting(false);
        }
    };

    const hasItemsInSlots = craftSlots.some(s => s !== null);

    // Получение названия категории для рецепта
    const getRecipeCategory = (recipe: any): string => {
        return recipe.category?.name || getRecipeCategoryFallback(recipe);
    };

    // Группировка рецептов
    const groupedRecipes = useMemo(() => {
        const groups: Record<string, any[]> = {};
        recipes.forEach(r => {
            const cat = getRecipeCategory(r);
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(r);
        });
        for (const key of Object.keys(groups)) {
            groups[key].sort((a: any, b: any) => {
                const rarityA = a.result?.rarity ?? 0;
                const rarityB = b.result?.rarity ?? 0;
                return rarityA - rarityB;
            });
        }
        return groups;
    }, [recipes]);

    const handleMouseEnterSlot = (e: React.MouseEvent, item: any) => {
        setTooltipData({ item, x: e.clientX, y: e.clientY });
    };
    const handleMouseMoveSlot = (e: React.MouseEvent) => {
        if (tooltipData) setTooltipData(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
    };
    const handleMouseLeaveSlot = () => setTooltipData(null);

    return (
        <div style={{ padding: '1rem', color: '#eee', minHeight: '100vh' }}>
            <button onClick={() => navigate('/')} style={{ background: '#555', color: '#fff', padding: '0.4rem 1rem', borderRadius: '6px', cursor: 'pointer', marginBottom: '1rem' }}>
                ← Назад
            </button>
            <h2>🔨 Крафт</h2>

            {/* Список рецептов по категориям */}
            {Object.keys(groupedRecipes).length > 0 && (
                <div style={{
                    marginBottom: '1rem',
                    maxHeight: '400px',
                    overflowY: 'auto',
                    background: '#1e1e30',
                    borderRadius: '8px',
                    padding: '0.5rem',
                }}>
                    {Object.keys(groupedRecipes).map(cat => (
                        <div key={cat}>
                            <div
                                onClick={() => setOpenCategories(prev => ({ ...prev, [cat]: !prev[cat] }))}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                    fontSize: '0.9rem',
                                    padding: '0.3rem 0',
                                    userSelect: 'none',
                                }}
                            >
                                <span>{openCategories[cat] ? '−' : '+'}</span>
                                <span>{cat}</span>
                            </div>
                            {openCategories[cat] && (
                                <div style={{ marginLeft: '1rem' }}>
                                    {groupedRecipes[cat].map((recipe: any) => (
                                        <div
                                            key={recipe.id}
                                            onClick={() => handleRecipeClick(recipe)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '0.2rem 0.5rem',
                                                borderBottom: '1px solid #333',
                                                fontSize: '0.85rem',
                                                cursor: 'pointer',
                                                background: activeRecipe?.id === recipe.id ? '#2a2a4e' : 'transparent',
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                {recipe.result ? (
                                                    <div style={{
                                                        width: '24px',
                                                        height: '24px',
                                                        border: `1px solid ${getRarityColor(recipe.result.rarity)}`,
                                                        borderRadius: '4px',
                                                        background: recipe.result.image
                                                            ? `url(/${recipe.result.image}) center / contain no-repeat`
                                                            : getRarityColor(recipe.result.rarity),
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '0.55rem',
                                                        fontWeight: 'bold',
                                                        color: '#fff',
                                                        textShadow: '0 0 2px #000',
                                                        flexShrink: 0,
                                                    }}>
                                                        {!recipe.result.image && (recipe.result.name?.substring(0, 2) || '?')}
                                                    </div>
                                                ) : (
                                                    <div style={{
                                                        width: '24px',
                                                        height: '24px',
                                                        border: '1px solid #555',
                                                        borderRadius: '4px',
                                                        background: '#333',
                                                        flexShrink: 0,
                                                    }} />
                                                )}
                                                <div>
                                                    <strong>{recipe.name}</strong>
                                                    <div style={{ fontSize: '0.7rem', color: '#aaa' }}>
                                                        {recipe.ingredients.map((ing: any) => `${ing.name} x${ing.quantity}`).join(', ')}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                {/* Крафт-блок */}
                <div style={{
                    flex: '0 0 auto',
                    width: '100%',
                    maxWidth: '256px',
                    background: '#1e1e30',
                    border: '2px solid #555',
                    borderRadius: '12px',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    margin: '0 auto',
                }}>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 44px)',
                        gridTemplateRows: 'repeat(3, 44px)',
                        gap: '4px',
                        justifyContent: 'center',
                    }}>
                        {craftSlots.map((item, index) => (
                            <div key={index}>
                                {item && isCraftItem(item) ? (
                                    <LongPressResourceSlot
                                        item={item}
                                        draggable
                                        onDragStart={(e) => handleDragStartFromSlot(e, item)}
                                        onClick={(e) => handleSlotClick(index, e)}
                                        onDrop={(e) => handleDropOnSlot(index, e)}
                                        onDragOver={handleDragOver}
                                        onMouseEnter={(e) => item && handleMouseEnterSlot(e, item)}
                                        onMouseMove={handleMouseMoveSlot}
                                        onMouseLeave={handleMouseLeaveSlot}
                                        onLongPress={handleLongPress}
                                    />
                                ) : (
                                    <LongPressItemSlot
                                        item={item}
                                        draggable={!!item}
                                        onDragStart={(e) => item && handleDragStartFromSlot(e, item)}
                                        onClick={(e) => handleSlotClick(index, e)}
                                        onDrop={(e) => handleDropOnSlot(index, e)}
                                        onDragOver={handleDragOver}
                                        onMouseEnter={(e) => item && handleMouseEnterSlot(e, item)}
                                        onMouseMove={handleMouseMoveSlot}
                                        onMouseLeave={handleMouseLeaveSlot}
                                        onLongPress={handleLongPress}
                                    />
                                )}
                            </div>
                        ))}
                    </div>

                    {activeRecipe && (
                        <div style={{
                            marginTop: '0.5rem',
                            padding: '0.5rem',
                            background: '#2a2a3e',
                            borderRadius: '8px',
                            fontSize: '0.85rem',
                        }}>
                            <div>Вы можете создать: <strong style={{ color: getRarityColor(activeRecipe.result?.rarity ?? 0) }}>{activeRecipe.result?.name}</strong></div>
                            <div>Шанс создания: {activeRecipe.success_chance ?? 100}%</div>
                            <div>Стоимость: {formatMoney(activeRecipe.money_cost)}</div>
                        </div>
                    )}

                    {upgradeInfo && (
                        <div style={{
                            marginTop: '0.5rem',
                            padding: '0.5rem',
                            background: '#2a2a3e',
                            borderRadius: '8px',
                            fontSize: '0.85rem',
                        }}>
                            <div>Улучшение до уровня +{upgradeInfo.nextLevel}</div>
                            <div>Шанс: {upgradeInfo.chance}%</div>
                            <div>Стоимость: {formatMoney(upgradeInfo.cost)}</div>
                            <div style={{ color: '#e74c3c', fontWeight: 'bold', marginTop: '0.3rem' }}>
                                При неудаче предмет будет разрушен!!!
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
                        <button
                            onClick={handleCreate}
                            disabled={!activeRecipe || crafting}
                            style={{
                                padding: '0.5rem 2rem',
                                background: activeRecipe ? '#2ecc71' : '#555',
                                color: activeRecipe ? '#fff' : '#888',
                                border: 'none',
                                borderRadius: '6px',
                                fontWeight: 'bold',
                                cursor: activeRecipe ? 'pointer' : 'not-allowed',
                                width: '100%',
                                maxWidth: '200px',
                            }}
                        >
                            {crafting ? 'Создание...' : 'Создать'}
                        </button>
                        <button
                            onClick={handleUpgrade}
                            disabled={!upgradeInfo || crafting}
                            style={{
                                padding: '0.5rem 2rem',
                                background: upgradeInfo ? '#f39c12' : '#555',
                                color: upgradeInfo ? '#fff' : '#888',
                                border: 'none',
                                borderRadius: '6px',
                                fontWeight: 'bold',
                                cursor: upgradeInfo ? 'pointer' : 'not-allowed',
                                width: '100%',
                                maxWidth: '200px',
                            }}
                        >
                            {crafting ? 'Улучшение...' : 'Улучшить'}
                        </button>
                        <button
                            onClick={async () => {
                                const itemsToSalvage = craftSlots.filter(s => s && !isCraftItem(s));
                                if (itemsToSalvage.length === 0) return;
                                try {
                                    const result = await salvageItems(itemsToSalvage.map(s => s.id));
                                    setCharacter({ ...character, inventory: result.inventory });
                                    setCraftSlots(prev => prev.map(s => (s && !isCraftItem(s) && itemsToSalvage.some(i => i.id === s.id) ? null : s)));
                                    setMaterialUsage({});
                                } catch (err: any) {
                                    alert(err.message);
                                }
                            }}
                            disabled={!hasItemsInSlots}
                            style={{
                                padding: '0.5rem 2rem',
                                background: hasItemsInSlots ? '#c0392b' : '#555',
                                color: hasItemsInSlots ? '#fff' : '#888',
                                border: 'none',
                                borderRadius: '6px',
                                fontWeight: 'bold',
                                cursor: hasItemsInSlots ? 'pointer' : 'not-allowed',
                                width: '100%',
                                maxWidth: '200px',
                            }}
                        >
                            Разобрать
                        </button>
                    </div>
                </div>

                {/* Инвентарь */}
                <div style={{ flex: 1, minWidth: '300px' }} onDragOver={handleDragOver} onDrop={handleDropOnInventory}>
                    <Inventory
                        onItemClick={handleItemClick}
                        onMaterialClick={handleMaterialClick}
                        inventoryOverride={displayInventory}
                        onDragStartItem={() => setTooltipData(null)}
                    />
                </div>
            </div>

            {tooltipData && <ItemTooltip item={tooltipData.item} position={{ x: tooltipData.x, y: tooltipData.y }} />}
        </div>
    );
}