"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerGuestSchema = exports.wsItemLinkSchema = exports.wsPrivateMessageSchema = exports.wsPublicMessageSchema = exports.changePasswordSchema = exports.changeUsernameSchema = exports.resetTimersSchema = exports.addMoneySchema = exports.createJobSchema = exports.createItemSchema = exports.startJobSchema = exports.buyItemSchema = exports.arenaEnterSchema = exports.battleSchema = exports.loginSchema = exports.verifyEmailSchema = exports.registerSchema = void 0;
const zod_1 = require("zod");
// Авторизация
exports.registerSchema = zod_1.z.object({
    username: zod_1.z.string().min(3).max(20).regex(/^[a-zA-Zа-яА-Я0-9_]+$/, 'Только буквы, цифры и _'),
    email: zod_1.z.string().email('Некорректный email').max(255),
    password: zod_1.z.string().min(8, 'Минимум 8 символов').max(64)
        .regex(/[0-9]/, 'Пароль должен содержать хотя бы одну цифру')
        .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/, 'Пароль должен содержать хотя бы один спецсимвол'),
});
exports.verifyEmailSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    code: zod_1.z.string().length(6),
});
exports.loginSchema = zod_1.z.object({
    username: zod_1.z.string().min(1),
    password: zod_1.z.string().min(1),
});
// Бой
exports.battleSchema = zod_1.z.object({
    opponentId: zod_1.z.number().int().positive().nullable().optional(),
});
// Арена: вход (без тела, но схема для платёжного запроса)
exports.arenaEnterSchema = zod_1.z.object({});
// Магазин: покупка
exports.buyItemSchema = zod_1.z.object({
    itemId: zod_1.z.number().int().positive(),
});
// Работы: начать
exports.startJobSchema = zod_1.z.object({
    jobId: zod_1.z.number().int().positive(),
});
// Админка: предметы (теперь rarity_id вместо rarity)
exports.createItemSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
    slot: zod_1.z.enum(['helmet', 'chest', 'gloves', 'boots', 'amulet', 'ring', 'belt', 'weapon1', 'shield']),
    rarity_id: zod_1.z.number().int().min(0).max(6),
    bonuses: zod_1.z.object({
        s: zod_1.z.number().int().min(0).max(9999).optional(),
        a: zod_1.z.number().int().min(0).max(9999).optional(),
        d: zod_1.z.number().int().min(0).max(9999).optional(),
        m: zod_1.z.number().int().min(0).max(9999).optional(),
    }).optional(),
    extra: zod_1.z.object({
        crit: zod_1.z.number().int().min(0).max(100).optional(),
        dodge: zod_1.z.number().int().min(0).max(100).optional(),
        counter: zod_1.z.number().int().min(0).max(100).optional(),
        fullBlock: zod_1.z.number().int().min(0).max(100).optional(),
    }).optional(),
    cost: zod_1.z.number().int().min(0).max(999999).nullable().optional(),
    image: zod_1.z.string().max(500).nullable().optional(),
});
// Админка: работы
exports.createJobSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
    description: zod_1.z.string().max(500).optional().default(''),
    duration: zod_1.z.number().int().min(1),
    rewardMin: zod_1.z.number().int().min(0),
    rewardMax: zod_1.z.number().int().min(0),
});
// Пополнение баланса
exports.addMoneySchema = zod_1.z.object({
    userId: zod_1.z.number().int().positive(),
    amount: zod_1.z.number().int().finite(),
});
// Сброс таймеров
exports.resetTimersSchema = zod_1.z.object({
    userId: zod_1.z.number().int().positive().optional(),
    all: zod_1.z.boolean().optional(),
});
// Смена имени/пароля
exports.changeUsernameSchema = zod_1.z.object({
    newUsername: zod_1.z.string().min(3).max(20).regex(/^[a-zA-Zа-яА-Я0-9_]+$/),
});
exports.changePasswordSchema = zod_1.z.object({
    oldPassword: zod_1.z.string(),
    newPassword: zod_1.z.string().min(8, 'Минимум 8 символов').max(64)
        .regex(/[0-9]/, 'Пароль должен содержать хотя бы одну цифру')
        .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/, 'Пароль должен содержать хотя бы один спецсимвол'),
});
// WebSocket сообщения
exports.wsPublicMessageSchema = zod_1.z.object({
    type: zod_1.z.literal('public'),
    content: zod_1.z.string().min(1, 'Сообщение не может быть пустым').max(500, 'Сообщение слишком длинное'),
});
exports.wsPrivateMessageSchema = zod_1.z.object({
    type: zod_1.z.literal('private'),
    targetUserId: zod_1.z.number().int().positive(),
    content: zod_1.z.string().min(1).max(500),
});
exports.wsItemLinkSchema = zod_1.z.object({
    type: zod_1.z.literal('itemLink'),
    itemId: zod_1.z.number().positive().optional(),
    itemData: zod_1.z.any().optional(),
});
// Гостевая регистрация
exports.registerGuestSchema = zod_1.z.object({
    email: zod_1.z.string().email('Некорректный email'),
    password: zod_1.z.string().min(8, 'Минимум 8 символов').max(64)
        .regex(/[0-9]/, 'Пароль должен содержать хотя бы одну цифру')
        .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/, 'Пароль должен содержать хотя бы один спецсимвол'),
    code: zod_1.z.string().length(6),
});
//# sourceMappingURL=validation.js.map