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
import CraftPopup from './CraftPage/CraftPopup';
import OperationProgressModal, { type OperationEntry } from './CraftPage/OperationProgressModal';

type Tab = 'create' | 'forge' | 'curse' | 'reforge' | 'salvage';
const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: 'create', label: 'Создание', icon: '⚗️' },
  { id: 'forge', label: 'Улучшение', icon: '🔨' },
  { id: 'curse', label: 'Проклятие', icon: '☠️' },
  { id: 'reforge', label: 'Перековка', icon: '♻️' },
  { id: 'salvage', label: 'Разборка', icon: '🧰' },
];
const PRIMARY: Record<string, string> = { s: 'Сила', a: 'Ловкость', d: 'Защита', m: 'Мастерство' };
const EXTRA: Record<string, string> = { crit: 'Критический удар', dodge: 'Уклонение', counter: 'Контратака', fullBlock: 'Полный блок' };
const inputClass = 'w-full bg-[var(--color-bg-input)] border border-[var(--color-border-light)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)]';
const STONE_BONUS: Record<number, number> = { 0: 0, 1: 5, 2: 10, 3: 15, 4: 20, 5: 30, 6: 50 };
const CURSE_RANKS = [
  { rank: 1, name: 'I', color: '#22c55e', chance: 80 },
  { rank: 2, name: 'II', color: '#3b82f6', chance: 12 },
  { rank: 3, name: 'III', color: '#a855f7', chance: 6 },
  { rank: 4, name: 'IV', color: '#f97316', chance: 1.5 },
  { rank: 5, name: 'V', color: '#ef4444', chance: 0.5 },
];

type ProgressState = {
  title: string;
  entries: OperationEntry[];
  stepKey: number;
  stepResult: { success: boolean; message: string } | null;
};

function objectField(value: unknown): Record<string, any> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch { return {}; }
  }
  return {};
}

