export interface LockedYooKassaPayment {
  paymentId: string;
  userId: number;
  item: string;
  amount: string;
  status: string;
  processedAt: number;
}

export interface LockedDonatePaymentUser {
  id: number;
  bank: number | null;
}

export interface DonatePaymentDeliveryTransaction {
  lockPayment(paymentId: string): Promise<LockedYooKassaPayment | null>;
  lockUser(userId: number): Promise<LockedDonatePaymentUser | null>;
  addBank(userId: number, amount: number): Promise<void>;
  markSucceeded(paymentId: string, processedAt: number): Promise<void>;
}

export interface DonatePaymentDeliveryRepository {
  transaction<T>(callback: (tx: DonatePaymentDeliveryTransaction) => Promise<T>): Promise<T>;
}

export interface YooKassaSilverPaymentInput {
  paymentId: string;
  providerUserId: string;
  providerItem: string;
  verifiedAmount: string;
  verifiedCurrency: string;
  processedAt: number;
}

export type YooKassaSilverPaymentResult =
  | { status: 'delivered'; userId: number; item: string; silverAmount: number }
  | { status: 'already-processed' }
  | { status: 'rejected'; reason: string };

const SILVER_ITEMS: Readonly<Record<string, { silverAmount: number; rub: string }>> = {
  silver_10000: { silverAmount: 10000, rub: '49.00' },
  silver_50000: { silverAmount: 50000, rub: '99.00' },
  silver_100000: { silverAmount: 100000, rub: '199.00' },
  silver_500000: { silverAmount: 500000, rub: '799.00' },
  silver_1000000: { silverAmount: 1000000, rub: '1399.00' },
};

const money = (value: string): string | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : null;
};

export function isYooKassaSilverItem(item: string): boolean {
  return Object.prototype.hasOwnProperty.call(SILVER_ITEMS, item);
}

export async function processYooKassaSilverPayment(
  repository: DonatePaymentDeliveryRepository,
  input: YooKassaSilverPaymentInput,
): Promise<YooKassaSilverPaymentResult> {
  return repository.transaction(async tx => {
    // Payment callbacks claim payment first. Payment-specific order is strictly:
    // yukassa_payments FOR UPDATE -> users FOR UPDATE. This silver path never locks overflow.
    const payment = await tx.lockPayment(input.paymentId);
    if (!payment) return { status: 'rejected', reason: 'payment-not-found' };
    if (payment.status !== 'pending') return { status: 'already-processed' };

    const sku = SILVER_ITEMS[payment.item];
    const expected = sku?.rub;
    if (!sku
      || String(payment.userId) !== input.providerUserId
      || payment.item !== input.providerItem
      || money(payment.amount) !== expected
      || money(input.verifiedAmount) !== expected
      || input.verifiedCurrency !== 'RUB') {
      return { status: 'rejected', reason: 'payment-mismatch' };
    }

    const user = await tx.lockUser(payment.userId);
    if (!user) return { status: 'rejected', reason: 'user-not-found' };
    await tx.addBank(payment.userId, sku.silverAmount);
    await tx.markSucceeded(payment.paymentId, input.processedAt);
    return { status: 'delivered', userId: payment.userId, item: payment.item, silverAmount: sku.silverAmount };
  });
}
