import { createContext, useContext, useState, type ReactNode } from 'react';

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
  stats?: {
    s: number;
    a: number;
    d: number;
    m: number;
    hp: number;
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
  } | null;
  openPrivateTabs?: number[];
  gender?: string;
  statPoints?: number;
  // Активные баффы (сервер возвращает)
  drink?: { type: string; until: number } | null;
  room?: { type: string; until: number } | null;
  premium?: { until: number } | null;
  drinkBonuses?: { s: number; a: number; d: number; m: number };
  collectionCount?: number;
  totalCollectionItems?: number;
  attackCooldownSec?: number;
  pveCooldownSec?: number;
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
}

const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [character, setCharacter] = useState<Character | null>(null);
  return (
    <GameContext.Provider value={{ character, setCharacter }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}