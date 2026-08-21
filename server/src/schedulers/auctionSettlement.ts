import { checkAchievement } from '../routes/achievements';
import { broadcast, pushNotification, sendToUser } from '../events';
import { createPgAuctionSettlementRepository } from '../game/auctionSettlementRepository';
import { settleExpiredAuctions } from '../game/auctionSettlement';
import { systemClock, type Clock } from '../clock';

let running = false;

export async function runAuctionSettlement(clock: Clock = systemClock): Promise<void> {
  if (running) return;
  running = true;
  try {
    const repository = createPgAuctionSettlementRepository();
    const result = await settleExpiredAuctions(repository, {
      sold: (settled) => {
        checkAchievement(settled.sellerId, 'auction').catch(() => {});
        pushNotification(settled.sellerId, {
          type: 'auction_sold',
          message: `${settled.buyerName} купил «${settled.itemName}» за ${settled.price} серебра`,
        });
        sendToUser(settled.sellerId, { type: 'auction_badge', count: 1 });
        if (settled.buyerId !== null) {
          pushNotification(settled.buyerId, {
            type: 'system',
            message: `Вы выиграли «${settled.itemName}» на аукционе!`,
          });
        }
        broadcast('auction_message_removed', { lotId: settled.lotId });
        broadcast('auction_changed', { lotId: settled.lotId });
      },
      unsold: (settled) => {
        pushNotification(settled.sellerId, {
          type: 'system',
          message: `Лот «${settled.itemName}» не был продан и возвращён на склад`,
        });
        broadcast('auction_message_removed', { lotId: settled.lotId });
        broadcast('auction_changed', { lotId: settled.lotId });
      },
    }, clock.nowSec());

    if (result.failed > 0) {
      console.error(`[auction-settlement] settled=${result.settled} failed=${result.failed}`);
    }
  } catch (error) {
    console.error('[auction-settlement] scheduler failed:', error);
  } finally {
    running = false;
  }
}

export function startAuctionSettlementScheduler(): void {
  setTimeout(() => { runAuctionSettlement().catch(() => {}); }, 15_000);
  setInterval(() => { runAuctionSettlement().catch(() => {}); }, 30_000);
}
