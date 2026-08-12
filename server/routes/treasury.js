"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const treasury_1 = require("../game/treasury");
const router = (0, express_1.Router)();
router.get('/treasury', async (_req, res) => {
    const amount = await (0, treasury_1.getTreasury)();
    res.json({ amount });
});
exports.default = router;
//# sourceMappingURL=treasury.js.map