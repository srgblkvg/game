"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isGuildAtWar = exports.updateGuildQuestProgress = void 0;
const express_1 = require("express");
const guildCore_1 = __importDefault(require("./guild/guildCore"));
const guildMembers_1 = __importDefault(require("./guild/guildMembers"));
const guildChat_1 = __importDefault(require("./guild/guildChat"));
const guildTreasury_1 = __importDefault(require("./guild/guildTreasury"));
const guildWar_1 = __importDefault(require("./guild/guildWar"));
const guildQuests_1 = __importDefault(require("./guild/guildQuests"));
const router = (0, express_1.Router)();
router.use(guildCore_1.default);
router.use(guildMembers_1.default);
router.use(guildChat_1.default);
router.use(guildTreasury_1.default);
router.use(guildWar_1.default);
router.use(guildQuests_1.default);
var guildQuests_2 = require("./guild/guildQuests");
Object.defineProperty(exports, "updateGuildQuestProgress", { enumerable: true, get: function () { return guildQuests_2.updateGuildQuestProgress; } });
var guildWar_2 = require("./guild/guildWar");
Object.defineProperty(exports, "isGuildAtWar", { enumerable: true, get: function () { return guildWar_2.isGuildAtWar; } });
exports.default = router;
//# sourceMappingURL=guild.js.map