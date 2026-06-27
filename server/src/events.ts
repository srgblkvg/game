// EventBus — развязка между роутами и WebSocket
// Роуты emit'ят события, WebSocket подписывается.
// Это позволяет менять WebSocket-логику не трогая роуты и наоборот.

export type DirtyType = 'quests' | 'rating' | 'notifications';

export interface NotificationData {
  type: 'quest_complete' | 'level_up' | 'battle_result' | 'guild_event' | 'auction_won' | 'auction_outbid' | 'auction_sold' | 'system';
  message: string;
  data?: any;
}

export type GameEvent =
  | { type: 'markDirty'; userId: number; flags: DirtyType[] }
  | { type: 'pushNotification'; userId: number; notification: NotificationData }
  | { type: 'broadcast'; eventType: string; data: any; exceptUserId?: number }
  | { type: 'sendToUser'; userId: number; payload: object }
  | { type: 'sendToGuild'; guildId: number; payload: object };

type Listener = (event: GameEvent) => void;
const listeners = new Map<string, Set<Listener>>();

export function on(eventType: GameEvent['type'], fn: Listener): void {
  let set = listeners.get(eventType);
  if (!set) { set = new Set(); listeners.set(eventType, set); }
  set.add(fn);
}

export function emit(event: GameEvent): void {
  const set = listeners.get(event.type);
  if (set) set.forEach(fn => fn(event));
}

// ----- Convenience wrappers (для роутов) -----

export function markDirty(userId: number, ...flags: DirtyType[]): void {
  emit({ type: 'markDirty', userId, flags });
}

export function pushNotification(userId: number, notification: NotificationData): void {
  emit({ type: 'pushNotification', userId, notification });
}

export function broadcast(eventType: string, data: any, exceptUserId?: number): void {
  const ev: GameEvent = { type: 'broadcast', eventType, data };
  if (exceptUserId !== undefined) (ev as any).exceptUserId = exceptUserId;
  emit(ev);
}

export function sendToUser(userId: number, payload: object): void {
  emit({ type: 'sendToUser', userId, payload });
}

export function sendToGuild(guildId: number, payload: object): void {
  emit({ type: 'sendToGuild', guildId, payload });
}
