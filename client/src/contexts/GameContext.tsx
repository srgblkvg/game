import { createContext, useContext, useState, type ReactNode } from 'react';

interface GameItem {
  id: string;
  name: string;
  slot: string;
  rarity: number;
  bonuses: { s: number; a: number; d: number; m: number };
  extra: { stamReg: number; crit: number; dodge: number; counter: number; fullBlock: number; hpRegen: number };
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
  inventory: (GameItem | { type: 'material'; rarity: number; count: number; name: string; id: string })[];
  equipment: Record<string, GameItem>;
  baseStats: { s: number; a: number; v: number; d: number; m: number };
  currentHp: number;
  stats?: {
    s: number;
    a: number;
    d: number;
    m: number;
    v: number;
    hp: number;
    maxStamina: number;
    regen: number;
    attackCost: number;
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
  } | null;
  openPrivateTabs?: number[];
  gender?: string;
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