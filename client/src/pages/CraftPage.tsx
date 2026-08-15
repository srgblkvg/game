import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/ui/PageHeader';
import BackButton from '../components/BackButton';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import ItemIcon from '../components/ui/ItemIcon';
import ItemTooltip from '../components/ItemTooltip';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { useToast } from '../contexts/ToastContext';
import { salvageItems } from '../api';

import { getHeaders } from '../api/helpers';
import {
  batchForge,
  fetchRecipes,
  fetchReforgeInfo,
  fetchUpgradeInfo,
  previewBatchForge,
  reforgeItem,
  upgradeItem,
} from '../api/craft';
import { isCraftItem } from '../utils/itemUtils';
import { formatMoney } from '../utils/money';
import RecipeList from './CraftPage/RecipeList';
import CraftPacks from './CraftPage/CraftPacks';

type Tab = 'create' | 'forge' | 'curse' | 'reforge' | 'salvage';
const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: 'create', label: 'Создание', icon: '⚗️' },
  { id: 'forge', label: 'Ковка', icon: '🔨' },
  { id: 'curse', label: 'Проклятие', icon: '☠️' },
  { id: 'reforge', label: 'Перековка', icon: '♻️' },
  { id: 'salvage', label: 'Разборка', icon: '🧰' },
];
const PRIMARY: Record<string, string> = { s: 'Сила', a: 'Ловкость', d: 'Защита', m: 'Мастерство' };
const EXTRA: Record<string, string> = { crit: 'Критический удар', dodge: 'Уклонение', counter: 'Контратака', fullBlock: 'Полный блок' };
const inputClass = 'w-full bg-[var(--color-bg-input)] border border-[var(--color-border-light)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)]';

type TooltipHandler = (item: any, x: number, y: number) => void;

function tooltipEvents(item: any, show: TooltipHandler, hide: () => void) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    onMouseEnter: (e: React.MouseEvent) => show(item, e.clientX, e.clientY),
    onMouseMove: (e: React.MouseEvent) => show(item, e.clientX, e.clientY),
    onMouseLeave: hide,
    onTouchStart: (e: React.TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      timer = setTimeout(() => show(item, touch.clientX, touch.clientY), 500);
    },
    onTouchMove: () => { if (timer) clearTimeout(timer); },
    onTouchEnd: () => { if (timer) clearTimeout(timer); },
    onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); show(item, e.clientX, e.clientY); },
  };
}

function EquipmentGrid({ items, selected, multi = false, onSelect, showTooltip, hideTooltip }: { items: any[]; selected: Set<string>; multi?: boolean; onSelect: (item: any) => void; showTooltip: TooltipHandler; hideTooltip: () => void }) {
  if (!items.length) return <p className="text-xs text-[var(--color-text-muted)] py-4 text-center">Подходящих предметов нет.</p>;
  return <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
    {items.map(item => {
      const active = selected.has(String(item.id));
      return <button key={item.id} type="button" onClick={() => onSelect(item)} {...tooltipEvents(item, showTooltip, hideTooltip)}
        className={`min-w-0 text-left rounded-lg border p-2 cursor-pointer bg-[var(--color-bg-card)] ${active ? '!border-2 !border-[#f59e0b]' : 'border-[var(--color-border-light)]'}`}>
        <div className="flex items-center gap-2 min-w-0">
          <ItemIcon color={item.rarity_color || '#777'} image={item.image} name={item.name || '?'} size="md" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold truncate">{multi && <span>{active ? '✓ ' : ''}</span>}{item.name}</p>
            <p className="text-[0.65rem] text-[var(--color-text-muted)]">{item.rarity_display || ''}{item.upgradeLevel ? ` · +${item.upgradeLevel}` : ''}</p>
          </div>
        </div>
      </button>;
    })}
  </div>;
}

