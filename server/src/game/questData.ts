// Общие данные квестов — используется и роутами, и websocket (serverTick)

export const QUEST_TYPES = ['hunt', 'arena', 'job', 'craft', 'auction'] as const;
export type QuestType = typeof QUEST_TYPES[number];

export const QUEST_INFO: Record<QuestType, { name: string; icon: string; desc: (req: number, diff: string) => string }> = {
    hunt: { name: 'Крысиный мор', icon: '🗡️', desc: (r, d) => `Убить ${r} мобов` },
    arena: { name: 'Первая кровь', icon: '⚔️', desc: (r, d) => `Одержать ${r} PvP-побед` },
    job: { name: 'Медяки в карман', icon: '🌍', desc: (r, d) => {
        if (d === 'easy') return 'Провести 10 минут на работах';
        if (d === 'medium') return 'Провести 1 час на работах';
        return 'Провести 4 часа на работах';
    }},
    craft: { name: 'Проба пера', icon: '⚒️', desc: (r, d) => `Создать или улучшить ${r} предметов` },
    auction: { name: 'Ставка сделана', icon: '💰', desc: (r, d) => `Совершить ${r} сделок на аукционе` },
};

export const DIFFICULTIES = {
    easy:   { label: '⭐ Простой',    rewardXpMult: 1, rewardMoneyMult: 1,  req: { hunt: 3,    arena: 1,  job: 600,  craft: 1, auction: 1 } } as const,
    medium: { label: '⭐⭐ Средний',   rewardXpMult: 2, rewardMoneyMult: 5,  req: { hunt: 15,   arena: 5,  job: 3600, craft: 3, auction: 3 } } as const,
    hard:   { label: '⭐⭐⭐ Сложный',  rewardXpMult: 3, rewardMoneyMult: 10, req: { hunt: 75,   arena: 25, job: 14400,craft: 6, auction: 6 } } as const,
} as const;

export type DiffKey = keyof typeof DIFFICULTIES;

export const BASE_REWARDS: Record<QuestType, { xp: number; money: number }> = {
    hunt: { xp: 10, money: 30 }, arena: { xp: 15, money: 40 },
    job: { xp: 8, money: 20 }, craft: { xp: 10, money: 25 }, auction: { xp: 12, money: 50 },
};

export async function getToday(): Promise<string> {
    return new Date().toISOString().slice(0, 10);
}

export async function getMidnightTS(): Promise<number> {
    const d = new Date();
    d.setUTCHours(24, 0, 0, 0);
    return Math.floor(d.getTime() / 1000);
}

import { db } from '../db/index';

export async function getSnapshot(userId: number): Promise<Record<string, number>> {
    const u = await db.one(
        'SELECT pveWins, wins, craftCount, auctionTrades, totalJobSeconds FROM users WHERE id = ?',
        [userId]
    ) as any;
    return {
        pve: u?.pveWins || 0,
        pvpWins: u?.wins || 0,
        craft: u?.craftCount || 0,
        auction: u?.auctionTrades || 0,
        jobSec: u?.totalJobSeconds || 0,
    };
}

export async function getProgress(userId: number, snapshot: any, questType: QuestType): Promise<number> {
    const u = await db.one(
        'SELECT pveWins, wins, craftCount, auctionTrades, totalJobSeconds FROM users WHERE id = ?',
        [userId]
    ) as any;
    const s = typeof snapshot === 'string' ? JSON.parse(snapshot) : snapshot;
    switch (questType) {
        case 'hunt': return (u?.pveWins || 0) - (s.pve || 0);
        case 'arena': return (u?.wins || 0) - (s.pvpWins || 0);
        case 'craft': return (u?.craftCount || 0) - (s.craft || 0);
        case 'auction': return (u?.auctionTrades || 0) - (s.auction || 0);
        case 'job': return (u?.totalJobSeconds || 0) - (s.jobSec || 0);
        default: return 0;
    }
}
