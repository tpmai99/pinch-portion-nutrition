import { verifiedProduct } from "./grocery";

export type ShoppingIngredient = { name: string; dutchName: string };

/** A saved catalog match is not evidence of current stock at a branch. */
export function storeCoverage(storeId: string, items: ShoppingIngredient[]) {
  const products = items.map((item) => ({
    ...item,
    product: /\d+(?:[.,]\d+)?\s*%/.test(item.name) ? null : verifiedProduct(storeId, item.name),
    stock: "unverified" as const,
  }));
  const matched = products.filter((item) => item.product !== null).length;
  return { products, total: items.length, matched, unmatched: items.length - matched, stockConfirmed: 0, completeStockConfirmed: false as const };
}