function ResourceGrid({ items, selectedId, onSelect, showTooltip, hideTooltip }: { items: any[]; selectedId?: string; onSelect: (item: any) => void; showTooltip: TooltipHandler; hideTooltip: () => void }) {
  if (!items.length) return <p className="text-xs text-[var(--color-text-muted)] py-4 text-center">Необходимых ресурсов нет.</p>;
  return <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
    {items.map(item => <button key={item.id} type="button" onClick={() => onSelect(item)} {...tooltipEvents(item, showTooltip, hideTooltip)}
      className={`rounded-lg border p-2 text-left cursor-pointer bg-[var(--color-bg-card)] ${selectedId === String(item.id) ? '!border-2 !border-[#f59e0b]' : 'border-[var(--color-border-light)]'}`}>
      <div className="flex items-center gap-2"><ItemIcon color={item.rarity_color || '#777'} image={item.image} name={item.name || '?'} size="md" />
        <div className="min-w-0"><p className="text-xs font-bold truncate">{item.name}</p><p className="text-[0.65rem] text-[var(--color-text-muted)]">Количество: {item.count || 0}</p></div>
      </div>
    </button>)}
  </div>;
}

export default function CraftPage() {
  const { user } = useAuth();
  const { character, setCharacter } = useGame();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('create');
  const [actionCard, setActionCard] = useState<any>(null);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [activeRecipe, setActiveRecipe] = useState<any>(null);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [tooltip, setTooltip] = useState<{ item: any; x: number; y: number } | null>(null);
  const tooltipShownAt = useRef(0);

  const [forgeItems, setForgeItems] = useState<Record<string, number>>({});
  const [forgeStone, setForgeStone] = useState<any>(null);
  const [forgePreview, setForgePreview] = useState<any>(null);
  const [singleForge, setSingleForge] = useState(true);
  const [singleInfo, setSingleInfo] = useState<any>(null);

  const [curseItem, setCurseItem] = useState<any>(null);
  const [curseCrystal, setCurseCrystal] = useState<any>(null);
  const [curseConfirm, setCurseConfirm] = useState<any>(null);

  const [reforgeItemState, setReforgeItemState] = useState<any>(null);
  const [fromStat, setFromStat] = useState('');
  const [toStat, setToStat] = useState('');
  const [reforgeInfo, setReforgeInfo] = useState<any>(null);

  const [salvageSelected, setSalvageSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user || !character) navigate('/login');
  }, [user, character, navigate]);
  useEffect(() => {
    fetchRecipes().then(setRecipes).catch(e => showToast(e.message));
    fetch('/api/actions', { headers: getHeaders() }).then(r => r.json()).then((cards: any[]) => setActionCard(cards.find(c => c.path === '/craft'))).catch(() => {});
  }, []);
  useEffect(() => {
    const hide = () => {
      if (Date.now() - tooltipShownAt.current > 700) setTooltip(null);
    };
    document.addEventListener('click', hide);
    return () => document.removeEventListener('click', hide);
  }, []);

  const inventory: any[] = (character?.inventory || []) as any[];
  const equipment: any[] = useMemo(() => inventory.filter((i: any) => !isCraftItem(i) && !i.locked), [inventory]);
  const materials: any[] = useMemo(() => inventory.filter((i: any) => isCraftItem(i) && (i.itemType === 'craft' || i.type === 'material')), [inventory]);
  const stones: any[] = useMemo(() => inventory.filter((i: any) => isCraftItem(i) && i.itemType === 'upgrade'), [inventory]);
  const crystals: any[] = useMemo(() => inventory.filter((i: any) => isCraftItem(i) && i.itemType === 'soul_crystal'), [inventory]);
  const groupedRecipes = useMemo(() => {
    const groups: Record<string, any[]> = {};
    recipes.forEach(r => { const key = r.category?.name || 'Материалы'; (groups[key] ||= []).push(r); });
    return groups;
  }, [recipes]);
  const isVK = typeof document !== 'undefined' && document.documentElement.classList.contains('vk-iframe');

  useEffect(() => {
    setForgePreview(null);
    const selections = Object.entries(forgeItems).map(([itemId, targetLevel]) => ({ itemId, targetLevel }));
    if (!selections.length) return;
    const timer = setTimeout(() => previewBatchForge(selections).then(setForgePreview).catch(() => setForgePreview(null)), 250);
    return () => clearTimeout(timer);
  }, [forgeItems]);

  useEffect(() => {
    setSingleInfo(null);
    if (!singleForge || Object.keys(forgeItems).length !== 1 || !forgeStone) return;
    const [id] = Object.keys(forgeItems);
    const item = equipment.find((i: any) => String(i.id) === id);
    if (!item) return;
    fetchUpgradeInfo((item.upgradeLevel || 0) + 1, item.rarity_id).then(d => setSingleInfo(d)).catch(() => {});
  }, [singleForge, forgeItems, forgeStone, equipment]);

  useEffect(() => {
    setReforgeInfo(null); setFromStat(''); setToStat('');
    if (reforgeItemState) fetchReforgeInfo(reforgeItemState.id).then(setReforgeInfo).catch(e => showToast(e.message));
  }, [reforgeItemState]);

  const create = async () => {
    if (!activeRecipe) return;
    setBusy(true);
    try {
      const res = await fetch('/api/craft/execute', { method: 'POST', headers: getHeaders(), body: JSON.stringify({ recipe_id: activeRecipe.id }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Ошибка создания');
      updateCharacter(data); showToast(data.message || (data.success ? 'Предмет создан' : 'Создание не удалось'), data.success ? 'success' : 'warning');
    } catch (e: any) { showToast(e.message); } finally { setBusy(false); }
  };

  const toggleForge = (item: any) => {
    const id = String(item.id);
    setForgeItems(prev => {
      if (prev[id]) { const copy = { ...prev }; delete copy[id]; return copy; }
      if (singleForge) return { [id]: Math.min(10, (item.upgradeLevel || 0) + 1) };
      if (Object.keys(prev).length >= 20) { showToast('Можно выбрать не более 20 предметов'); return prev; }
      return { ...prev, [id]: Math.min(10, (item.upgradeLevel || 0) + 1) };
    });
  };

  const runForge = async () => {
    if (!forgeStone || !Object.keys(forgeItems).length) return;
    setBusy(true);
    try {
      if (singleForge) {
        const id = Object.keys(forgeItems)[0];
        const item = equipment.find((i: any) => String(i.id) === id);
        const data = await upgradeItem([item, { ...forgeStone, count: 1 }]);
        updateCharacter(data); showToast(data.message, data.success ? 'success' : 'warning');
      } else {
        if (!forgePreview) throw new Error('Не удалось рассчитать ковку');
        const selections = Object.entries(forgeItems).map(([itemId, targetLevel]) => ({ itemId, targetLevel }));
        const data = await batchForge(selections, forgeStone.id);
        updateCharacter(data);
        const destroyed = data.results.filter((r: any) => r.destroyed).length;
        showToast(`Ковка завершена. Камней использовано: ${data.stonesUsed}${destroyed ? `. Разрушено предметов: ${destroyed}` : ''}`, destroyed ? 'warning' : 'success');
      }
      setForgeItems({}); setForgePreview(null);
    } catch (e: any) { showToast(e.message); } finally { setBusy(false); }
  };

  const cursePreview = async () => {
    if (!curseItem || !curseCrystal) return;
    setBusy(true);
    try {
      const res = await fetch('/api/craft/curse', { method: 'POST', headers: getHeaders(), body: JSON.stringify({ itemId: curseItem.id, crystalId: curseCrystal.id }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Ошибка проклятия');
      if (data.needsConfirm) setCurseConfirm(data);
      else await applyCurse(data.newCurse, false);
    } catch (e: any) { showToast(e.message); } finally { setBusy(false); }
  };
  const applyCurse = async (curse: any, keepOld: boolean) => {
    const res = await fetch('/api/craft/curse/apply', { method: 'POST', headers: getHeaders(), body: JSON.stringify({ itemId: curseItem.id, curse, keepOld }) });
    const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Ошибка применения проклятия');
    updateCharacter(data); setCurseConfirm(null); setCurseItem(null); setCurseCrystal(null); showToast(data.message, 'success');
  };

  const availableReforgeStats = useMemo(() => {
    if (!reforgeItemState) return {};
    const base = typeof reforgeItemState.bonuses === 'string' ? JSON.parse(reforgeItemState.bonuses || '{}') : (reforgeItemState.bonuses || {});
    const extra = typeof reforgeItemState.extra === 'string' ? JSON.parse(reforgeItemState.extra || '{}') : (reforgeItemState.extra || {});
    const out: Record<string, { label: string; value: number; group: string }> = {};
    Object.entries(PRIMARY).forEach(([k, label]) => { if (Number(base[k]) > 0) out[k] = { label, value: Number(base[k]), group: 'base' }; });
    if (Number(reforgeItemState.rarity_id) !== 7 && !extra.effect) Object.entries(EXTRA).forEach(([k, label]) => { if (Number(extra[k]) > 0) out[k] = { label, value: Number(extra[k]), group: 'extra' }; });
    return out;
  }, [reforgeItemState]);
  const targetStats = fromStat && availableReforgeStats[fromStat]?.group === 'extra' ? EXTRA : PRIMARY;

  if (!user || !character) return null;

  const updateCharacter = (data: any) => setCharacter({ ...character, inventory: data.inventory, money: data.moneyAfter ?? character.money });
  const showItemTooltip: TooltipHandler = (item, x, y) => {
    tooltipShownAt.current = Date.now();
    setTooltip({ item, x, y });
  };
  const hideItemTooltip = () => setTooltip(null);
  const gridTooltipProps = { showTooltip: showItemTooltip, hideTooltip: hideItemTooltip };

  const runReforge = async () => {
    if (!reforgeItemState || !fromStat || !toStat) return;
    setBusy(true);
    try { const data = await reforgeItem(reforgeItemState.id, fromStat, toStat); updateCharacter(data); showToast(data.message, 'success'); setReforgeItemState(null); }
    catch (e: any) { showToast(e.message); } finally { setBusy(false); }
  };

  const runSalvage = async () => {
    setBusy(true);
    try {
      if (salvageSelected.size) {
        const data = await salvageItems([...salvageSelected]);
        setCharacter({ ...character, inventory: data.inventory });
        showToast(`Разобрано предметов: ${salvageSelected.size}`, 'success');
      }
      setSalvageSelected(new Set());
    } catch (e: any) { showToast(e.message); } finally { setBusy(false); }
  };

  return <div className="px-3 sm:px-4 py-4 min-h-screen max-w-3xl mx-auto">
    <BackButton />
    {actionCard && <PageHeader title="Ремесло" icon={actionCard.icon} bgImage={actionCard.bg_image} />}
    <p className="text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] rounded p-2 mb-3">Каждый вид ремесла вынесен в отдельную мастерскую. На вкладке показываются только подходящие предметы и необходимые ресурсы.</p>
    {tab === 'create' && <CraftPacks isVK={isVK} mode="create" />}
    {tab === 'forge' && <CraftPacks isVK={isVK} mode="forge" />}
    {tab === 'curse' && <CraftPacks isVK={isVK} mode="curse" />}

    <div className="flex overflow-x-auto gap-1 mb-4 pb-1 sm:grid sm:grid-cols-5">
      {TABS.map(t => <button key={t.id} onClick={() => setTab(t.id)} className={`flex-shrink-0 min-h-10 px-3 py-2 rounded-lg text-xs font-bold cursor-pointer border ${tab === t.id ? 'bg-[#7c3aed] text-white border-[#7c3aed]' : 'bg-[var(--color-bg-secondary)] border-[var(--color-border-light)] text-[var(--color-text-secondary)]'}`}><span className="mr-1">{t.icon}</span>{t.label}</button>)}
    </div>

    {tab === 'create' && <div className="grid md:grid-cols-[1fr_260px] gap-4">
      <div><RecipeList groupedRecipes={groupedRecipes} openCategories={openCategories} activeRecipe={activeRecipe} onToggleCategory={cat => setOpenCategories(p => ({ ...p, [cat]: !p[cat] }))} onRecipeClick={setActiveRecipe} /></div>
      <Card><h2 className="font-bold mb-2">Создание</h2>{activeRecipe ? <><p className="text-sm font-bold">{activeRecipe.name}</p><p className="text-xs text-[var(--color-text-muted)] my-2">{activeRecipe.ingredients.map((i: any) => `${i.name} ×${i.quantity}`).join(', ')}</p><p className="text-xs">Шанс: {activeRecipe.success_chance ?? 100}%</p><p className="text-xs mb-3">Стоимость: {formatMoney(activeRecipe.money_cost)}</p><Button size="md" fullWidth disabled={busy} onClick={create}>{busy ? 'Создание...' : 'Создать'}</Button></> : <p className="text-xs text-[var(--color-text-muted)]">Выберите рецепт.</p>}</Card>
      <Card className="md:col-span-2"><h3 className="font-bold text-sm mb-2">Используемые материалы</h3><ResourceGrid {...gridTooltipProps} items={materials} onSelect={() => {}} /></Card>
    </div>}

    {tab === 'forge' && <div className="space-y-4">
      <Card><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-bold">Ковка</h2><p className="text-xs text-[var(--color-text-muted)]">Усиливайте один предмет или несколько предметов до выбранного уровня.</p></div><div className="flex gap-1"><Button size="sm" variant={singleForge ? 'primary' : 'secondary'} onClick={() => { setSingleForge(true); setForgeItems({}); }}>Один предмет</Button><Button size="sm" variant={!singleForge ? 'primary' : 'secondary'} onClick={() => { setSingleForge(false); setForgeItems({}); }}>Массовая ковка</Button></div></div></Card>
      <Card><h3 className="font-bold text-sm mb-2">1. Выберите {singleForge ? 'предмет' : 'предметы'}</h3><EquipmentGrid {...gridTooltipProps} items={equipment.filter((i: any) => (i.upgradeLevel || 0) < 10)} selected={new Set(Object.keys(forgeItems))} multi={!singleForge} onSelect={toggleForge} />
        {!singleForge && Object.entries(forgeItems).map(([id, target]) => { const item = equipment.find((i: any) => String(i.id) === id); return item && <div key={id} className="mt-2 flex items-center gap-2 text-xs"><span className="flex-1 truncate">{item.name} (+{item.upgradeLevel || 0})</span><label>До уровня</label><select className={inputClass + ' !w-20'} value={target} onChange={e => setForgeItems(p => ({ ...p, [id]: Number(e.target.value) }))}>{Array.from({ length: 10 - (item.upgradeLevel || 0) }, (_, n) => n + (item.upgradeLevel || 0) + 1).map(v => <option key={v} value={v}>+{v}</option>)}</select></div>; })}
      </Card>
      <Card><h3 className="font-bold text-sm mb-2">2. Выберите камень</h3><ResourceGrid {...gridTooltipProps} items={stones} selectedId={forgeStone && String(forgeStone.id)} onSelect={setForgeStone} /></Card>
      <Card><h3 className="font-bold text-sm mb-2">Расчёт</h3>{singleForge && singleInfo ? <p className="text-xs">Следующий уровень: шанс {singleInfo.chance}% · стоимость {formatMoney(singleInfo.money_cost)}</p> : !singleForge && forgePreview ? <><p className="text-xs">Максимально потребуется камней: {forgePreview.requiredStones}</p><p className="text-xs">Максимальная стоимость: {formatMoney(forgePreview.totalCost)}</p><p className="text-xs text-[var(--color-accent-warning)] mt-1">Для каждого предмета ковка прекращается после первой неудачи. При попытке +7 и выше предмет может разрушиться.</p></> : <p className="text-xs text-[var(--color-text-muted)]">Выберите предметы и целевые уровни.</p>}<Button className="mt-3" size="md" fullWidth disabled={busy || !forgeStone || !Object.keys(forgeItems).length || (!singleForge && !forgePreview)} onClick={runForge}>{busy ? 'Ковка...' : 'Начать ковку'}</Button></Card>
    </div>}

    {tab === 'curse' && <div className="space-y-4"><Card><h2 className="font-bold">Проклятие</h2><p className="text-xs text-[var(--color-text-muted)]">Добавляет случайную базовую характеристику. Текущее проклятие можно оставить после просмотра результата.</p></Card><Card><h3 className="font-bold text-sm mb-2">1. Выберите предмет</h3><EquipmentGrid {...gridTooltipProps} items={equipment} selected={new Set(curseItem ? [String(curseItem.id)] : [])} onSelect={setCurseItem} /></Card><Card><h3 className="font-bold text-sm mb-2">2. Выберите Кристалл душ</h3><ResourceGrid {...gridTooltipProps} items={crystals} selectedId={curseCrystal && String(curseCrystal.id)} onSelect={setCurseCrystal} /></Card><Card><p className="text-xs mb-3">Стоимость: {formatMoney(100000)} + 1 Кристалл душ</p><Button size="md" fullWidth className="!bg-[#7c3aed] !text-white" disabled={busy || !curseItem || !curseCrystal || character.money < 100000} onClick={cursePreview}>{busy ? 'Проклятие...' : 'Проклясть'}</Button></Card></div>}

    {tab === 'reforge' && <div className="space-y-4"><Card><h2 className="font-bold">Перековка</h2><p className="text-xs text-[var(--color-text-muted)]">Переносит всё значение одной характеристики в другую характеристику той же группы. Проклятие, комплект и эффект артефакта не меняются.</p></Card><Card><h3 className="font-bold text-sm mb-2">1. Выберите предмет</h3><EquipmentGrid {...gridTooltipProps} items={equipment} selected={new Set(reforgeItemState ? [String(reforgeItemState.id)] : [])} onSelect={setReforgeItemState} /></Card>{reforgeItemState && <Card><h3 className="font-bold text-sm mb-2">2. Выберите изменение</h3><label className="text-xs">Исходная характеристика</label><select className={inputClass + ' mb-3'} value={fromStat} onChange={e => { setFromStat(e.target.value); setToStat(''); }}><option value="">Выберите</option>{Object.entries(availableReforgeStats).map(([key, s]) => <option key={key} value={key}>{s.label}: +{s.value}</option>)}</select><label className="text-xs">Новая характеристика</label><select className={inputClass} value={toStat} onChange={e => setToStat(e.target.value)}><option value="">Выберите</option>{Object.entries(targetStats).filter(([k]) => k !== fromStat).map(([k, label]) => <option key={k} value={k}>{label}</option>)}</select>{fromStat && toStat && <div className="rounded-lg bg-[var(--color-bg-input)] p-3 text-xs mt-3"><p>Было: {availableReforgeStats[fromStat].label} +{availableReforgeStats[fromStat].value}</p><p className="text-[var(--color-accent-success)]">Станет: {targetStats[toStat]} +{availableReforgeStats[fromStat].value}</p><p className="mt-2">Стоимость: {reforgeInfo ? formatMoney(reforgeInfo.cost) : 'расчёт...'}</p><p>Предыдущих перековок: {reforgeInfo?.reforgeCount || 0}</p></div>}<Button size="md" fullWidth className="mt-3" disabled={busy || !fromStat || !toStat || !reforgeInfo || character.money < reforgeInfo.cost} onClick={runReforge}>{busy ? 'Перековка...' : 'Перековать'}</Button></Card>}</div>}

    {tab === 'salvage' && <div className="space-y-4"><Card><h2 className="font-bold">Разборка</h2><p className="text-xs text-[var(--color-text-muted)]">Предмет превращается в материал своей редкости. Камни улучшения разбирать нельзя.</p></Card><Card><h3 className="font-bold text-sm mb-2">Выберите предметы</h3><EquipmentGrid {...gridTooltipProps} items={equipment} selected={salvageSelected} multi onSelect={item => setSalvageSelected(prev => { const next = new Set(prev); const id = String(item.id); if (next.has(id)) next.delete(id); else next.add(id); return next; })} /></Card><Button variant="danger" size="md" fullWidth disabled={busy || !salvageSelected.size} onClick={runSalvage}>{busy ? 'Разборка...' : `Разобрать${salvageSelected.size ? ` (${salvageSelected.size})` : ''}`}</Button></div>}

    {curseConfirm && <div className="fixed inset-0 z-[1100] flex items-center justify-center"><div className="absolute inset-0 bg-black/60" /><Card className="relative max-w-sm w-full mx-4 text-center"><h3 className="font-bold mb-3">Выберите проклятие</h3><p className="text-xs mb-2">Текущее: +{curseConfirm.oldCurse.value} {curseConfirm.oldCurse.statName} ({curseConfirm.oldCurse.name})</p><p className="text-xs mb-4 text-[var(--color-accent-purple)]">Новое: +{curseConfirm.newCurse.value} {curseConfirm.newCurse.statName} ({curseConfirm.newCurse.name})</p><div className="flex gap-2 justify-center"><Button size="md" variant="secondary" onClick={() => applyCurse(curseConfirm.newCurse, true).catch(e => showToast(e.message))}>Оставить текущее</Button><Button size="md" variant="danger" onClick={() => applyCurse(curseConfirm.newCurse, false).catch(e => showToast(e.message))}>Применить новое</Button></div></Card></div>}
    {tooltip && <ItemTooltip item={tooltip.item} position={{ x: tooltip.x, y: tooltip.y }} />}
  </div>;
}
