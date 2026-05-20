import dotenv from 'dotenv';
import path from 'path';
import logger from './logger';

// Загружаем .env из корня сервера
dotenv.config({ path: path.resolve(__dirname, '../.env') });

if (!process.env.JWT_SECRET) {
    logger.error('❌ JWT_SECRET не задан в .env');
    process.exit(1);
}

export const JWT_SECRET = process.env.JWT_SECRET!;
export const PORT = parseInt(process.env.PORT || '3001', 10);