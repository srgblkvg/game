export interface Notification {
    type: 'quest_complete' | 'level_up' | 'battle_result' | 'guild_event' | 'auction_won' | 'auction_outbid' | 'auction_sold' | 'system';
    message: string;
    data?: any;
    id: number;
    createdAt: number;
}
/** Проверить, онлайн ли пользователь (есть активное WS-соединение) */
export declare function isUserOnline(userId: number): boolean;
export declare function setupWebSocket(server: any): Promise<void>;
//# sourceMappingURL=websocket.d.ts.map