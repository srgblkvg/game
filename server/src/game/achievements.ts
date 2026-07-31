// Achievement track definitions
export interface AchievementTier {
    tier: number;       // 1-5
    name: string;       // 'Бронза'
    icon: string;       // '🥉'
    threshold: number;  // progress needed
}

export interface AchievementTrack {
    key: string;
    name: string;
    icon: string;
    description: string;
    tiers: AchievementTier[];
}

export const ACHIEVEMENT_TRACKS: AchievementTrack[] = [
    {
        key: 'pvp_wins',
        name: 'PvP побед',
        icon: '⚔',
        description: 'Побеждайте других игроков на арене',
        tiers: [
            { tier: 1, name: 'Бронза', icon: '🥉', threshold: 10 },
            { tier: 2, name: 'Серебро', icon: '🥈', threshold: 250 },
            { tier: 3, name: 'Золото', icon: '🥇', threshold: 2500 },
            { tier: 4, name: 'Алмаз', icon: '💎', threshold: 25000 },
            { tier: 5, name: 'Легенда', icon: '👑', threshold: 100000 },
        ],
    },
    {
        key: 'pve_wins',
        name: 'PvE побед',
        icon: '🐺',
        description: 'Побеждайте монстров в бестиарии',
        tiers: [
            { tier: 1, name: 'Бронза', icon: '🥉', threshold: 10 },
            { tier: 2, name: 'Серебро', icon: '🥈', threshold: 500 },
            { tier: 3, name: 'Золото', icon: '🥇', threshold: 5000 },
            { tier: 4, name: 'Алмаз', icon: '💎', threshold: 50000 },
            { tier: 5, name: 'Легенда', icon: '👑', threshold: 250000 },
        ],
    },
    {
        key: 'craft',
        name: 'Крафт',
        icon: '🔨',
        description: 'Создавайте и улучшайте предметы',
        tiers: [
            { tier: 1, name: 'Бронза', icon: '🥉', threshold: 10 },
            { tier: 2, name: 'Серебро', icon: '🥈', threshold: 250 },
            { tier: 3, name: 'Золото', icon: '🥇', threshold: 1000 },
            { tier: 4, name: 'Алмаз', icon: '💎', threshold: 5000 },
            { tier: 5, name: 'Легенда', icon: '👑', threshold: 25000 },
        ],
    },
    {
        key: 'training',
        name: 'Тренировки',
        icon: '🏋️',
        description: 'Тренируйтесь в Лудусе',
        tiers: [
            { tier: 1, name: 'Бронза', icon: '🥉', threshold: 10 },
            { tier: 2, name: 'Серебро', icon: '🥈', threshold: 250 },
            { tier: 3, name: 'Золото', icon: '🥇', threshold: 1000 },
            { tier: 4, name: 'Алмаз', icon: '💎', threshold: 5000 },
            { tier: 5, name: 'Легенда', icon: '👑', threshold: 20000 },
        ],
    },
    {
        key: 'income',
        name: 'Серебро заработано',
        icon: '💰',
        description: 'Зарабатывайте серебро в боях, работах, квестах (донат и переводы не считаются)',
        tiers: [
            { tier: 1, name: 'Бронза', icon: '🥉', threshold: 5000 },
            { tier: 2, name: 'Серебро', icon: '🥈', threshold: 50000 },
            { tier: 3, name: 'Золото', icon: '🥇', threshold: 500000 },
            { tier: 4, name: 'Алмаз', icon: '💎', threshold: 5000000 },
            { tier: 5, name: 'Легенда', icon: '👑', threshold: 50000000 },
        ],
    },
    {
        key: 'casino',
        name: 'Казино',
        icon: '🎰',
        description: 'Играйте в азартные игры',
        tiers: [
            { tier: 1, name: 'Бронза', icon: '🥉', threshold: 10 },
            { tier: 2, name: 'Серебро', icon: '🥈', threshold: 250 },
            { tier: 3, name: 'Золото', icon: '🥇', threshold: 1000 },
            { tier: 4, name: 'Алмаз', icon: '💎', threshold: 5000 },
            { tier: 5, name: 'Легенда', icon: '👑', threshold: 20000 },
        ],
    },
    {
        key: 'massacre',
        name: 'ЛК',
        icon: '🩸',
        description: 'Выживайте в Кровавой лотерее',
        tiers: [
            { tier: 1, name: 'Бронза', icon: '🥉', threshold: 10 },
            { tier: 2, name: 'Серебро', icon: '🥈', threshold: 250 },
            { tier: 3, name: 'Золото', icon: '🥇', threshold: 1000 },
            { tier: 4, name: 'Алмаз', icon: '💎', threshold: 5000 },
            { tier: 5, name: 'Легенда', icon: '👑', threshold: 20000 },
        ],
    },
    {
        key: 'collection',
        name: 'Коллекция',
        icon: '📦',
        description: 'Собирайте предметы в коллекцию',
        tiers: [
            { tier: 1, name: 'Бронза', icon: '🥉', threshold: 10 },
            { tier: 2, name: 'Серебро', icon: '🥈', threshold: 50 },
            { tier: 3, name: 'Золото', icon: '🥇', threshold: 100 },
            { tier: 4, name: 'Алмаз', icon: '💎', threshold: 150 },
            { tier: 5, name: 'Легенда', icon: '👑', threshold: 225 },
        ],
    },
    {
        key: 'auction',
        name: 'Аукцион',
        icon: '📦',
        description: 'Продавайте предметы на аукционе',
        tiers: [
            { tier: 1, name: 'Бронза', icon: '🥉', threshold: 10 },
            { tier: 2, name: 'Серебро', icon: '🥈', threshold: 250 },
            { tier: 3, name: 'Золото', icon: '🥇', threshold: 1000 },
            { tier: 4, name: 'Алмаз', icon: '💎', threshold: 5000 },
            { tier: 5, name: 'Легенда', icon: '👑', threshold: 20000 },
        ],
    },
    {
        key: 'tournament',
        name: 'Турниры',
        icon: '🏆',
        description: 'Побеждайте в турнирах',
        tiers: [
            { tier: 1, name: 'Бронза', icon: '🥉', threshold: 10 },
            { tier: 2, name: 'Серебро', icon: '🥈', threshold: 50 },
            { tier: 3, name: 'Золото', icon: '🥇', threshold: 250 },
            { tier: 4, name: 'Алмаз', icon: '💎', threshold: 1000 },
            { tier: 5, name: 'Легенда', icon: '👑', threshold: 2500 },
        ],
    },
    {
        key: 'level',
        name: 'Уровень',
        icon: '⭐',
        description: 'Повышайте уровень персонажа',
        tiers: [
            { tier: 1, name: 'Бронза', icon: '🥉', threshold: 10 },
            { tier: 2, name: 'Серебро', icon: '🥈', threshold: 25 },
            { tier: 3, name: 'Золото', icon: '🥇', threshold: 50 },
            { tier: 4, name: 'Алмаз', icon: '💎', threshold: 75 },
            { tier: 5, name: 'Легенда', icon: '👑', threshold: 100 },
        ],
    },
];

export const TRACK_MAP = new Map(ACHIEVEMENT_TRACKS.map(t => [t.key, t]));

export function getTrackTier(track: AchievementTrack, progress: number): AchievementTier | null {
    let best: AchievementTier | null = null;
    for (const tier of track.tiers) {
        if (progress >= tier.threshold) best = tier;
    }
    return best;
}

export function getTrackProgress(tier: AchievementTier | null, next: AchievementTier | undefined): { current: number; next: number; pct: number } {
    const current = tier ? tier.threshold : 0;
    const nextVal = next ? next.threshold : current;
    return { current, next: nextVal, pct: nextVal > current ? 0 : 100 };
}
