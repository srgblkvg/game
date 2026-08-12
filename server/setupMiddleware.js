"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupMiddleware = setupMiddleware;
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const compression_1 = __importDefault(require("compression"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const zod_1 = require("zod");
const logger_1 = __importDefault(require("./logger"));
function setupMiddleware(app) {
    // Доверяем nginx прокси для корректной работы rate-limit и IP
    app.set('trust proxy', 1);
    app.use((0, helmet_1.default)({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false,
    }));
    app.use((0, cors_1.default)());
    app.use((0, compression_1.default)());
    app.use(express_1.default.json({ limit: '5mb' }));
    app.use(express_1.default.urlencoded({ extended: true }));
    app.use((0, cookie_parser_1.default)());
    // Rate limiting (можно отключить переменной DISABLE_RATE_LIMIT=true в .env)
    // Локальные запросы (боты, healthcheck) — без лимита
    const skipLocal = (req) => req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1';
    if (!process.env.DISABLE_RATE_LIMIT) {
        const authLimiter = (0, express_rate_limit_1.default)({
            windowMs: 15 * 60 * 1000,
            max: 20,
            message: { error: 'Слишком много попыток, попробуйте позже' },
            standardHeaders: true,
            legacyHeaders: false,
        });
        app.use('/api/login', authLimiter);
        app.use('/api/register', authLimiter);
        app.use('/api/guest', authLimiter);
        app.use('/api/admin/register', authLimiter);
        const battleLimiter = (0, express_rate_limit_1.default)({ windowMs: 60000, max: 30, skip: skipLocal, message: { error: 'Слишком много боёв, подождите' }, standardHeaders: true, legacyHeaders: false });
        const chatLimiter = (0, express_rate_limit_1.default)({ windowMs: 60000, max: 60, skip: skipLocal, message: { error: 'Слишком много сообщений, подождите' }, standardHeaders: true, legacyHeaders: false });
        const craftLimiter = (0, express_rate_limit_1.default)({ windowMs: 60000, max: 20, skip: skipLocal, message: { error: 'Слишком много крафтов, подождите' }, standardHeaders: true, legacyHeaders: false });
        const playerLimiter = (0, express_rate_limit_1.default)({ windowMs: 60000, max: 200, skip: skipLocal, message: { error: 'Слишком много запросов, подождите' }, standardHeaders: true, legacyHeaders: false });
        app.use('/api/battle', battleLimiter);
        app.use('/api/arena', battleLimiter);
        app.use('/api/chat', chatLimiter);
        app.use('/api/craft', craftLimiter);
        app.use('/api', playerLimiter);
    }
    // Централизованная обработка ошибок
    app.use((err, req, res, next) => {
        if (err instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Ошибка валидации', details: err.issues });
        }
        if (err && typeof err.status === 'number' && err.status >= 400) {
            return res.status(err.status).json({ error: err.message || 'Ошибка запроса' });
        }
        logger_1.default.error(err);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    });
}
//# sourceMappingURL=setupMiddleware.js.map