"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PORT = exports.JWT_SECRET = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const logger_1 = __importDefault(require("./logger"));
// Загружаем .env из корня сервера
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../.env') });
if (!process.env.JWT_SECRET) {
    logger_1.default.error('❌ JWT_SECRET не задан в .env');
    process.exit(1);
}
exports.JWT_SECRET = process.env.JWT_SECRET;
exports.PORT = parseInt(process.env.PORT || '3001', 10);
//# sourceMappingURL=env.js.map