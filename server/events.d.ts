export type DirtyType = 'quests' | 'rating' | 'notifications';
export interface NotificationData {
    type: 'quest_complete' | 'level_up' | 'battle_result' | 'guild_event' | 'auction_won' | 'auction_outbid' | 'auction_sold' | 'system';
    message: string;
    data?: any;
}
export type GameEvent = {
    type: 'markDirty';
    userId: number;
    flags: DirtyType[];
} | {
    type: 'pushNotification';
    userId: number;
    notification: NotificationData;
} | {
    type: 'broadcast';
    eventType: string;
    data: any;
    exceptUserId?: number;
} | {
    type: 'sendToUser';
    userId: number;
    payload: object;
} | {
    type: 'sendToGuild';
    guildId: number;
    payload: object;
};
type Listener = (event: GameEvent) => void;
export declare function on(eventType: GameEvent['type'], fn: Listener): void;
export declare function emit(event: GameEvent): void;
export declare function markDirty(userId: number, ...flags: DirtyType[]): void;
export declare function pushNotification(userId: number, notification: NotificationData): void;
export declare function broadcast(eventType: string, data: any, exceptUserId?: number): void;
export declare function sendToUser(userId: number, payload: object): void;
export declare function sendToGuild(guildId: number, payload: object): void;
export {};
//# sourceMappingURL=events.d.ts.map