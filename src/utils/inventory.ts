import type { CartItem, Product, Variant } from '../types.ts';

export const LOW_STOCK_THRESHOLD = 3;
export const DEFAULT_STOCK_PER_SIZE = 10;

export function resolveCanonicalSizeKey(product: Product, rawSize?: string): string {
  const sizes = Array.isArray(product.sizes) && product.sizes.length > 0
    ? product.sizes
    : ['Free Size (55 - 90 KG)'];
  const sizesAr = Array.isArray(product.sizesAr) ? product.sizesAr : [];

  const target = (rawSize || '').trim();
  if (!target) return sizes[0];

  const exactEnIdx = sizes.findIndex((s) => s.trim().toLowerCase() === target.toLowerCase());
  if (exactEnIdx !== -1) return sizes[exactEnIdx];

  const exactArIdx = sizesAr.findIndex((s) => s.trim().toLowerCase() === target.toLowerCase());
  if (exactArIdx !== -1 && sizes[exactArIdx]) return sizes[exactArIdx];

  return target;
}

export function findVariantIndexForItem(
  product: Product,
  item: Pick<CartItem, 'variantIndex' | 'color' | 'colorAr'>
): number {
  if (
    typeof item.variantIndex === 'number' &&
    item.variantIndex >= 0 &&
    item.variantIndex < product.variants.length
  ) {
    return item.variantIndex;
  }

  const colorTarget = (item.color || '').trim().toLowerCase();
  const colorArTarget = (item.colorAr || '').trim().toLowerCase();
  const matched = product.variants.findIndex((v) => {
    const en = (v.colorName || '').trim().toLowerCase();
    const ar = (v.colorNameAr || '').trim().toLowerCase();
    return (
      (colorTarget && (en === colorTarget || ar === colorTarget)) ||
      (colorArTarget && (en === colorArTarget || ar === colorArTarget))
    );
  });

  return matched !== -1 ? matched : 0;
}

export function getVariantSizeStock(
  product: Product,
  variantIndex: number,
  rawSize?: string
): number | null {
  if (product.trackStock === false) return null;

  const variant = product.variants[variantIndex] || product.variants[0];
  if (!variant) return null;

  if (variant.sizeStock && typeof variant.sizeStock === 'object') {
    const key = resolveCanonicalSizeKey(product, rawSize);
    if (typeof variant.sizeStock[key] === 'number' && Number.isFinite(variant.sizeStock[key])) {
      return Math.max(0, Math.floor(variant.sizeStock[key]));
    }
    if (rawSize && typeof variant.sizeStock[rawSize] === 'number' && Number.isFinite(variant.sizeStock[rawSize])) {
      return Math.max(0, Math.floor(variant.sizeStock[rawSize]));
    }
    // Fallback if sizes changed after stock creation: match any numeric slot or sum remaining
    const values = Object.values(variant.sizeStock).filter((n) => typeof n === 'number' && Number.isFinite(n));
    if (values.length > 0 && product.sizes.length <= 1) {
      return Math.max(0, Math.floor(values[0]));
    }
  }

  if (typeof variant.stock === 'number' && Number.isFinite(variant.stock)) {
    return Math.max(0, Math.floor(variant.stock));
  }

  return null;
}

export function getVariantTotalStock(product: Product, variantIndex: number): number | null {
  if (product.trackStock === false) return null;

  const variant = product.variants[variantIndex];
  if (!variant) return null;

  if (variant.sizeStock && typeof variant.sizeStock === 'object') {
    const sizes = product.sizes.length > 0 ? product.sizes : Object.keys(variant.sizeStock);
    let hasNumeric = false;
    let total = 0;
    for (const s of sizes) {
      const val = variant.sizeStock[s];
      if (typeof val === 'number' && Number.isFinite(val)) {
        hasNumeric = true;
        total += Math.max(0, Math.floor(val));
      }
    }
    if (hasNumeric) return total;
  }

  if (typeof variant.stock === 'number' && Number.isFinite(variant.stock)) {
    return Math.max(0, Math.floor(variant.stock));
  }

  return null;
}

export function getProductTotalStock(product: Product): number | null {
  if (product.trackStock === false) return null;
  let hasTrackedVariant = false;
  let total = 0;
  for (let i = 0; i < product.variants.length; i++) {
    const vTotal = getVariantTotalStock(product, i);
    if (vTotal !== null) {
      hasTrackedVariant = true;
      total += vTotal;
    }
  }
  return hasTrackedVariant ? total : null;
}

export function normalizeVariantInventory(
  variant: Variant,
  sizes: string[],
  defaultPerSize = DEFAULT_STOCK_PER_SIZE
): Variant {
  const safeSizes = sizes.length > 0 ? sizes : ['Free Size (55 - 90 KG)'];
  const nextSizeStock: Record<string, number> = {};
  const fallbackQty =
    typeof variant.stock === 'number' && Number.isFinite(variant.stock)
      ? Math.max(0, Math.floor(variant.stock))
      : defaultPerSize;

  for (const sizeKey of safeSizes) {
    const existing = variant.sizeStock?.[sizeKey];
    if (typeof existing === 'number' && Number.isFinite(existing)) {
      nextSizeStock[sizeKey] = Math.max(0, Math.floor(existing));
    } else {
      nextSizeStock[sizeKey] = fallbackQty;
    }
  }

  const totalStock = Object.values(nextSizeStock).reduce((sum, q) => sum + q, 0);
  return {
    ...variant,
    sizeStock: nextSizeStock,
    stock: totalStock,
  };
}

export function ensureProductInventory(
  product: Product,
  defaultPerSize = DEFAULT_STOCK_PER_SIZE
): Product {
  const sizes =
    Array.isArray(product.sizes) && product.sizes.length > 0
      ? product.sizes
      : ['Free Size (55 - 90 KG)'];
  const trackStock = product.trackStock !== false;
  const variants = (product.variants || []).map((v) =>
    normalizeVariantInventory(v, sizes, defaultPerSize)
  );
  return {
    ...product,
    trackStock,
    variants,
  };
}

export interface StockBadgeInfo {
  status: 'unlimited' | 'in' | 'low' | 'out';
  labelEn: string;
  labelAr: string;
}

export function getStockBadgeInfo(qty: number | null): StockBadgeInfo {
  if (qty === null) {
    return { status: 'unlimited', labelEn: 'In Stock', labelAr: 'متاح للطلب' };
  }
  if (qty <= 0) {
    return { status: 'out', labelEn: 'Sold Out', labelAr: 'نفذت الكمية' };
  }
  if (qty <= LOW_STOCK_THRESHOLD) {
    return {
      status: 'low',
      labelEn: `Only ${qty} left`,
      labelAr: `متبقي ${qty} قطعة فقط`,
    };
  }
  return {
    status: 'in',
    labelEn: `In Stock (${qty})`,
    labelAr: `متوفر (${qty} قطعة)`,
  };
}
