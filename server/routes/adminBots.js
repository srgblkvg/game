"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const botManager_1 = require("../bots/botManager");
const router = (0, express_1.Router)();
// Статус ботов
router.get('/bots', (req, res) => {
    res.json((0, botManager_1.getBotsStatus)());
});
// Запустить ботов
router.post('/bots/start', async (req, res) => {
    const { count = 3, useExisting = true } = req.body;
    try {
        const result = await (0, botManager_1.startBots)(count, useExisting);
        res.json(result);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// Остановить ботов
router.post('/bots/stop', async (req, res) => {
    const result = await (0, botManager_1.stopBots)();
    res.json(result);
});
exports.default = router;
//# sourceMappingURL=adminBots.js.map