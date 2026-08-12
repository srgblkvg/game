"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupRoutes = setupRoutes;
const auth_1 = require("./middleware/auth");
const guestCooldown_1 = require("./middleware/guestCooldown");
const index_1 = require("./db/index");
const auth_2 = __importDefault(require("./routes/auth"));
const adminAuth_1 = __importDefault(require("./routes/adminAuth"));
const admin_1 = __importDefault(require("./routes/admin"));
const adminCraft_1 = __importDefault(require("./routes/adminCraft"));
const adminJobs_1 = __importDefault(require("./routes/adminJobs"));
const adminChat_1 = __importDefault(require("./routes/adminChat"));
const battle_1 = __importStar(require("./routes/battle"));
const character_1 = __importDefault(require("./routes/character"));
const inventory_1 = __importDefault(require("./routes/inventory"));
const users_1 = __importDefault(require("./routes/users"));
const rating_1 = __importDefault(require("./routes/rating"));
const characterStats_1 = __importDefault(require("./routes/characterStats"));
const arena_1 = __importDefault(require("./routes/arena"));
const shop_1 = __importDefault(require("./routes/shop"));
const jobs_1 = __importDefault(require("./routes/jobs"));
const account_1 = __importDefault(require("./routes/account"));
const chat_1 = __importDefault(require("./routes/chat"));
const craft_1 = __importDefault(require("./routes/craft"));
const oauth_1 = __importDefault(require("./routes/oauth"));
const mobs_1 = __importDefault(require("./routes/mobs"));
const bank_1 = __importDefault(require("./routes/bank"));
const tavern_1 = __importDefault(require("./routes/tavern"));
const auction_1 = __importDefault(require("./routes/auction"));
const tournament_1 = __importDefault(require("./routes/tournament"));
const adminTournament_1 = __importDefault(require("./routes/adminTournament"));
const log_1 = __importDefault(require("./routes/log"));
const quests_1 = __importDefault(require("./routes/quests"));
const guild_1 = __importDefault(require("./routes/guild"));
const feedback_1 = __importStar(require("./routes/feedback"));
const adminGame_1 = __importDefault(require("./routes/adminGame"));
const actions_1 = __importDefault(require("./routes/actions"));
const collections_1 = __importDefault(require("./routes/collections"));
const adminCollections_1 = __importDefault(require("./routes/adminCollections"));
const adminBots_1 = __importDefault(require("./routes/adminBots"));
const guildBuildings_1 = __importDefault(require("./routes/guildBuildings"));
const guildBoss_1 = __importDefault(require("./routes/guildBoss"));
const battleSim_1 = __importDefault(require("./routes/battleSim"));
const overflow_1 = __importDefault(require("./routes/overflow"));
const vkPayments_1 = __importDefault(require("./routes/vkPayments"));
const vkBridgeAuth_1 = __importDefault(require("./routes/vkBridgeAuth"));
const yukassa_1 = __importDefault(require("./routes/yukassa"));
const treasury_1 = __importDefault(require("./routes/treasury"));
const forum_1 = __importDefault(require("./routes/forum"));
const massacre_1 = __importDefault(require("./routes/massacre"));
const casino_1 = __importDefault(require("./routes/casino"));
const dice_1 = __importDefault(require("./routes/dice"));
const training_1 = __importDefault(require("./routes/training"));
const donate_1 = __importDefault(require("./routes/donate"));
const tutorial_1 = __importDefault(require("./routes/tutorial"));
const achievements_1 = __importDefault(require("./routes/achievements"));
const debug_1 = __importDefault(require("./routes/debug"));
const faction_1 = __importDefault(require("./routes/faction"));
const dungeon_1 = __importDefault(require("./routes/dungeon"));
function setupRoutes(app) {
    // Публичные маршруты
    app.use('/api', auth_2.default);
    app.use('/api', adminAuth_1.default);
    app.use('/api/oauth', oauth_1.default);
    // Действия (публичный)
    app.use('/api', actions_1.default);
    // Казна замка (публичный)
    app.use('/api', treasury_1.default);
    // Форум — последние темы (публичный, для замка)
    app.get('/api/forum/latest', async (_req, res) => {
        const { db } = await Promise.resolve().then(() => __importStar(require('./db/index')));
        const threads = await db.query(`
      SELECT t.*, u.username as author_name,
             lp.username as last_poster_name
      FROM forum_threads t
      JOIN users u ON t.author_id = u.id
      LEFT JOIN users lp ON (SELECT author_id FROM forum_posts WHERE thread_id = t.id ORDER BY created_at DESC LIMIT 1) = lp.id
      ORDER BY t.updated_at DESC LIMIT 3
    `, []);
        res.json(threads);
    });
    // Этажи (публичный — нужен бестиарию)
    app.get('/api/floors', async (_req, res) => {
        const rows = await index_1.db.query('SELECT * FROM floors ORDER BY sort_order, name');
        const DIFF_MAP = {
            'Склеп': 0, 'Подземелье': 0, 'Катакомбы': 0, 'Деревня Пепла': 0,
            'Лес Черепов': 1, 'Старый Тракт': 1, 'Ядовитые луга': 1, 'Первый ярус': 1,
            'Гнилая Топь': 2, 'Чёрный Монастырь': 2, 'Башня Плакальщиц': 2, 'Некрополь Королей': 2,
            'Бездонный Овраг': 3, 'Врата Бездны': 3,
            'Огненные чертоги': 4, 'Тронный зал': 4,
            'Ледяная бездна': 5, 'Престол падших': 5,
            'Кровавый предел': 6, 'Трон Проклятых': 6,
        };
        const DIFF_LABELS = ['Легко', 'Нормально', 'Сложно', 'Ад I', 'Ад II', 'Ад III', 'Ад IV'];
        const DIFF_ICONS = ['🟢', '🟡', '🟠', '🔴', '🔴', '🔴', '🔴'];
        const floors = rows.map(r => ({ ...r, difficulty: DIFF_MAP[r.name] ?? 0 }));
        const groups = DIFF_LABELS.map((label, i) => ({ label, icon: DIFF_ICONS[i], difficulty: i }));
        res.json({ floors, groups });
    });
    // Серверное время (публичный)
    app.get('/api/time', (_req, res) => {
        res.json({ now: Math.floor(Date.now() / 1000) });
    });
    // Приём клиентских ошибок (можно без авторизации — логируем всё)
    app.use('/api/log', log_1.default);
    // VK Payments — публичный колбэк (без middleware, подпись проверяется внутри)
    app.use('/api/vk/payments', vkPayments_1.default);
    // YooKassa webhook — публичный (без middleware)
    app.use('/api/yukassa', yukassa_1.default);
    // Админские маршруты
    app.use('/api/admin', auth_1.authMiddleware, auth_1.requireAdmin, admin_1.default);
    // VK Bridge Auth (публичный, проверка токена внутри)
    app.use('/api/auth', vkBridgeAuth_1.default);
    app.use('/api/admin', auth_1.authMiddleware, auth_1.requireAdmin, adminCraft_1.default);
    app.use('/api/admin', auth_1.authMiddleware, auth_1.requireAdmin, adminJobs_1.default);
    app.use('/api/admin/chat', auth_1.authMiddleware, auth_1.requireAdmin, adminChat_1.default);
    app.use('/api/admin', auth_1.authMiddleware, auth_1.requireAdmin, battle_1.adminRouter);
    app.use('/api/admin', auth_1.authMiddleware, auth_1.requireAdmin, adminTournament_1.default);
    app.use('/api/admin', auth_1.authMiddleware, auth_1.requireAdmin, adminGame_1.default);
    app.use('/api/admin', auth_1.authMiddleware, auth_1.requireAdmin, feedback_1.adminFeedbackRouter);
    app.use('/api/admin', auth_1.authMiddleware, auth_1.requireAdmin, adminCollections_1.default);
    app.use('/api/admin', auth_1.authMiddleware, auth_1.requireAdmin, adminBots_1.default);
    // Тоггл гостевых ограничений
    app.post('/api/admin/toggle-guest', auth_1.authMiddleware, auth_1.requireAdmin, (req, res) => {
        const disabled = (0, auth_1.toggleGuestRestrictions)();
        res.json({ guestRestrictionsDisabled: disabled });
    });
    // Игровые маршруты (только для игроков) + замедление гостей
    app.use('/api', auth_1.authMiddleware, auth_1.requirePlayer, guestCooldown_1.guestCooldown);
    app.use('/api', battleSim_1.default); // симулятор боёв
    app.use('/api', character_1.default);
    app.use('/api', inventory_1.default);
    app.use('/api', users_1.default);
    app.use('/api', rating_1.default);
    app.use('/api', characterStats_1.default);
    app.use('/api', battle_1.default);
    app.use('/api', arena_1.default);
    app.use('/api', shop_1.default);
    app.use('/api', jobs_1.default);
    app.use('/api', account_1.default);
    app.use('/api', chat_1.default);
    app.use('/api', craft_1.default);
    app.use('/api', mobs_1.default);
    app.use('/api', bank_1.default);
    app.use('/api', tavern_1.default);
    app.use('/api', auction_1.default);
    app.use('/api', quests_1.default);
    // Гильд-босс напрямую (до guildRoutes с /guild/:id)
    app.get('/api/guild/boss/ping', (_req, res) => { res.json({ ok: true }); });
    app.use('/api', guildBoss_1.default);
    app.use('/api', guild_1.default);
    app.use('/api', guildBuildings_1.default);
    app.use('/api', feedback_1.default);
    app.use('/api', tournament_1.default);
    app.use('/api', collections_1.default);
    app.use('/api/overflow', overflow_1.default);
    app.use('/api', forum_1.default);
    app.use('/api', massacre_1.default);
    app.use('/api', casino_1.default);
    app.use('/api', dice_1.default);
    app.use('/api', training_1.default);
    app.use('/api', tutorial_1.default);
    app.use('/api', achievements_1.default);
    app.use('/api', debug_1.default);
    app.use('/api', faction_1.default);
    app.use('/api', dungeon_1.default);
    app.use('/api/donate', donate_1.default);
    // Маршруты с полным доступом (гости заблокированы)
    app.use('/api', auth_1.authMiddleware, auth_1.requirePlayer, auth_1.requireFullAccess, guestCooldown_1.guestCooldown);
}
//# sourceMappingURL=setupRoutes.js.map