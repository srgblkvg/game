"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const http_1 = __importDefault(require("http"));
const setupMiddleware_1 = require("./setupMiddleware");
const setupRoutes_1 = require("./setupRoutes");
const websocket_1 = require("./websocket");
const env_1 = require("./env");
const logger_1 = __importDefault(require("./logger"));
const app = (0, express_1.default)();
// Статические файлы (аватары)
app.use('/uploads', express_1.default.static(path_1.default.resolve(__dirname, '../uploads')));
(0, setupMiddleware_1.setupMiddleware)(app);
(0, setupRoutes_1.setupRoutes)(app);
const server = http_1.default.createServer(app);
(0, websocket_1.setupWebSocket)(server);
server.listen(env_1.PORT, () => logger_1.default.info(`Server started on port ${env_1.PORT}`));
// ── Schedulers ──
const salary_1 = require("./schedulers/salary");
const tournaments_1 = require("./schedulers/tournaments");
const cleanup_1 = require("./schedulers/cleanup");
const massacre_1 = require("./schedulers/massacre");
const inactiveLeader_1 = require("./schedulers/inactiveLeader");
const jobs_1 = require("./schedulers/jobs");
const treasury_1 = require("./game/treasury");
// Init tables
(0, treasury_1.initTreasury)().catch(e => logger_1.default.error('Treasury init failed:', e.message));
(0, treasury_1.initTreasuryLog)().catch(e => logger_1.default.error('Treasury log init failed:', e.message));
(0, salary_1.startSalaryScheduler)();
(0, tournaments_1.startTournamentScheduler)();
(0, cleanup_1.startCleanupScheduler)();
(0, massacre_1.startMassacreScheduler)();
(0, inactiveLeader_1.startInactiveLeaderCheck)();
(0, jobs_1.startJobCompletionScheduler)();
//# sourceMappingURL=index.js.map