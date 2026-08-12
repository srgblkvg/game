"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_1 = require("../db/index");
const router = (0, express_1.Router)();
// Публичный эндпоинт — получение действий для главной страницы
router.get('/actions', async (req, res) => {
    const actions = await index_1.db.query('SELECT * FROM actions_config ORDER BY section, sort_order', []);
    res.json(actions);
});
exports.default = router;
//# sourceMappingURL=actions.js.map