export interface VkDeliveryClaimInput {
  provider: 'vk';
  externalId: string;
  providerUserId: number;
  item: string;
}

export interface LockedVkDeliveryClaim extends VkDeliveryClaimInput {
  status: string;
  processedAt?: number;
}

export interface VkPaymentDeliveryTransaction {
  claim(input: VkDeliveryClaimInput): Promise<LockedVkDeliveryClaim>;
  lockVkUser(vkUserId: number): Promise<{ id: number; bank: number | null } | null>;
  addBank(characterId: number, amount: number): Promise<void>;
  logPayment(input: { orderId: string; vkUserId: number; characterId: number; item: string; processedAt: number }): Promise<void>;
  markSucceeded(orderId: string, processedAt: number, characterId?: number): Promise<void>;
}

export interface VkPaymentDeliveryRepository {
  transaction<T>(callback: (tx: VkPaymentDeliveryTransaction) => Promise<T>): Promise<T>;
}

export interface VkSilverPaymentInput {
  orderId: string;
  vkUserId: number;
  item: string;
  providerPrice: number;
  processedAt: number;
}

export type VkSilverPaymentResult =
  | { status: 'delivered'; characterId: number; item: string; silverAmount: number }
  | { status: 'already-processed' }
  | { status: 'rejected'; reason: string };

const SILVER_ITEMS: Readonly<Record<string, { silverAmount: number; price: number }>> = {
  silver_10000: { silverAmount: 10000, price: 7 },
  silver_50000: { silverAmount: 50000, price: 14 },
  silver_100000: { silverAmount: 100000, price: 28 },
  silver_500000: { silverAmount: 500000, price: 114 },
  silver_1000000: { silverAmount: 1000000, price: 200 },
};

export async function processVkSilverPayment(
  repository: VkPaymentDeliveryRepository,
  input: VkSilverPaymentInput,
): Promise<VkSilverPaymentResult> {
  const sku = SILVER_ITEMS[input.item];
  if (!input.orderId || !Number.isInteger(input.vkUserId) || input.vkUserId <= 0 || !sku || input.providerPrice !== sku.price) {
    return { status: 'rejected', reason: 'payment-mismatch' };
  }

  return repository.transaction(async tx => {
    const claim = await tx.claim({
      provider: 'vk', externalId: input.orderId, providerUserId: input.vkUserId, item: input.item,
    });
    if (claim.provider !== 'vk' || claim.externalId !== input.orderId
      || claim.providerUserId !== input.vkUserId || claim.item !== input.item) {
      return { status: 'rejected', reason: 'claim-identity-mismatch' };
    }
    if (claim.status === 'succeeded') return { status: 'already-processed' };
    if (claim.status !== 'pending') return { status: 'rejected', reason: 'claim-status' };

    const user = await tx.lockVkUser(input.vkUserId);
    if (!user) return { status: 'rejected', reason: 'character-not-found' };
    await tx.addBank(user.id, sku.silverAmount);
    await tx.logPayment({
      orderId: input.orderId, vkUserId: input.vkUserId, characterId: user.id,
      item: input.item, processedAt: input.processedAt,
    });
    await tx.markSucceeded(input.orderId, input.processedAt, user.id);
    return { status: 'delivered', characterId: user.id, item: input.item, silverAmount: sku.silverAmount };
  });
}
