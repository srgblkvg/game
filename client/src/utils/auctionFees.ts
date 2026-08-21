export function calculateAuctionListingFee(startPricePerItem: number, count: number): number {
  const totalStartPrice = Math.max(0, Math.trunc(startPricePerItem)) * Math.max(1, Math.trunc(count));
  return Math.max(1, Math.floor(totalStartPrice * 0.05));
}
