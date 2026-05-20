"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config(); // загружаем .env, если вдруг env.ts ещё не загружен (на всякий случай)
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const compression_1 = __importDefault(require("compression"));
const http_1 = __importDefault(require("http"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const zod_1 = require("zod");
const logger_1 = __importDefault(require("./logger"));
const auth_1 = require("./middleware/auth");
const websocket_1 = require("./websocket");
const env_1 = require("./env");
const auth_2 = __importDefault(require("./routes/auth"));
const adminAuth_1 = __importDefault(require("./routes/adminAuth"));
const character_1 = __importDefault(require("./routes/character"));
const battle_1 = __importDefault(require("./routes/battle"));
const arena_1 = __importDefault(require("./routes/arena"));
const shop_1 = __importDefault(require("./routes/shop"));
const jobs_1 = __importDefault(require("./routes/jobs"));
const admin_1 = __importDefault(require("./routes/admin"));
const adminJobs_1 = __importDefault(require("./routes/adminJobs"));
const adminChat_1 = __importDefault(require("./routes/adminChat"));
const account_1 = __importDefault(require("./routes/account"));
const chat_1 = __importDefault(require("./routes/chat"));
const adminCraft_1 = __importDefault(require("./routes/adminCraft"));
const craft_1 = __importDefault(require("./routes/craft"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use((0, compression_1.default)());
app.use(express_1.default.json());
// Rate limiting на логин и регистрацию (можно отключить переменной DISABLE_RATE_LIMIT=true в .env)
if (!process.env.DISABLE_RATE_LIMIT) {
    const authLimiter = (0, express_rate_limit_1.default)({
        windowMs: 15 * 60 * 1000, // 15 минут
        max: 20, // максимум 20 попыток с одного IP
        message: { error: 'Слишком много попыток, попробуйте позже' },
        standardHeaders: true,
        legacyHeaders: false,
    });
    app.use('/api/login', authLimiter);
    app.use('/api/register', authLimiter);
    app.use('/api/admin/register', authLimiter);
}
// Публичные маршруты
app.use('/api', auth_2.default);
app.use('/api', adminAuth_1.default);
// Админские маршруты (до requirePlayer)
app.use('/api/admin', auth_1.authMiddleware, auth_1.requireAdmin, admin_1.default);
app.use('/api/admin', auth_1.authMiddleware, auth_1.requireAdmin, adminCraft_1.default);
app.use('/api/admin', auth_1.authMiddleware, auth_1.requireAdmin, adminJobs_1.default);
app.use('/api/admin/chat', auth_1.authMiddleware, auth_1.requireAdmin, adminChat_1.default);
// Игровые маршруты (только для игроков)
app.use('/api', auth_1.authMiddleware, auth_1.requirePlayer);
app.use('/api', character_1.default);
app.use('/api', battle_1.default);
app.use('/api', arena_1.default);
app.use('/api', shop_1.default);
app.use('/api', jobs_1.default);
app.use('/api', account_1.default);
app.use('/api', chat_1.default);
app.use('/api', auth_1.authMiddleware, auth_1.requirePlayer, craft_1.default);
// Централизованная обработка ошибок валидации
app.use((err, req, res, next) => {
    if (err instanceof zod_1.z.ZodError) {
        return res.status(400).json({ error: 'Ошибка валидации', details: err.issues });
    }
    logger_1.default.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});
const server = http_1.default.createServer(app);
(0, websocket_1.setupWebSocket)(server);
server.listen(env_1.PORT, () => logger_1.default.info(`Server started on port ${env_1.PORT}`));
//# sourceMappingURL=index.js.map