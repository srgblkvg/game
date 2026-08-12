export declare const BOT_NAMES: string[];
/** Получить случайное неиспользованное имя. Возвращает null если все заняты. */
export declare function pickBotName(): string | null;
/** Освободить имя (при остановке бота) */
export declare function releaseBotName(name: string): void;
/** Проверить, используется ли имя */
export declare function isNameUsed(name: string): boolean;
//# sourceMappingURL=botNames.d.ts.map