function canReforge(item: any) {
  const rarity = Number(item.rarity_id ?? 0);
  if (rarity < 0 || rarity > 7) return false;
  const base = objectField(item.bonuses);
  if (Object.keys(PRIMARY).some(stat => Number(base[stat]) > 0)) return true;
  const extra = objectField(item.extra);
  return rarity !== 7 && !extra.effect && Object.keys(EXTRA).some(stat => Number(extra[stat]) > 0);
}

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
      const upgradeLevel = Number(item.upgradeLevel ?? item.upgradelevel ?? 0);
      return <button key={item.id} type="button" onClick={() => onSelect(item)} {...tooltipEvents(item, showTooltip, hideTooltip)}
        className={`min-w-0 text-left rounded-lg border p-2 cursor-pointer bg-[var(--color-bg-card)] ${active ? '!border-2 !border-[#f59e0b]' : 'border-[var(--color-border-light)]'}`}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative flex-shrink-0">
            <ItemIcon color={item.rarity_color || '#777'} image={item.image} name={item.name || '?'} size="md" />
            {upgradeLevel > 0 && <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-[var(--color-text-accent)] text-black text-[9px] leading-4 font-bold text-center shadow border border-black/30">+{upgradeLevel}</span>}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold truncate">{multi && <span>{active ? '✓ ' : ''}</span>}{item.name}</p>
            <p className="text-[0.65rem] text-[var(--color-text-muted)]">{item.rarity_display || ''}{upgradeLevel > 0 ? ` · +${upgradeLevel}` : ''}</p>
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
  const [craftResult, setCraftResult] = useState<{ success: boolean; label: string; message: string } | null>(null);
  const [progressState, setProgressState] = useState<ProgressState | null>(null);
  const operationContinueRef = useRef<(() => void) | null>(null);
  const stopRequestedRef = useRef(false);

  const [forgeItems, setForgeItems] = useState<Record<string, number>>({});
  const [forgeStone, setForgeStone] = useState<any>(null);
  const [forgePreview, setForgePreview] = useState<any>(null);
  const [singleForge, setSingleForge] = useState(true);
  const [singleInfo, setSingleInfo] = useState<any>(null);

  const [curseItems, setCurseItems] = useState<Set<string>>(new Set());
  const [curseMode, setCurseMode] = useState<'random' | 'target'>('random');
  const [singleCurse, setSingleCurse] = useState(true);
  const [curseCrystal, setCurseCrystal] = useState<any>(null);
  const [curseStat, setCurseStat] = useState('');
  const [curseRank, setCurseRank] = useState(0);
  const [curseAttempts, setCurseAttempts] = useState(10);
  const [randomCurseRoll, setRandomCurseRoll] = useState<any>(null);

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
  useEffect(() => {
    if (randomCurseRoll) return;
    const pendingItem = inventory.find((item: any) => !isCraftItem(item) && item.pendingCurse);
    if (!pendingItem) return;
    const pending = pendingItem.pendingCurse;
    setRandomCurseRoll({
      itemId: pendingItem.id,
      oldCurse: pendingItem.curseStat ? {
        stat: pendingItem.curseStat, value: pendingItem.curseValue, rank: pendingItem.curseRank,
        name: pendingItem.curseName, color: pendingItem.curseColor,
        statName: PRIMARY[pendingItem.curseStat] || pendingItem.curseStat,
      } : null,
      newCurse: { ...pending, statName: PRIMARY[pending.stat] || pending.stat },
    });
  }, [inventory, randomCurseRoll]);
  const relevantMaterials: any[] = useMemo(() => {
    if (!activeRecipe) return [];
    const ingredientIds = new Set((activeRecipe.ingredients || []).map((i: any) => String(i.id ?? i.item_id ?? i.itemId ?? '')));
    const ingredientNames = new Set((activeRecipe.ingredients || []).map((i: any) => String(i.name || '').toLowerCase()));
    return materials.filter((item: any) => ingredientIds.has(String(item.id)) || ingredientNames.has(String(item.name || '').toLowerCase()));
  }, [activeRecipe, materials]);
  const reforgeEquipment: any[] = useMemo(() => equipment.filter(canReforge), [equipment]);
  const groupedRecipes = useMemo(() => {
    const groups: Record<string, any[]> = {};
    recipes.forEach(r => { const key = r.category?.name || 'Материалы'; (groups[key] ||= []).push(r); });
    return groups;
  }, [recipes]);
  const isVK = typeof document !== 'undefined' && document.documentElement.classList.contains('vk-iframe');

  useEffect(() => {
    setForgePreview(null);
    const selections = Object.entries(forgeItems).map(([itemId, targetLevel]) => ({ itemId, targetLevel }));
    if (!selections.length || !forgeStone) return;
    const timer = setTimeout(() => previewBatchForge(selections, forgeStone.id).then(setForgePreview).catch(() => setForgePreview(null)), 250);
    return () => clearTimeout(timer);
  }, [forgeItems, forgeStone]);

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
      updateCharacter(data);
      setCraftResult({ success: !!data.success, label: `Создание: ${activeRecipe.name}`, message: data.message || (data.success ? 'Предмет создан' : 'Создание не удалось') });
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
    stopRequestedRef.current = false;
    const plans = Object.entries(forgeItems).map(([id, target]) => {
      const item = equipment.find((entry: any) => String(entry.id) === id);
      return { id, target, item: { ...item } };
    }).filter(plan => plan.item?.id);
    let latestInventory = inventory;
    let latestMoney = character!.money;
    const entries: OperationEntry[] = plans.map(plan => ({ id: plan.id, name: plan.item.name, detail: `+${plan.item.upgradeLevel || 0} → +${plan.target}`, status: 'pending' }));
    setProgressState({ title: 'Пошаговое улучшение', entries, stepKey: 0, stepResult: null });
    try {
      for (const plan of plans) {
        let current = plan.item;
        while (Number(current.upgradeLevel || 0) < plan.target && !stopRequestedRef.current) {
          const liveStone = latestInventory.find((entry: any) => isCraftItem(entry) && String(entry.id) === String(forgeStone.id) && entry.itemType === 'upgrade');
          if (!liveStone || Number(liveStone.count || 0) < 1) {
            entries.find(entry => entry.id === plan.id)!.result = 'Недостаточно камней';
            stopRequestedRef.current = true;
            break;
          }
          const active = entries.find(entry => entry.id === plan.id)!;
          const nextLevel = Number(current.upgradeLevel ?? current.upgradelevel ?? 0) + 1;
          const chanceInfo = await fetchUpgradeInfo(nextLevel, current.rarity_id);
          const currentChance = Math.min(100,
            Number(chanceInfo.chance || 0)
            + Number(chanceInfo.factionBonus || 0)
            + (STONE_BONUS[Number(liveStone.rarity_id)] || 0)
          );
          active.status = 'active'; active.detail = `Попытка +${nextLevel} · шанс ${currentChance}%`;
          setProgressState(prev => prev && ({ ...prev, entries: [...entries], stepResult: null }));
          const data = await upgradeItem([current, { ...liveStone, count: 1 }]);
          latestInventory = data.inventory; latestMoney = data.moneyAfter ?? latestMoney;
          setCharacter(prev => prev ? ({ ...prev, inventory: latestInventory, money: latestMoney }) : prev);
          const nextItem = latestInventory.find((entry: any) => !isCraftItem(entry) && String(entry.id) === plan.id);
          active.result = data.message;
          active.detail = nextItem ? `Текущий уровень: +${nextItem.upgradeLevel || 0}` : 'Предмет разрушен';
          setProgressState(prev => prev && ({ ...prev, entries: [...entries], stepKey: prev.stepKey + 1, stepResult: { success: !!data.success, message: data.message } }));
          await new Promise<void>(resolve => { operationContinueRef.current = resolve; });
          operationContinueRef.current = null;
          if (!nextItem) { active.status = 'failure'; break; }
          current = nextItem;
          if (Number(current.upgradeLevel || 0) >= plan.target) active.status = 'success';
          else active.status = 'pending';
        }
        const entry = entries.find(row => row.id === plan.id)!;
        if (entry.status === 'pending' && stopRequestedRef.current) entry.status = 'stopped';
      }
      entries.forEach(entry => { if (entry.status === 'pending') entry.status = stopRequestedRef.current ? 'stopped' : 'success'; });
      showToast(stopRequestedRef.current ? 'Улучшение остановлено' : 'Улучшение завершено', stopRequestedRef.current ? 'warning' : 'success');
      setForgeItems({}); setForgePreview(null); setForgeStone(null); setSingleInfo(null);
    } catch (e: any) { showToast(e.message); } finally { setBusy(false); setProgressState(null); operationContinueRef.current = null; }
  };

  const toggleCurse = (item: any) => {
    const id = String(item.id);
    setCurseItems(prev => {
      if (singleCurse) return new Set([id]);
      const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next;
    });
  };

  const runCurse = async () => {
    if (!curseItems.size || !curseCrystal) return;
    const isSingleRandom = curseMode === 'random' || (!curseStat && !curseRank);
    if (isSingleRandom) {
      const itemId = [...curseItems][0];
      setBusy(true);
      try {
        const response = await fetch('/api/craft/curse', {
          method: 'POST', headers: getHeaders(),
          body: JSON.stringify({ itemId, crystalId: curseCrystal.id }),
        });
        const rolled = await response.json();
        if (!response.ok) throw new Error(rolled.error || 'Ошибка проклятия');
        updateCharacter(rolled);
        setRandomCurseRoll(rolled.oldCurse ? { ...rolled, itemId } : null);
        setCraftResult({ success: true, label: 'Наложение проклятия', message: `Выпало: +${rolled.newCurse.value} ${rolled.newCurse.statName}, ранг ${rolled.newCurse.name}` });
      } catch (error: any) { showToast(error.message); }
      finally { setBusy(false); }
      return;
    }
    setBusy(true);
    stopRequestedRef.current = false;
    const selected = [...curseItems].map(id => equipment.find((item: any) => String(item.id) === id)).filter(Boolean);
    const targetDescription = [curseStat ? PRIMARY[curseStat] : '', curseRank ? `ранг ${CURSE_RANKS[curseRank - 1].name}+` : ''].filter(Boolean).join(', ');
    const entries: OperationEntry[] = selected.map(item => ({ id: String(item.id), name: item.name, detail: `Цель: ${targetDescription}`, status: 'pending' }));
    setProgressState({ title: 'Пошаговое проклятие', entries, stepKey: 0, stepResult: null });
    let latestInventory = inventory;
    let latestMoney = character!.money;
    try {
      for (const item of selected) {
        const entry = entries.find(row => row.id === String(item.id))!;
        const attemptLimit = curseAttempts;
        for (let attempt = 1; attempt <= attemptLimit && !stopRequestedRef.current; attempt++) {
          const crystal = latestInventory.find((row: any) => isCraftItem(row) && row.itemType === 'soul_crystal' && String(row.id) === String(curseCrystal.id));
          if (!crystal || Number(crystal.count || 0) < 1 || latestMoney < 100000) { entry.result = 'Недостаточно ресурсов'; stopRequestedRef.current = true; break; }
          entry.status = 'active'; entry.detail = `Попытка ${attempt} из ${attemptLimit}`;
          setProgressState(prev => prev && ({ ...prev, entries: [...entries], stepResult: null }));
          const attemptRes = await fetch('/api/craft/curse-target-attempt', {
            method: 'POST', headers: getHeaders(),
            body: JSON.stringify({ itemId: item.id, crystalId: crystal.id, targetStat: curseStat || null, minimumRank: curseRank || null, random: false }),
          });
          const attemptData = await attemptRes.json();
          if (!attemptRes.ok) throw new Error(attemptData.error || 'Ошибка проклятия');
          const meets = !!attemptData.matched;
          const appliedCandidate = !!attemptData.applied;
          const preview = { newCurse: attemptData.curse };
          latestInventory = attemptData.inventory; latestMoney = attemptData.moneyAfter;
          setCharacter(prev => prev ? ({ ...prev, inventory: latestInventory, money: latestMoney }) : prev);
          const rolled = `Ранг ${preview.newCurse.name}: +${preview.newCurse.value} ${preview.newCurse.statName}`;
          entry.result = meets ? `${rolled} — цель достигнута` : appliedCandidate ? `${rolled} — применено как ближайшее к цели` : `${rolled} — оставлено более близкое текущее проклятие`;
          setProgressState(prev => prev && ({ ...prev, entries: [...entries], stepKey: prev.stepKey + 1, stepResult: { success: meets, message: entry.result! } }));
          await new Promise<void>(resolve => { operationContinueRef.current = resolve; }); operationContinueRef.current = null;
          if (meets) { entry.status = 'success'; break; }
          entry.status = attempt === attemptLimit ? 'failure' : 'pending';
        }
        if (entry.status === 'pending' && stopRequestedRef.current) entry.status = 'stopped';
      }
      entries.forEach(entry => { if (entry.status === 'pending') entry.status = 'stopped'; });
      showToast(stopRequestedRef.current ? 'Проклятие остановлено' : 'Проклятие завершено', stopRequestedRef.current ? 'warning' : 'success');
      setCurseItems(new Set()); setCurseCrystal(null);
    } catch (e: any) { showToast(e.message); } finally { setBusy(false); setProgressState(null); operationContinueRef.current = null; }
  };

  const resolveRandomCurse = async (keepOld: boolean) => {
    if (!randomCurseRoll) return;
    setBusy(true);
    try {
      const response = await fetch('/api/craft/curse/apply', {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ itemId: randomCurseRoll.itemId, keepOld }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Ошибка применения проклятия');
      setCharacter(prev => prev ? ({ ...prev, inventory: data.inventory }) : prev);
      showToast(data.message, 'success');
      setRandomCurseRoll(null); setCurseItems(new Set()); setCurseCrystal(null);
    } catch (error: any) { showToast(error.message); }
    finally { setBusy(false); }
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
      <Card className="md:col-span-2"><h3 className="font-bold text-sm mb-2">Используемые материалы</h3>{activeRecipe ? <ResourceGrid {...gridTooltipProps} items={relevantMaterials} onSelect={() => {}} /> : <p className="text-xs text-[var(--color-text-muted)]">Выберите рецепт.</p>}</Card>
    </div>}

    {tab === 'forge' && <div className="space-y-4">
      <Card><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-bold">Улучшение</h2><p className="text-xs text-[var(--color-text-muted)]">Усиливайте один предмет или несколько предметов до выбранного уровня.</p></div><div className="flex gap-1"><Button size="sm" variant={singleForge ? 'primary' : 'secondary'} onClick={() => { setSingleForge(true); setForgeItems({}); }}>Один предмет</Button><Button size="sm" variant={!singleForge ? 'primary' : 'secondary'} onClick={() => { setSingleForge(false); setForgeItems({}); }}>Массовое улучшение</Button></div></div></Card>
      <Card><h3 className="font-bold text-sm mb-2">1. Выберите {singleForge ? 'предмет' : 'предметы'}</h3><EquipmentGrid {...gridTooltipProps} items={equipment.filter((i: any) => (i.upgradeLevel || 0) < 10)} selected={new Set(Object.keys(forgeItems))} multi={!singleForge} onSelect={toggleForge} />
        {Object.entries(forgeItems).map(([id, target]) => { const item = equipment.find((i: any) => String(i.id) === id); return item && <div key={id} className="mt-2 flex items-center gap-2 text-xs"><span className="flex-1 truncate">{item.name} (+{item.upgradeLevel || 0})</span><label>Улучшать до</label><select className={inputClass + ' !w-20'} value={target} onChange={e => setForgeItems(p => ({ ...p, [id]: Number(e.target.value) }))}>{Array.from({ length: 10 - (item.upgradeLevel || 0) }, (_, n) => n + (item.upgradeLevel || 0) + 1).map(v => <option key={v} value={v}>+{v}</option>)}</select></div>; })}
      </Card>
      <Card><h3 className="font-bold text-sm mb-2">2. Выберите камень</h3><ResourceGrid {...gridTooltipProps} items={stones} selectedId={forgeStone && String(forgeStone.id)} onSelect={setForgeStone} /></Card>
      <Card><h3 className="font-bold text-sm mb-2">Расчёт улучшения</h3>{singleForge && singleInfo ? <><p className="text-xs">Следующий уровень: шанс {Math.min(100, Number(singleInfo.chance) + Number(singleInfo.factionBonus || 0) + (STONE_BONUS[Number(forgeStone?.rarity_id)] || 0))}% · минимальная стоимость {formatMoney(singleInfo.money_cost)}</p><p className="text-[0.65rem] text-[var(--color-text-muted)] mt-1">Минимум: 1 камень и указанная сумма за одну попытку. При неудачах расход увеличится.</p></> : !singleForge && forgePreview ? <><div className="rounded-lg bg-[var(--color-bg-input)] p-3 mb-3"><p className="text-xs font-bold mb-1">Минимум ресурсов до выбранных уровней</p><p className="text-xs">Минимум камней: {forgePreview.requiredStones}</p><p className="text-xs">Минимум серебра: {formatMoney(forgePreview.totalCost)}</p><p className="text-[0.65rem] text-[var(--color-text-muted)] mt-1">Расчёт предполагает успех с первой попытки на каждом уровне. При неудачах попытки продолжаются автоматически, поэтому фактический расход будет больше.</p></div><div className="space-y-2">{forgePreview.entries.map((entry: any) => { const item = equipment.find((i: any) => String(i.id) === String(entry.itemId)); return <div key={entry.itemId} className="rounded-lg border border-[var(--color-border-light)] p-2"><div className="flex justify-between gap-2 text-xs font-bold"><span className="truncate">{item?.name || 'Предмет'}</span><span className="text-[var(--color-accent-warning)]">До цели без повторов: {entry.targetChance}%</span></div><div className="flex flex-wrap gap-1 mt-1">{entry.rules.map((rule: any) => <span key={rule.level} className="rounded bg-[var(--color-bg-secondary)] px-2 py-1 text-[0.65rem]">+{rule.level}: {rule.finalChance}%</span>)}</div></div>; })}</div><p className="text-xs text-[var(--color-accent-warning)] mt-2">При неудаче на попытке +7 и выше предмет может разрушиться.</p></> : <p className="text-xs text-[var(--color-text-muted)]">Выберите предметы, целевые уровни и камень.</p>}<Button className="mt-3" size="md" fullWidth disabled={busy || !forgeStone || !Object.keys(forgeItems).length || (!singleForge && !forgePreview)} onClick={runForge}>{busy ? 'Улучшение...' : 'Начать улучшение'}</Button></Card>
    </div>}

    {tab === 'curse' && <div className="space-y-4">
      <Card><h2 className="font-bold">Проклятие</h2><p className="text-xs text-[var(--color-text-muted)]">Каждая попытка полностью случайна и расходует 100 000 серебра и один Кристалл душ. Поиск результата только автоматически повторяет случайные попытки.</p><div className="flex flex-wrap gap-1 mt-3"><Button size="sm" variant={curseMode === 'random' ? 'primary' : 'secondary'} onClick={() => { setCurseMode('random'); setSingleCurse(true); setCurseItems(new Set()); }}>Случайное проклятие</Button><Button size="sm" variant={curseMode === 'target' ? 'primary' : 'secondary'} onClick={() => { setCurseMode('target'); setCurseItems(new Set()); }}>Поиск результата</Button></div>{curseMode === 'target' && <div className="flex gap-1 mt-2"><Button size="sm" variant={singleCurse ? 'primary' : 'secondary'} onClick={() => { setSingleCurse(true); setCurseItems(new Set()); }}>Один предмет</Button><Button size="sm" variant={!singleCurse ? 'primary' : 'secondary'} onClick={() => { setSingleCurse(false); setCurseItems(new Set()); }}>Несколько предметов</Button></div>}</Card>
      <Card><h3 className="font-bold text-sm mb-2">1. Выберите {curseMode === 'random' || singleCurse ? 'предмет' : 'предметы'}</h3><EquipmentGrid {...gridTooltipProps} items={equipment} selected={curseItems} multi={curseMode === 'target' && !singleCurse} onSelect={toggleCurse} /></Card>
      {curseMode === 'target' && <Card><h3 className="font-bold text-sm mb-2">2. Настройте цель</h3><div className="grid sm:grid-cols-3 gap-3"><label className="text-xs">Характеристика<select className={inputClass + ' mt-1'} value={curseStat} onChange={e => setCurseStat(e.target.value)}><option value="">Любая характеристика</option>{Object.entries(PRIMARY).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="text-xs">Ранг<select className={inputClass + ' mt-1'} value={curseRank} onChange={e => setCurseRank(Number(e.target.value))}><option value={0}>Любой ранг</option>{CURSE_RANKS.map(rank => <option key={rank.rank} value={rank.rank}>{rank.name} ({rank.chance}%)</option>)}</select></label><label className="text-xs">Попыток на предмет<input className={inputClass + ' mt-1'} type="number" min={1} max={100} value={curseAttempts} disabled={!curseStat && !curseRank} onChange={e => setCurseAttempts(Math.max(1, Math.min(100, Number(e.target.value) || 1)))} /></label></div><div className="flex flex-wrap gap-2 mt-3">{CURSE_RANKS.map(rank => <span key={rank.rank} className="text-xs font-bold" style={{ color: rank.color }}>Ранг {rank.name}: {rank.chance}%</span>)}</div><p className="text-[0.7rem] text-[var(--color-text-muted)] mt-2">Можно выбрать только характеристику, только ранг, оба условия или ничего. Без условий выполняется одна случайная попытка.</p><p className="text-[0.7rem] text-[var(--color-text-muted)] mt-1">Если проклятия нет, применяется первая попытка. Затем сначала сохраняется нужная характеристика, после неё — ранг, ближайший к выбранному.</p></Card>}
      <Card><h3 className="font-bold text-sm mb-2">{curseMode === 'target' ? '3.' : '2.'} Выберите Кристалл душ</h3><ResourceGrid {...gridTooltipProps} items={crystals} selectedId={curseCrystal && String(curseCrystal.id)} onSelect={setCurseCrystal} /></Card>
      <Card><p className="text-xs">Минимум на один предмет: {formatMoney(100000)} и 1 Кристалл душ.</p>{curseMode === 'target' && (curseStat || curseRank) && <p className="text-xs">Максимальный запас по лимиту: {formatMoney(100000 * curseAttempts * curseItems.size)} и {curseAttempts * curseItems.size} Кристаллов душ.</p>}<p className="text-[0.65rem] text-[var(--color-text-muted)] mt-1 mb-3">Каждая попытка случайна и отдельно расходует ресурсы. Автоматический поиск остановится при достижении цели, нажатии «Остановить», исчерпании лимита или ресурсов.</p><Button size="md" fullWidth className="!bg-[#7c3aed] !text-white" disabled={busy || !curseItems.size || !curseCrystal || character.money < 100000} onClick={runCurse}>{busy ? 'Проклятие...' : curseMode === 'random' || (!curseStat && !curseRank) ? 'Наложить случайное проклятие' : 'Начать поиск результата'}</Button></Card>
    </div>}

    {tab === 'reforge' && <div className="space-y-4"><Card><h2 className="font-bold">Перековка</h2><p className="text-xs text-[var(--color-text-muted)]">Переносит всё значение одной характеристики в другую характеристику той же группы. Проклятие, комплект и эффект артефакта не меняются.</p></Card><Card><h3 className="font-bold text-sm mb-2">1. Выберите предмет</h3><EquipmentGrid {...gridTooltipProps} items={reforgeEquipment} selected={new Set(reforgeItemState ? [String(reforgeItemState.id)] : [])} onSelect={setReforgeItemState} /></Card>{reforgeItemState && <Card><h3 className="font-bold text-sm mb-2">2. Выберите изменение</h3><label className="text-xs">Исходная характеристика</label><select className={inputClass + ' mb-3'} value={fromStat} onChange={e => { setFromStat(e.target.value); setToStat(''); }}><option value="">Выберите</option>{Object.entries(availableReforgeStats).map(([key, s]) => <option key={key} value={key}>{s.label}: +{s.value}</option>)}</select><label className="text-xs">Новая характеристика</label><select className={inputClass} value={toStat} onChange={e => setToStat(e.target.value)}><option value="">Выберите</option>{Object.entries(targetStats).filter(([k]) => k !== fromStat).map(([k, label]) => <option key={k} value={k}>{label}</option>)}</select>{fromStat && toStat && <div className="rounded-lg bg-[var(--color-bg-input)] p-3 text-xs mt-3"><p>Было: {availableReforgeStats[fromStat].label} +{availableReforgeStats[fromStat].value}</p><p className="text-[var(--color-accent-success)]">Станет: {targetStats[toStat]} +{availableReforgeStats[fromStat].value}</p><p className="mt-2">Стоимость: {reforgeInfo ? formatMoney(reforgeInfo.cost) : 'расчёт...'}</p><p>Предыдущих перековок: {reforgeInfo?.reforgeCount || 0}</p></div>}<Button size="md" fullWidth className="mt-3" disabled={busy || !fromStat || !toStat || !reforgeInfo || character.money < reforgeInfo.cost} onClick={runReforge}>{busy ? 'Перековка...' : 'Перековать'}</Button></Card>}</div>}

    {tab === 'salvage' && <div className="space-y-4"><Card><h2 className="font-bold">Разборка</h2><p className="text-xs text-[var(--color-text-muted)]">Предмет превращается в материал своей редкости. Камни улучшения разбирать нельзя.</p></Card><Card><h3 className="font-bold text-sm mb-2">Выберите предметы</h3><EquipmentGrid {...gridTooltipProps} items={equipment} selected={salvageSelected} multi onSelect={item => setSalvageSelected(prev => { const next = new Set(prev); const id = String(item.id); if (next.has(id)) next.delete(id); else next.add(id); return next; })} /></Card><Button variant="danger" size="md" fullWidth disabled={busy || !salvageSelected.size} onClick={runSalvage}>{busy ? 'Разборка...' : `Разобрать${salvageSelected.size ? ` (${salvageSelected.size})` : ''}`}</Button></div>}

    {craftResult && <CraftPopup result={craftResult} onDone={() => { if (!randomCurseRoll) { showToast(craftResult.message, craftResult.success ? 'success' : 'warning'); setCurseItems(new Set()); setCurseCrystal(null); } setCraftResult(null); }} />}
    {randomCurseRoll && !craftResult && <div className="fixed inset-0 z-[1100] flex items-center justify-center"><div className="absolute inset-0 bg-black/60" /><Card className="relative max-w-sm w-full mx-4 text-center"><h3 className="font-bold mb-3">Результат проклятия</h3>{randomCurseRoll.oldCurse && <p className="text-xs mb-2">Текущее: +{randomCurseRoll.oldCurse.value} {randomCurseRoll.oldCurse.statName}, ранг {randomCurseRoll.oldCurse.name}</p>}<p className="text-xs mb-4" style={{ color: randomCurseRoll.newCurse.color }}>Новое: +{randomCurseRoll.newCurse.value} {randomCurseRoll.newCurse.statName}, ранг {randomCurseRoll.newCurse.name}</p>{randomCurseRoll.oldCurse ? <div className="flex gap-2 justify-center"><Button size="md" variant="secondary" disabled={busy} onClick={() => resolveRandomCurse(true)}>Оставить старое</Button><Button size="md" variant="danger" disabled={busy} onClick={() => resolveRandomCurse(false)}>Заменить</Button></div> : <Button size="md" disabled={busy} onClick={() => resolveRandomCurse(false)}>Применить</Button>}</Card></div>}
    {progressState && <OperationProgressModal {...progressState} stopping={stopRequestedRef.current} onStepDone={() => operationContinueRef.current?.()} onStop={() => { stopRequestedRef.current = true; setProgressState(prev => prev && ({ ...prev })); }} />}
    {tooltip && <ItemTooltip item={tooltip.item} position={{ x: tooltip.x, y: tooltip.y }} />}
  </div>;
}
