export interface OnlineUser {
    id: number;
    username: string;
    level: number;
}

export interface ChatMessage {
    id: number;
    senderId: number;
    senderName: string;
    targetId: number | null;
    content: string;
    createdAt: string;
    item?: any;
    itemRarity?: number;
}