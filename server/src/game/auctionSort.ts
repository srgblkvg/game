export type AuctionSort =
    | 'quality_asc' | 'quality_desc'
    | 'price_asc' | 'price_desc'
    | 'buyout_asc' | 'buyout_desc';

type PriceKind = 'bid' | 'buyout';

function stackCount(lot: any): number {
    return Math.max(1, Number(lot?.itemData?.count) || 1);
}

export function auctionUnitPrice(lot: any, kind: PriceKind): number {
    const total = kind === 'buyout'
        ? Number(lot?.buyoutPrice ?? lot?.buyoutprice)
        : Number(lot?.currentBid ?? lot?.currentbid ?? lot?.startPrice ?? lot?.startprice);
    if (!Number.isFinite(total) || (kind === 'buyout' && total <= 0)) return Number.POSITIVE_INFINITY;
    return total / stackCount(lot);
}

function stableLotOrder(a: any, b: any): number {
    const byEnd = Number(a?.endsAt ?? a?.endsat ?? 0) - Number(b?.endsAt ?? b?.endsat ?? 0);
    return byEnd || Number(a?.id ?? 0) - Number(b?.id ?? 0);
}

export function compareAuctionLots(sort: string) {
    return (a: any, b: any): number => {
        let result = 0;
        if (sort === 'quality_asc' || sort === 'quality_desc') {
            result = Number(a?.itemData?.rarity_id ?? 0) - Number(b?.itemData?.rarity_id ?? 0);
            if (sort === 'quality_desc') result *= -1;
        } else if (sort === 'price_asc' || sort === 'price_desc') {
            result = auctionUnitPrice(a, 'bid') - auctionUnitPrice(b, 'bid');
            if (sort === 'price_desc') result *= -1;
        } else if (sort === 'buyout_asc' || sort === 'buyout_desc') {
            const aPrice = auctionUnitPrice(a, 'buyout');
            const bPrice = auctionUnitPrice(b, 'buyout');
            if (!Number.isFinite(aPrice) && !Number.isFinite(bPrice)) result = 0;
            else if (!Number.isFinite(aPrice)) result = 1;
            else if (!Number.isFinite(bPrice)) result = -1;
            else result = sort === 'buyout_desc' ? bPrice - aPrice : aPrice - bPrice;
        }
        return result || stableLotOrder(a, b);
    };
}
