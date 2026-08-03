import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';

interface GameItem {
  id?: string | number;
  name?: string;
  slot?: string;
  type?: string;
  count?: number;
  rarity_id?: number;
  rarity_display?: string;
  rarity_color?: string;
  bonuses?: { s: number; a: number; d: number; m: number };
  extra?: { crit: number; dodge: number; counter: number; fullBlock: number };
  upgradeLevel?: number;
  locked?: boolean;
}

export interface Character {
  id: number;
  username: string;
  level: number;
  exp: number;
  money: number;
  totalBattles: number;
  wins: number;
  inventory: (GameItem | {
    type: 'material' | 'craft_item';
    rarity_id: number;
    rarity_display?: string;
    rarity_color?: string;
    count: number;
    name: string;
    id: string;
    itemType?: string;
    image?: string;
    locked?: boolean;
  })[];
  equipment: Record<string, GameItem>;
  baseStats: { s: number; a: number; d: number; m: number };
  currentHp: number;
  lastHpUpdate?: number;
  stats?: {
    s: number;
    a: number;
    d: number;
    m: number;
    hp: number;
    bonuses?: { s: number; a: number; d: number; m: number };
    extra?: { crit: number; dodge: number; counter: number; fullBlock: number };
    drinks?: { s: number; a: number; d: number; m: number };
    collection?: number;
  };
  lastAttackTime: number;
  protectionUntil: number;
  inventorySlots?: number;
  activeJob?: {
    jobId: number;
    name: string;
    startTime: number;
    endTime: number;
    reward: number;
    duration: number;
    expReward?: number;
    rewardMin?: number;
    rewardMax?: number;
    background?: string | null;
    premiumBonus?: number;
  } | null;
  openPrivateTabs?: number[];
  gender?: string;
  statPoints?: number;
  drink?: { type: string; until: number } | null;
  room?: { type: string; until: number } | null;
  premium?: { until: number } | null;
  drinkBonuses?: { s: number; a: number; d: number; m: number };
  collectionCount?: number;
  guildBonus?: number;
  buildings?: { type: string; icon: string; label: string; level: number; bonus: number }[];
  collectedItems?: { itemName: string; slot: string }[];
  totalCollectionItems?: number;
  attackCooldownSec?: number;
  pveCooldownSec?: number;
  pvpCdSec?: number;
  pveCdSec?: number;
  lastPveAttackTime?: number;
  lastBankVisit?: number;
  bank?: number;
  guildId?: number | null;
  guildName?: string | null;
  avatar?: string | null;
  elo?: number;
  pveRating?: number;
  faction?: string | null;
  karma?: number;
  factionCraftCount?: number;
  banditReputation?: number;
  tutorialCompleted?: number;
  tutorialStep?: number;
  totalIncome?: number;
  overflowmoney?: number;
  achievements?: AchievementSummary[];
}

interface AchievementSummary {
  key: string;
  name: string;
  icon: string;
  progress: number;
  highestTier: number;
  currentTier: { tier: number; name: string; icon: string } | null;
}

interface GameContextType {
  character: Character | null;
  setCharacter: React.Dispatch<React.SetStateAction<Character | null>>;
  serverTime: number;
  /** Текущее HP с регенерацией — единое значение для всех компонентов */
  regenHp: number;
}

const GameContext = createContext<GameContextType | null>(null);

/** Вычислить HP с учётом регенерации (1 HP / 5 сек, ×rate от комнаты) */
function calcRegenHp(currentHp: number, maxHp: number, lastHpUpdate: number, serverTime: number, roomType?: string | null, roomUntil?: number, premiumUntil?: number): number {
  const elapsed = serverTime - lastHpUpdate;
  if (elapsed <= 0) return Math.min(currentHp, maxHp);

  let regenRate = 1;
  if (roomType && roomUntil && roomUntil > serverTime) {
    if (roomType === 'closet') regenRate = 3;
    else if (roomType === 'bed') regenRate = 10;
    else if (roomType === 'chamber') regenRate = 50;
  }
  if (premiumUntil && premiumUntil > serverTime) regenRate *= 3;

  const regenAmount = Math.floor(elapsed * regenRate / 5);
  return Math.min(maxHp, currentHp + regenAmount);
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [character, setCharacter] = useState<Character | null>(null);
  const [serverTime, setServerTime] = useState(Math.floor(Date.now() / 1000));
  const [regenHp, setRegenHp] = useState(100);

  // serverTick — обновляем время и HP с регенерацией
  useEffect(() => {
    const handler = (e: Event) => {
      const time = (e as CustomEvent).detail as number;
      setServerTime(time);
      // hpData приходит из ChatContext через отдельный канал
    };
    window.addEventListener('serverTick', handler as EventListener);
    return () => window.removeEventListener('serverTick', handler as EventListener);
  }, []);

  // hpTick — обновление currentHp/lastHpUpdate из serverTick
  useEffect(() => {
    const handler = (e: Event) => {
      // Во время боя не обновляем HP — чтобы не спойлерить исход
      if ((window as any).__battling) return;
      const { currentHp: hp, lastHpUpdate: lhu } = (e as CustomEvent).detail;
      setCharacter(prev => {
        if (!prev) return prev;
        if (hp !== undefined) {
          return { ...prev, currentHp: hp, lastHpUpdate: lhu ?? prev.lastHpUpdate };
        }
        return prev;
      });
    };
    window.addEventListener('hpTick', handler as EventListener);
    return () => window.removeEventListener('hpTick', handler as EventListener);
  }, []);

  // factionStats — динамическое обновление очков фракции из serverTick
  useEffect(() => {
    const handler = (e: Event) => {
      const { faction, karma, factionCraftCount, banditReputation } = (e as CustomEvent).detail;
      setCharacter(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          faction: faction ?? prev.faction,
          karma: karma ?? prev.karma,
          factionCraftCount: factionCraftCount ?? prev.factionCraftCount,
          banditReputation: banditReputation ?? prev.banditReputation,
        };
      });
    };
    window.addEventListener('factionStats', handler as EventListener);
    return () => window.removeEventListener('factionStats', handler as EventListener);
  }, []);

  // Пересчёт regenHp при изменении character или serverTime
  const frozenHp = useRef<number | null>(null);
  useEffect(() => {
    if (!character) return;
    // Во время боя замораживаем HP — чтобы не спойлерить исход
    if ((window as any).__battling) {
      if (frozenHp.current === null) frozenHp.current = character.currentHp;
      setRegenHp(frozenHp.current);
      return;
    }
    frozenHp.current = null;
    const maxHp = character.stats?.hp ?? 100;
    const hp = calcRegenHp(
      character.currentHp,
      maxHp,
      character.lastHpUpdate || serverTime,
      serverTime,
      character.room?.type,
      character.room?.until,
      character.premium?.until
    );
    setRegenHp(hp);
  }, [character?.currentHp, character?.lastHpUpdate, character?.room?.until, character?.premium?.until, serverTime]);

  return (
    <GameContext.Provider value={{ character, setCharacter, serverTime, regenHp }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
