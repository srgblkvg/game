import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

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
  lastPveAttackTime?: number;
  lastBankVisit?: number;
  bank?: number;
  guildId?: number | null;
  guildName?: string | null;
  avatar?: string | null;
  elo?: number;
  pveRating?: number;
}

interface GameContextType {
  character: Character | null;
  setCharacter: React.Dispatch<React.SetStateAction<Character | null>>;
  serverTime: number;
}

const GameContext = createContext<GameContextType | null>(null);

// HP regen snapshot: { hp, time } — обновляется при setCharacter
let _hpSnapshot = { hp: 100, time: Math.floor(Date.now() / 1000) };

/** Вычислить текущий HP с учётом регенерации (1 HP / 10 сек, ×rate от комнаты) */
export function getRegenHp(currentHp: number, maxHp: number, serverTime: number, roomType?: string | null, roomUntil?: number): number {
  const elapsed = serverTime - _hpSnapshot.time;
  if (elapsed <= 0) return Math.min(currentHp, maxHp);

  // Базовый реген: 1 HP каждые 10 секунд
  let regenRate = 1;
  if (roomType && roomUntil && roomUntil > serverTime) {
    if (roomType === 'closet') regenRate = 3;
    else if (roomType === 'bed') regenRate = 10;
    else if (roomType === 'chamber') regenRate = 50;
  }

  const regenAmount = Math.floor(elapsed / 10) * regenRate;
  return Math.min(maxHp, _hpSnapshot.hp + regenAmount);
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [character, setCharacter] = useState<Character | null>(null);
  const [serverTime, setServerTime] = useState(Math.floor(Date.now() / 1000));

  // Обновляем снапшот HP при изменении character
  useEffect(() => {
    if (character) {
      _hpSnapshot = { hp: character.currentHp, time: character.lastHpUpdate || serverTime };
    }
  }, [character]);

  useEffect(() => {
    const handler = (e: Event) => setServerTime((e as CustomEvent).detail);
    window.addEventListener('serverTick', handler as EventListener);
    return () => window.removeEventListener('serverTick', handler as EventListener);
  }, []);

  return (
    <GameContext.Provider value={{ character, setCharacter, serverTime }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
