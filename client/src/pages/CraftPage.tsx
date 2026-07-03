import PageHeader from '../components/ui/PageHeader';
import { Icon } from "@iconify/react";
// client/src/pages/CraftPage.tsx
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import BackButton from '../components/BackButton';
import { useGame } from '../contexts/GameContext';
import { useAuth } from '../contexts/AuthContext';
import { useGlobalChat } from '../contexts/ChatContext';
import { useAcquire } from '../contexts/AcquireContext';
import { salvageItems } from '../api';
import { fetchCharacter } from '../api/character';
import { getHeaders } from '../api/helpers';
import { fetchRecipes, upgradeItem, fetchUpgradeInfo } from '../api/craft';
import Inventory from '../components/Inventory';
import LongPressItemSlot from '../components/LongPressItemSlot';
import LongPressResourceSlot from '../components/LongPressResourceSlot';
import ItemTooltip from '../components/ItemTooltip';
import { isCraftItem } from '../utils/itemUtils';
import { formatMoney } from '../utils/money';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import RecipeList from './CraftPage/RecipeList';
import CraftPopup from './CraftPage/CraftPopup';

export default function CraftPage() {
  const [actionCard, setActionCard] = useState<any>(null);
  useEffect(() => { fetch('/api/actions', { headers: getHeaders() }).then(r => r.json()).then((cards: any[]) => { const c = cards.find((x: any) => x.path === '/craft'); if (c) setActionCard(c); }).catch(() => {}); }, []);
    const { user } = useAuth();
    const { character, setCharacter } = useGame();
    const navigate = useNavigate();
    const [craftSlots, setCraftSlots] = useState<(any | null)[]>(Array(9).fill(null));
    const [materialUsage, setMaterialUsage] = useState<Record<string, number>>({});
    const [tooltipData, setTooltipData] = useState<{ item: any; x: number; y: number } | null>(null);
    const [recipes, setRecipes] = useState<any[]>([]);
    const [crafting, setCrafting] = useState(false);
    const [craftAnim, setCraftAnim] = useState<{ success: boolean; label: string; acquire?: { item: any; count: number; msg: string }; pendingData?: any } | null>(null);
    const [errorPopup, setErrorPopup] = useState<string | null>(null);
    const { showAcquire } = useAcquire();
    const [upgradeInfo, setUpgradeInfo] = useState<{
        item: any; stone: any; nextLevel: number; chance: number; cost: number;
    } | null>(null);
    const { sendItemLink } = useGlobalChat();

    const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});

    // Инструкция по улучшению
    const [showUpgradeInfo, setShowUpgradeInfo] = useState(false);

    useEffect(() => {
        const handleGlobalClick = () => setTooltipData(null);
        document.addEventListener('click', handleGlobalClick);
        return () => document.removeEventListener('click', handleGlobalClick);
    }, []);

    useEffect(() => {
        if (!user || !character) { navigate('/login'); }
    }, [user, character, navigate]);

    const getRecipeCategoryFallback = (recipe: any): string => {
        if (recipe.result_type === 'craft_item' && recipe.result?.itemType === 'upgrade') return 'Улучшения';
        return 'Материалы';
    };

    useEffect(() => {
        fetchRecipes()
            .then(data => {
                setRecipes(data);
            })
            .catch(console.error);
    }, []);

    if (!user || !character) return null;

    const getOriginalCraftItemCount = (itemId: string | number): number => {
        const original = character.inventory.find((i: any) => isCraftItem(i) && i.id == itemId);
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
        if (nonEmptySlots.length !== 2) { setUpgradeInfo(null); return; }
        const items = nonEmptySlots.filter(s => !isCraftItem(s));
        const stones = nonEmptySlots.filter(s => isCraftItem(s) && s.itemType === 'upgrade');
        if (items.length !== 1 || stones.length !== 1) { setUpgradeInfo(null); return; }
        const item = items[0];
        const stone = stones[0];
        // Камень любой редкости улучшает предмет
        const nextLevel = (item.upgradeLevel || 0) + 1;
        fetchUpgradeInfo(nextLevel, item.rarity_id)
            .then((data: any) => setUpgradeInfo({ item, stone, nextLevel, chance: data.chance, cost: data.money_cost }))
            .catch(() => setUpgradeInfo(null));
    }, [craftSlots]);

    const handleLongPress = useCallback((item: any, e: React.TouchEvent | React.MouseEvent) => {
        if (item) {
            const touch = (e as React.TouchEvent).touches?.[0] ?? e;
            setTooltipData({ item, x: touch.clientX, y: touch.clientY });
        }
    }, []);

    const handleItemClick = useCallback((item: any) => {
        if (isCraftItem(item) && item.itemType !== 'upgrade') return;
        setTooltipData(null);
        const freeSlotIndex = craftSlots.findIndex(slot => slot === null);
        if (freeSlotIndex === -1) { setErrorPopup('Все слоты заняты'); return; }
        if (isCraftItem(item)) {
            const used = materialUsage[item.id] || 0;
            if (used >= getOriginalCraftItemCount(item.id)) { setErrorPopup('Нет доступных ресурсов этого типа'); return; }
            setMaterialUsage(prev => ({ ...prev, [item.id]: (prev[item.id] || 0) + 1 }));
            setCraftSlots(prev => { const n = [...prev]; n[freeSlotIndex] = { ...item, count: 1 }; return n; });
        } else {
            setCraftSlots(prev => { const n = [...prev]; n[freeSlotIndex] = item; return n; });
        }
    }, [craftSlots, materialUsage, character.inventory]);

    const handleMaterialClick = useCallback((mat: any) => {
        if (!isCraftItem(mat)) return;
        setTooltipData(null);
        const freeSlotIndex = craftSlots.findIndex(slot => slot === null);
        if (freeSlotIndex === -1) { setErrorPopup('Все слоты заняты'); return; }
        const used = materialUsage[mat.id] || 0;
        const totalAvailable = getOriginalCraftItemCount(mat.id);
        if (used >= totalAvailable) { setErrorPopup('Нет доступных ресурсов этого типа'); return; }
        setMaterialUsage(prev => ({ ...prev, [mat.id]: (prev[mat.id] || 0) + 1 }));
        setCraftSlots(prev => { const n = [...prev]; n[freeSlotIndex] = { ...mat, count: 1 }; return n; });
    }, [craftSlots, materialUsage, character.inventory]);

    const handleSlotClick = (index: number, e: React.MouseEvent) => {
        const item = craftSlots[index];
        if (!item) return;
        setTooltipData(null);
        if (e.shiftKey) { e.stopPropagation(); sendItemLink(item.id, item); return; }
        if (isCraftItem(item)) {
            setMaterialUsage(prev => { const n = { ...prev }; n[item.id] = (n[item.id] || 0) - 1; if (n[item.id] <= 0) delete n[item.id]; return n; });
        }
        setCraftSlots(prev => { const n = [...prev]; n[index] = null; return n; });
    };

    const handleDropOnSlot = (index: number, e: React.DragEvent) => {
        e.preventDefault(); setTooltipData(null);
        const itemId = e.dataTransfer.getData('text/plain');
        if (!itemId) return;
        const numericItemId = parseFloat(itemId);
        let item = displayInventory.find((i: any) => i.id === numericItemId);
        if (!item) item = character.inventory.find((i: any) => i.id == numericItemId && isCraftItem(i));
        if (!item) return;
        if (isCraftItem(item)) {
            const used = materialUsage[item.id] || 0;
            if (used >= getOriginalCraftItemCount(item.id)) return;
            setMaterialUsage(prev => ({ ...prev, [item.id]: (prev[item.id] || 0) + 1 }));
            setCraftSlots(prev => { const n = [...prev]; n[index] = { ...item, count: 1 }; return n; });
        } else {
            setCraftSlots(prev => { const n = [...prev]; n[index] = item; return n; });
        }
    };

    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
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
            setMaterialUsage(prev => { const n = { ...prev }; n[item.id] = (n[item.id] || 0) - 1; if (n[item.id] <= 0) delete n[item.id]; return n; });
        }
        setCraftSlots(prev => { const n = [...prev]; n[slotIndex] = null; return n; });
    };

    const handleRecipeClick = (recipe: any) => {
        setCraftSlots(Array(9).fill(null));
        setMaterialUsage({});
        const canCraft = recipe.ingredients.every((ing: any) => getOriginalCraftItemCount(ing.craft_item_id) >= ing.quantity);
        if (!canCraft) { setErrorPopup('Недостаточно необходимых ресурсов'); return; }
        const newSlots: (any | null)[] = [];
        const newUsage: Record<string, number> = {};
        recipe.ingredients.forEach((ing: any) => {
            for (let i = 0; i < ing.quantity; i++) {
                newSlots.push({ type: 'craft_item', id: ing.craft_item_id, name: ing.name, rarity_id: ing.rarity_id, rarity_display: ing.rarity_display, rarity_color: ing.rarity_color, count: 1, itemType: ing.itemType || 'craft', image: ing.image || null });
            }
        });
        while (newSlots.length < 9) newSlots.push(null);
        setCraftSlots(newSlots);
        recipe.ingredients.forEach((ing: any) => { newUsage[ing.craft_item_id] = ing.quantity; });
        setMaterialUsage(newUsage);
    };

    const activeRecipe = useMemo(() => {
        if (craftSlots.every(s => s === null)) return null;
        for (const recipe of recipes) {
            const recipeMap = new Map<number, number>();
            recipe.ingredients.forEach((ing: any) => recipeMap.set(ing.craft_item_id, ing.quantity));
            const slotMap = new Map<number, number>();
            for (const slot of craftSlots) {
                if (slot && isCraftItem(slot)) {
                    const id = Number(slot.id);
                    slotMap.set(id, (slotMap.get(id) || 0) + 1);
                }
            }
            let match = true;
            for (const [id, qty] of slotMap) {
                if ((recipeMap.get(id) || 0) !== qty) { match = false; break; }
            }
            if (match && recipeMap.size === slotMap.size) return recipe;
        }
        return null;
    }, [craftSlots, recipes]);

    const handleCreate = async () => {
        if (!activeRecipe) return;
        setCrafting(true);
        try {
            const res = await fetch('/api/craft/execute', {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ recipe_id: activeRecipe.id, slots: craftSlots.filter(Boolean) }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Ошибка сервера');
            setCraftSlots(Array(9).fill(null));
            setMaterialUsage({});
            const itemName = activeRecipe.result?.name || 'Предмет';
            if (data.success) {
                setCraftAnim({ success: true, label: itemName, acquire: { item: activeRecipe.result, count: 1, msg: 'Создано' }, pendingData: data });
            } else {
                setCraftAnim({ success: false, label: itemName, pendingData: data });
            }
        } catch (err: any) {
            setErrorPopup(err.message);
        } finally { setCrafting(false); }
    };

    const handleUpgrade = async () => {
        if (!upgradeInfo) return;
        setCrafting(true);
        try {
            const slots = craftSlots.filter(Boolean);
            const data = await upgradeItem(slots);
            setCraftSlots(Array(9).fill(null));
            setMaterialUsage({});
            const itemName = upgradeInfo.item?.name || 'Предмет';
            if (data.success) {
                setCraftAnim({ success: true, label: `+${upgradeInfo.nextLevel} ${itemName}`, acquire: { item: upgradeInfo.item, count: 1, msg: `Улучшено до +${upgradeInfo.nextLevel}` }, pendingData: data });
            } else {
                setCraftAnim({ success: false, label: itemName, pendingData: data });
            }
        } catch (err: any) {
            setErrorPopup(err.message);
        } finally { setCrafting(false); }
    };

    const hasItemsInSlots = craftSlots.some(s => s !== null);

    const getRecipeCategory = (recipe: any): string => recipe.category?.name || getRecipeCategoryFallback(recipe);

    const groupedRecipes = useMemo(() => {
        const groups: Record<string, any[]> = {};
        recipes.forEach(r => {
            const cat = getRecipeCategory(r);
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(r);
        });
        for (const key of Object.keys(groups)) {
            groups[key].sort((a: any, b: any) => (a.result?.rarity_id ?? 0) - (b.result?.rarity_id ?? 0));
        }
        return groups;
    }, [recipes]);

    const handleMouseEnterSlot = (e: React.MouseEvent, item: any) => setTooltipData({ item, x: e.clientX, y: e.clientY });
    const handleMouseMoveSlot = (e: React.MouseEvent) => {
        if (tooltipData) setTooltipData(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
    };
    const handleMouseLeaveSlot = () => setTooltipData(null);

    return (
        <div className="px-4 py-4 min-h-screen">
            <BackButton />
          {actionCard && <PageHeader title="Ремесло" icon={actionCard.icon} bgImage={actionCard.bg_image} subtitle={actionCard.subtitle} />}
                Создавайте материалы и улучшайте предметы в верстаке. Добывайте ресурсы в PvE, крафтите материалы из трёх предыдущей редкости. Улучшайте снаряжение камнями — с шансом на успех.
            </p>

            {/* Инструкция */}
            <Card className="mb-4">
                <div
                    className="flex items-center justify-between cursor-pointer select-none"
                    onClick={() => setShowUpgradeInfo(!showUpgradeInfo)}
                >
                    <div className="flex items-center gap-2">
                        <span className="text-sm">{showUpgradeInfo ? '▼' : '▶'}</span>
                        <h3 className="font-bold text-sm">🔨 Как работает ремесло</h3>
                    </div>
                </div>
                {showUpgradeInfo && (
                    <div className="mt-3 text-xs text-[var(--color-text-muted)] space-y-3">
                        <div>
                            <h4 className="font-bold text-[var(--color-text-primary)]">📦 Материалы</h4>
                            <ul className="list-disc pl-4 mt-1 space-y-0.5">
                                <li>Материалы добываются с монстров в PvE</li>
                                <li>Для создания материала нужно <b>3 материала предыдущей редкости</b></li>
                                <li>Из одного материала и серебра в верстаке можно создать случайный предмет редкости материала</li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="font-bold text-[var(--color-text-primary)]">💎 Камни улучшения</h4>
                            <ul className="list-disc pl-4 mt-1 space-y-0.5">
                                <li>Камни <b>не создаются</b> в верстаке — только добываются с монстров (5% шанс)</li>
                                <li><span className="text-[var(--color-accent-success)]">Камень любой редкости</span> может улучшить предмет <span className="text-[var(--color-accent-success)]">любой редкости</span></li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="font-bold text-[var(--color-text-primary)]">📋 Как улучшить в верстаке:</h4>
                            <ol className="list-decimal pl-4 mt-1 space-y-0.5">
                                <li>Поместите <b>предмет</b> и <b>камень улучшения</b> в верстак</li>
                                <li>Нажмите <b>«Улучшить»</b></li>
                                <li>+1 уровень предмета даёт <b>+10% к характеристикам</b> предмета</li>
                                <li><b>+1:</b> 100% успех</li>
                                <li><b>+2 до +6:</b> при неудаче разрушается <b>только камень</b></li>
                                <li><b>+7 до +10:</b> <span className="text-[var(--color-accent-danger)]">при неудаче предмет разрушается!</span></li>
                            </ol>
                        </div>

                        <div>
                            <h4 className="font-bold text-[var(--color-text-primary)]">📊 Шансы улучшения:</h4>
                            <ul className="list-disc pl-4 mt-1 space-y-0.5">
                                <li>+1: 100%</li>
                                <li>+2: 90%</li>
                                <li>+3: 75%</li>
                                <li>+4: 60%</li>
                                <li>+5: 40%</li>
                                <li>+6: 20%</li>
                                <li>+7: 10%</li>
                                <li>+8: 5%</li>
                                <li>+9: 3%</li>
                                <li>+10: 1%</li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="font-bold text-[var(--color-text-primary)]">💍 Бижутерия</h4>
                            <p className="mt-1">В бижутерии (амулет, кольца, пояс) <b>1 ед. характеристики не даёт +1% к второстепенным характеристикам</b> (крит, уклонение, блок).</p>
                        </div>
                    </div>
                )}
            </Card>

            {/* Список рецептов */}
            <RecipeList
                groupedRecipes={groupedRecipes}
                openCategories={openCategories}
                activeRecipe={activeRecipe}
                onToggleCategory={(cat) => setOpenCategories(prev => ({ ...prev, [cat]: !prev[cat] }))}
                onRecipeClick={handleRecipeClick}
            />

            <div className="flex gap-8 flex-wrap mt-4">
                {/* Верстак */}
                <div className="flex-shrink-0 w-full max-w-[256px] mx-auto bg-[var(--color-bg-secondary)] border-2 border-[var(--color-border-light)] rounded-xl p-4 flex flex-col gap-2">
                    <h3 className="text-center text-sm font-bold text-[var(--color-text-primary)]">🔨 Верстак</h3>
                    {/* Сетка слотов */}
                    <div className="grid grid-cols-[repeat(3,44px)] grid-rows-[repeat(3,44px)] gap-1 justify-center">
                        {craftSlots.map((item, index) => (
                            <div key={index}>
                                {item && isCraftItem(item) ? (
                                    <LongPressResourceSlot
                                        item={item} draggable
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
                                        item={item} draggable={!!item}
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

                    {/* Инфо о рецепте */}
                    {activeRecipe && (
                        <div className="mt-2 p-2 bg-[var(--color-bg-card)] rounded-lg text-xs">
                            <div>Вы можете создать: <strong className="text-white">{activeRecipe.result?.name}</strong></div>
                            <div>Шанс создания: {activeRecipe.success_chance ?? 100}%</div>
                            <div>Стоимость: {formatMoney(activeRecipe.money_cost)}</div>
                        </div>
                    )}

                    {/* Инфо об улучшении */}
                    {upgradeInfo && (
                        <div className="mt-2 p-2 bg-[var(--color-bg-card)] rounded-lg text-xs">
                            <div>Улучшение до уровня +{upgradeInfo.nextLevel}</div>
                            <div>Шанс: {upgradeInfo.chance}%</div>
                            <div>Стоимость: {formatMoney(upgradeInfo.cost)}</div>
                            {upgradeInfo.nextLevel <= 6 ? (
                                <div className="text-[var(--color-accent-warning)] mt-1">При неудаче разрушится только камень</div>
                            ) : (
                                <div className="text-[var(--color-accent-danger)] font-bold mt-1">ВНИМАНИЕ!!! При неудаче предмет будет разрушен!!!</div>
                            )}
                        </div>
                    )}

                    {/* Кнопки */}
                    <div className="flex flex-col gap-2 items-center mt-2">
                        <Button variant={activeRecipe ? 'success' : 'secondary'} size="md" fullWidth disabled={!activeRecipe || crafting} onClick={handleCreate}>
                            {crafting ? 'Создание...' : 'Создать'}
                        </Button>
                        <Button variant={upgradeInfo ? 'primary' : 'secondary'} size="md" fullWidth disabled={!upgradeInfo || crafting} onClick={handleUpgrade}
                            className={upgradeInfo ? 'bg-[#f39c12]' : ''}>
                            {crafting ? 'Улучшение...' : 'Улучшить'}
                        </Button>
                        <Button variant="danger" size="md" fullWidth disabled={!hasItemsInSlots} onClick={async () => {
                            const itemsToSalvage = craftSlots.filter(s => s && !isCraftItem(s));
                            const stonesToDisassemble = craftSlots.filter(s => s && isCraftItem(s) && s.itemType === 'upgrade');
                            if (itemsToSalvage.length === 0 && stonesToDisassemble.length === 0) return;

                            try {
                                // Разбор предметов
                                if (itemsToSalvage.length > 0) {
                                    const result = await salvageItems(itemsToSalvage.map(s => s.id));
                                    setCharacter({ ...character, inventory: result.inventory });
                                    showAcquire({ name: 'Разбор', rarity_id: 0 }, itemsToSalvage.length, 'Предметы разобраны');
                                }
                                // Разбор камней
                                for (const stone of stonesToDisassemble) {
                                    const res = await fetch('/api/craft/disassemble', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
                                        body: JSON.stringify({ itemId: stone.id }),
                                    });
                                    const data = await res.json();
                                    if (res.ok) {
                                        const fresh = await fetchCharacter();
                                        setCharacter(fresh);
                                    } else {
                                        setErrorPopup(data.error || 'Ошибка');
                                    }
                                }
                                setCraftSlots(prev => prev.map(s => {
                                    if (!s) return null;
                                    if (!isCraftItem(s) && itemsToSalvage.some(i => i.id === s.id)) return null;
                                    if (isCraftItem(s) && s.itemType === 'upgrade' && stonesToDisassemble.some(i => i.id === s.id)) return null;
                                    return s;
                                }));
                                setMaterialUsage({});
                            } catch (err: any) { setErrorPopup(err.message); }
                        }}>
                            Разобрать
                        </Button>
                    </div>
                </div>

                {/* Инвентарь */}
                <div className="flex-1 min-w-[300px]" onDragOver={handleDragOver} onDrop={handleDropOnInventory}>
                    <Inventory
                        collapsible={false}
                        onItemClick={handleItemClick}
                        onMaterialClick={handleMaterialClick}
                        inventoryOverride={displayInventory}
                        onDragStartItem={() => setTooltipData(null)}
                    />
                </div>
            </div>

            {tooltipData && <ItemTooltip item={tooltipData.item} position={{ x: tooltipData.x, y: tooltipData.y }} />}

            {/* Попап крафта с анимацией */}
            {craftAnim && (
                <CraftPopup result={craftAnim} onDone={() => {
                    if (craftAnim.pendingData) {
                        setCharacter({ ...character, inventory: craftAnim.pendingData.inventory, money: craftAnim.pendingData.moneyAfter });
                    }
                    if (craftAnim.acquire) showAcquire(craftAnim.acquire.item, craftAnim.acquire.count, craftAnim.acquire.msg);
                    setCraftAnim(null);
                }} />
            )}

            {/* Попап ошибки */}
            {errorPopup && (
                <div className="fixed inset-0 z-[1100] flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/50" onClick={() => setErrorPopup(null)} />
                    <div className="relative bg-[var(--color-bg-card)] border border-[var(--color-accent-danger)] rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl text-center">
                        <p className="text-sm text-[var(--color-accent-danger)] mb-4">{errorPopup}</p>
                        <Button variant="secondary" size="md" onClick={() => setErrorPopup(null)}>OK</Button>
                    </div>
                </div>
            )}
        </div>
    );
}
