import {applyInventoryRecipe,type InventoryCatalogItem} from './donateInventoryRecipe';

export interface CraftCatalogItem extends InventoryCatalogItem {
  id: number;
  name: string;
  rarityId: number;
  type: string;
  image: string | null;
  rarityDisplay: string;
  rarityColor: string;
}

export interface DonateCraftPackTransaction {
  lockPayment(paymentId: string): Promise<{ paymentId: string; userId: number; item: string; amount: string; status: string } | null>;
  lockUser(userId: number): Promise<{ id: number; inventory: string; bank: number | null } | null>;
  findCraftItems(names: string[]): Promise<CraftCatalogItem[]>;
  saveUser(userId: number, inventory: string, bankDelta: number): Promise<void>;
  markSucceeded(paymentId: string, processedAt: number): Promise<void>;
}

export interface DonateCraftPackRepository {
  transaction<T>(callback: (tx: DonateCraftPackTransaction) => Promise<T>): Promise<T>;
}

interface Input {
  paymentId: string;
  providerUserId: string;
  providerItem: string;
  verifiedAmount: string;
  verifiedCurrency: string;
  processedAt: number;
}

type Result =
  | { status: 'delivered'; userId: number; item: 'craft_rare' | 'craft_epic' }
  | { status: 'already-processed' }
  | { status: 'rejected'; reason: string };

const RECIPES = {
  craft_rare: { amount: '99.00', bank: 10000, required: [
    { name: 'Сердцевина бездны', count: 5 }, { name: 'Рунный булыжник', count: 6 },
  ] },
  craft_epic: { amount: '199.00', bank: 30000, required: [
    { name: 'Искра погибели', count: 5 }, { name: 'Рунный булыжник', count: 10 },
  ] },
} as const;

const money = (value: string): string | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : null;
};

export async function processYooKassaCraftPackPayment(
  repository: DonateCraftPackRepository,
  input: Input,
): Promise<Result> {
  return repository.transaction(async tx => {
    const payment = await tx.lockPayment(input.paymentId);
    if (!payment) return { status: 'rejected', reason: 'payment-not-found' };
    if (payment.status !== 'pending') return { status: 'already-processed' };
    const recipe = RECIPES[payment.item as keyof typeof RECIPES];
    if (!recipe || input.providerItem !== payment.item
      || String(payment.userId) !== input.providerUserId
      || money(payment.amount) !== recipe.amount || money(input.verifiedAmount) !== recipe.amount
      || input.verifiedCurrency !== 'RUB') {
      return { status: 'rejected', reason: 'payment-mismatch' };
    }

    const user = await tx.lockUser(payment.userId);
    if (!user) return { status: 'rejected', reason: 'user-not-found' };
    const catalog = await tx.findCraftItems(recipe.required.map(required => required.name));
    const applied=applyInventoryRecipe(user.inventory,catalog,{entries:recipe.required,bankDelta:recipe.bank});
    if(!applied.ok)return{status:'rejected',reason:applied.reason};
    await tx.saveUser(user.id, applied.inventoryJson, applied.bankDelta);
    await tx.markSucceeded(payment.paymentId, input.processedAt);
    return { status: 'delivered', userId: user.id, item: payment.item as 'craft_rare' | 'craft_epic' };
  });
}

export function processYooKassaCraftRarePayment(repository: DonateCraftPackRepository, input: Input): Promise<Result> {
  return processYooKassaCraftPackPayment(repository, input);
}
