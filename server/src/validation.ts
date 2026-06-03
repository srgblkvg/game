import { z } from 'zod';

// Авторизация
export const registerSchema = z.object({
  username: z.string().min(3).max(20).regex(/^[a-zA-Zа-яА-Я0-9_]+$/, 'Только буквы, цифры и _'),
  email: z.string().email('Некорректный email').max(255),
  password: z.string().min(8, 'Минимум 8 символов').max(64)
    .regex(/[0-9]/, 'Пароль должен содержать хотя бы одну цифру')
    .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/, 'Пароль должен содержать хотя бы один спецсимвол'),
});

export const verifyEmailSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
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

// Админка: предметы (теперь rarity_id вместо rarity)
export const createItemSchema = z.object({
  name: z.string().min(1).max(100),
  slot: z.enum(['helmet', 'chest', 'gloves', 'boots', 'amulet', 'ring', 'belt', 'weapon1', 'shield']),
  rarity_id: z.number().int().min(0).max(6),
  bonuses: z.object({
    s: z.number().int().min(0).max(9999).optional(),
    a: z.number().int().min(0).max(9999).optional(),
    d: z.number().int().min(0).max(9999).optional(),
    m: z.number().int().min(0).max(9999).optional(),
  }).optional(),
  extra: z.object({
    crit: z.number().int().min(0).max(100).optional(),
    dodge: z.number().int().min(0).max(100).optional(),
    counter: z.number().int().min(0).max(100).optional(),
    fullBlock: z.number().int().min(0).max(100).optional(),
  }).optional(),
  cost: z.number().int().min(0).max(999999).nullable().optional(),
  image: z.string().max(500).nullable().optional(),
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
  newPassword: z.string().min(8, 'Минимум 8 символов').max(64)
    .regex(/[0-9]/, 'Пароль должен содержать хотя бы одну цифру')
    .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/, 'Пароль должен содержать хотя бы один спецсимвол'),
});

// WebSocket сообщения
export const wsPublicMessageSchema = z.object({
  type: z.literal('public'),
  content: z.string().min(1, 'Сообщение не может быть пустым').max(500, 'Сообщение слишком длинное'),
});

export const wsPrivateMessageSchema = z.object({
  type: z.literal('private'),
  targetUserId: z.number().int().positive(),
  content: z.string().min(1).max(500),
});

export const wsItemLinkSchema = z.object({
  type: z.literal('itemLink'),
  itemId: z.number().int().positive().optional(),
  itemData: z.any().optional(),
});
