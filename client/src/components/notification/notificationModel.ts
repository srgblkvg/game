export const notificationTypes = [
  'quest_complete',
  'level_up',
  'battle_result',
  'guild_event',
  'auction_won',
  'auction_outbid',
  'auction_sold',
  'system',
] as const;

export type NotificationType = (typeof notificationTypes)[number];

export interface NotificationModel {
  id: number;
  type: NotificationType;
  message: string;
  data?: unknown;
  createdAt: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNotificationType(value: unknown): value is NotificationType {
  return typeof value === 'string' && notificationTypes.some(type => type === value);
}

function isNotification(value: unknown): value is NotificationModel {
  return isRecord(value)
    && typeof value.id === 'number'
    && Number.isFinite(value.id)
    && isNotificationType(value.type)
    && typeof value.message === 'string'
    && typeof value.createdAt === 'number'
    && Number.isFinite(value.createdAt);
}

export function parseNotificationDetail(detail: unknown): NotificationModel[] {
  if (!Array.isArray(detail)) return [];
  return detail.filter(isNotification);
}

export function getNotificationPath(data: unknown): string | null {
  let value = data;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }
  if (!isRecord(value) || typeof value.path !== 'string') return null;
  return value.path;
}
