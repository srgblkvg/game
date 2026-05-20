import { z } from 'zod';

// Авторизация
export const registerSchema = z.object({
    username: z.string().min(3).max(20).regex(/^[a-zA-Zа-яА-Я0-9_]+$/, 'Только буквы, цифры и _'),
    password: z.string().min(4).max(64),
});

export const loginSchema = z.object({
    username: z.string().min(1),
    password: z.string().min(1),
});

// Бой
export const battleSchema = z.object({
    opponentId: z.number().int().positive().nullable().optional(),
});

// Арена: вход (без тела, но схема для платёжного запроса)
export const arenaEnterSchema = z.object({});

// Магазин: покупка
export const buyItemSchema = z.object({
    itemId: z.number().int().positive(),
});

// Работы: начать
export const startJobSchema = z.object({
    jobId: z.number().int().positive(),
});

// Админка: предметы
export const createItemSchema = z.object({
    name: z.string().min(1).max(100),
    slot: z.enum(['helmet', 'chest', 'gloves', 'boots', 'amulet', 'ring1', 'ring2', 'belt', 'weapon1', 'weapon2']),
    rarity: z.number().int().min(0).max(6),
    bonuses: z.object({
        s: z.number().int().min(0).max(9999).optional(),
        a: z.number().int().min(0).max(9999).optional(),
        d: z.number().int().min(0).max(9999).optional(),
        m: z.number().int().min(0).max(9999).optional(),
    }).optional(),
    extra: z.object({
        stamReg: z.number().int().min(0).max(100).optional(),
        crit: z.number().int().min(0).max(100).optional(),
        dodge: z.number().int().min(0).max(100).optional(),
        counter: z.number().int().min(0).max(100).optional(),
        fullBlock: z.number().int().min(0).max(100).optional(),
        hpRegen: z.number().int().min(0).max(100).optional(),
    }).optional(),
    image: z.string().nullable().optional(),
});

// Админка: работы
export const createJobSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional().default(''),
    duration: z.number().int().min(1),
    rewardMin: z.number().int().min(0),
    rewardMax: z.number().int().min(0),
});

// Пополнение баланса
export const addMoneySchema = z.object({
    userId: z.number().int().positive(),
    amount: z.number().int().finite(),
});

// Сброс таймеров
export const resetTimersSchema = z.object({
    userId: z.number().int().positive().optional(),
    all: z.boolean().optional(),
});

// Смена имени/пароля
export const changeUsernameSchema = z.object({
    newUsername: z.string().min(3).max(20).regex(/^[a-zA-Zа-яА-Я0-9_]+$/),
});

export const changePasswordSchema = z.object({
    oldPassword: z.string(),
    newPassword: z.string().min(4).max(64),
});