/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { auctionUnitPrice, compareAuctionLots } from './auctionSort';

const stack = (rarity: number, startPrice: number, count = 1, buyoutPrice: number | null = null) => ({
    itemData: { rarity_id: rarity, count }, startPrice, currentBid: null, buyoutPrice,
});

test('цена лота пересчитывается за одну единицу стека', () => {
    assert.equal(auctionUnitPrice(stack(1, 1000, 10), 'bid'), 100);
    assert.equal(auctionUnitPrice(stack(1, 1000, 10, 1500), 'buyout'), 150);
});

test('сортировка по цене сравнивает цену одной единицы', () => {
    const cheapStack = stack(1, 1000, 10);
    const expensiveSingle = stack(1, 200, 1);
    assert.ok(compareAuctionLots('price_asc')(cheapStack, expensiveSingle) < 0);
    assert.ok(compareAuctionLots('price_desc')(cheapStack, expensiveSingle) > 0);
});

test('сортировка по выкупу сравнивает цену одной единицы', () => {
    const cheapStack = stack(1, 1000, 10, 1500);
    const expensiveSingle = stack(1, 100, 1, 300);
    assert.ok(compareAuctionLots('buyout_asc')(cheapStack, expensiveSingle) < 0);
    assert.ok(compareAuctionLots('buyout_desc')(cheapStack, expensiveSingle) > 0);
});

test('сортировка по качеству использует редкость предмета', () => {
    const common = stack(1, 100);
    const mythic = stack(6, 100);
    assert.ok(compareAuctionLots('quality_asc')(common, mythic) < 0);
    assert.ok(compareAuctionLots('quality_desc')(common, mythic) > 0);
});
