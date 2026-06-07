export interface OnlineUser {
    id: number;
    username: string;
    level: number;
}

export interface ChatMessage {
    id: number;
    senderId: number;
    senderName: string;
    senderGuild?: string | null;
    targetId: number | null;
    content: string;
    createdAt: string;
    item?: any;
    itemRarity?: number;
}