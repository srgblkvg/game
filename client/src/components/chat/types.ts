export interface OnlineUser {
    id: number;
    username: string;
    level: number;
    guildName?: string | null;
}

export interface ChatMessage {
    id: number;
    senderId: number;
    senderName: string;
    senderGuild?: string | null;
    senderGuildId?: number | null;
    targetId: number | null;
    content: string;
    createdAt: string;
    item?: any;
    itemRarity?: number;
}