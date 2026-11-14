import React, { useState, useEffect } from 'react';
import { X, Zap, ShoppingBag, ShieldCheck, Ruler, PackageCheck, AlertTriangle } from 'lucide-react';
import { CartItem, Product } from '../types';
import { useLanguage } from '../context/LanguageContext';
import {
  LOW_STOCK_THRESHOLD,
  getStockBadgeInfo,
  getVariantSizeStock,
  getVariantTotalStock,
  resolveCanonicalSizeKey,
} from '../utils/inventory';

interface ProductModalProps {
  product: Product | null;
  initialVariantIndex: number;
  isOpen: boolean;
  cartItems?: CartItem[];
  onClose: () => void;
  onAddToCart: (product: Product, variantIndex: number, size: string, quantity: number) => void;
  onInstantBuy: (product: Product, variantIndex: number, size: string, quantity: number) => void;
  onOpenSizeGuide: () => void;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  product,
  initialVariantIndex,
  isOpen,
  cartItems = [],
  onClose,
  onAddToCart,
  onInstantBuy,
  onOpenSizeGuide,
}) => {
  const [selectedVariantIdx, setSelectedVariantIdx] = useState(0);
  const [selectedSize, setSelectedSize] = useState('');
  const [quantity, setQuantity] = useState(1);
  const { language, isRTL, t } = useLanguage();

  useEffect(() => {
    if (product) {
      setSelectedVariantIdx(initialVariantIndex);
      const initialSize = language === 'ar' && product.sizesAr && product.sizesAr[0]
        ? product.sizesAr[0]
        : (product.sizes[0] || 'Free Size (55 - 90 KG)');
      setSelectedSize(initialSize);
      setQuantity(1);
    }
  }, [product, initialVariantIndex, language]);

  if (!isOpen || !product) return null;

  const activeVariant = product.variants[selectedVariantIdx] || product.variants[0];
  const displayName = language === 'ar' && product.nameAr ? product.nameAr : product.name;
  const displayBadge = language === 'ar' && product.badgeAr ? product.badgeAr : product.badge;
  const displayDesc = language === 'ar' && product.descAr ? product.descAr : product.desc;
  const displayFabric = language === 'ar' && product.fabricAr ? product.fabricAr : product.fabric;
  const displayColorName = language === 'ar' && activeVariant.colorNameAr ? activeVariant.colorNameAr : activeVariant.colorName;
  const displaySizes = language === 'ar' && product.sizesAr && product.sizesAr.length > 0 ? product.sizesAr : product.sizes;

  const currentStock = getVariantSizeStock(product, selectedVariantIdx, selectedSize);
  const canonicalSelectedSize = resolveCanonicalSizeKey(product, selectedSize);
  const qtyInCartForSelection = cartItems.reduce((sum, ci) => {
    if (ci.productId !== product.id) return sum;
    const ciSize = resolveCanonicalSizeKey(product, ci.sizeAr || ci.size);
    const sameVariant =
      ci.variantIndex !== undefined
        ? ci.variantIndex === selectedVariantIdx
        : ci.color === activeVariant.colorName || ci.colorAr === activeVariant.colorNameAr;
    return sameVariant && ciSize === canonicalSelectedSize ? sum + ci.quantity : sum;
  }, 0);

  const maxAddable = currentStock === null ? 99 : Math.max(0, currentStock - qtyInCartForSelection);
  const isSoldOut = currentStock !== null && currentStock <= 0;
  const isBagLimitReached = currentStock !== null && currentStock > 0 && maxAddable <= 0;
  const effectiveMax = currentStock === null ? 99 : Math.max(1, maxAddable);
  const stockBadge = getStockBadgeInfo(currentStock);

  const clampedQty = Math.min(quantity, effectiveMax);

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-fadeIn ${isRTL ? 'rtl' : 'ltr'}`}>
      
      {/* Backdrop */}
      <div 
        className="absolute inset-0"
        onClick={onClose}
      />

      <div 
        className="relative bg-[#FAF7F2] w-full max-w-3xl max-h-[92vh] overflow-y-auto border border-neutral-300 flex flex-col md:flex-row shadow-2xl text-left z-10 no-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className={`absolute top-3 ${isRTL ? 'left-3' : 'right-3'} z-20 bg-white/90 border border-neutral-300 p-2 hover:bg-black hover:text-white transition-colors cursor-pointer`}
          title="Close"
          aria-label="Close modal"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Media Column (Image & Thumbnails) */}
        <div className="w-full md:w-1/2 p-4 sm:p-6 bg-white border-b md:border-b-0 md:border-r border-neutral-200 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="relative aspect-[3/4] w-full overflow-hidden bg-neutral-100 border border-neutral-200">
              <img
                src={activeVariant.image}
                alt={`${displayName} - ${displayColorName}`}
                className={`w-full h-full object-cover transition-opacity duration-300 ${isSoldOut ? 'opacity-70 grayscale-[25%]' : ''}`}
              />
              {displayBadge && (
                <span className={`absolute top-2.5 ${isRTL ? 'right-2.5' : 'left-2.5'} bg-black text-white text-[9px] font-bold px-2 py-0.5 tracking-wider uppercase`}>
                  {displayBadge}
                </span>
              )}
              {isSoldOut && (
                <span className={`absolute top-2.5 ${isRTL ? 'left-2.5' : 'right-2.5'} bg-red-700 text-white text-[9px] font-extrabold px-2.5 py-0.5 tracking-wider uppercase`}>
                  {language === 'ar' ? 'نفذت الكمية' : 'SOLD OUT'}
                </span>
              )}
            </div>

            {/* Gallery thumbnails */}
            <div className="grid grid-cols-4 gap-2">
              {product.variants.map((v, idx) => {
                const vTotal = getVariantTotalStock(product, idx);
                const vOut = vTotal !== null && vTotal <= 0;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setSelectedVariantIdx(idx);
                      setQuantity(1);
                    }}
                    className={`relative aspect-[3/4] overflow-hidden border transition-all cursor-pointer ${
                      selectedVariantIdx === idx
                        ? 'ring-2 ring-black border-black scale-105 shadow-xs'
                        : 'border-neutral-300 opacity-60 hover:opacity-100'
                    }`}
                    title={language === 'ar' && v.colorNameAr ? v.colorNameAr : v.colorName}
                  >
                    <img src={v.image} alt={v.colorName} className={`w-full h-full object-cover ${vOut ? 'grayscale opacity-50' : ''}`} />
                    {vOut && (
                      <span className="absolute bottom-0 left-0 right-0 bg-red-700/90 text-white text-[8px] font-bold text-center py-0.5">
                        {language === 'ar' ? 'نفذ' : 'OUT'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Details & Options Column */}
        <div className="w-full md:w-1/2 p-5 sm:p-7 flex flex-col justify-between">
          <div>
            
            {/* Kicker */}
            <p className="text-[10px] tracking-[0.25em] font-bold text-neutral-400 uppercase font-brand mb-1">
              {t.madeToMatch}
            </p>

            {/* Title */}
            <h2 className="text-xl sm:text-2xl font-extrabold text-neutral-900 tracking-tight font-brand uppercase leading-snug">
              {displayName}
            </h2>

            {/* Price */}
            <div className="flex items-baseline gap-2.5 pt-1.5 pb-2 border-b border-neutral-200">
              <span className="text-xl sm:text-2xl font-black text-neutral-900 tabular-nums">
                {language === 'ar' ? `${product.price.toLocaleString()} ${t.egp}` : `LE ${product.price.toLocaleString()}.00 EGP`}
              </span>
              {product.originalPrice && (
                <span className="text-xs text-neutral-400 line-through tabular-nums">
                  {language === 'ar' ? `${product.originalPrice.toLocaleString()} ${t.egp}` : `LE ${product.originalPrice.toLocaleString()}.00 EGP`}
                </span>
              )}
            </div>

            {/* Caption / Description */}
            {displayDesc && (
              <p className="text-xs text-neutral-600 mt-3 whitespace-pre-line leading-relaxed font-normal">
                {displayDesc}
              </p>
            )}

            {/* Fabric Details */}
            {displayFabric && (
              <div className="mt-3 p-2.5 bg-neutral-100 border border-neutral-200 text-[11px] text-neutral-700">
                <span className="font-bold text-neutral-900 block mb-0.5">{t.fabricDetails}:</span>
                <p className="leading-relaxed">{displayFabric}</p>
              </div>
            )}

            {/* 1. Color Selector */}
            <div className="mt-4 pt-3 border-t border-neutral-200">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-800">
                  {t.selectColor}: <span className="font-semibold text-neutral-600">{displayColorName}</span>
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {product.variants.map((variant, idx) => {
                  const vTotal = getVariantTotalStock(product, idx);
                  const vOut = vTotal !== null && vTotal <= 0;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setSelectedVariantIdx(idx);
                        setQuantity(1);
                      }}
                      className={`flex items-center gap-2 px-3 py-1.5 text-xs border transition-all cursor-pointer ${
                        selectedVariantIdx === idx
                          ? 'border-neutral-900 bg-neutral-900 text-white font-bold'
                          : 'border-neutral-300 bg-white text-neutral-800 hover:border-neutral-400'
                      } ${vOut ? 'opacity-65' : ''}`}
                    >
                      <span 
                        className="w-3.5 h-3.5 rounded-full border border-black/20 shrink-0 inline-block" 
                        style={{ backgroundColor: variant.hex }}
                      />
                      <span className={vOut ? 'line-through' : ''}>
                        {language === 'ar' && variant.colorNameAr ? variant.colorNameAr : variant.colorName}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Size Selector with Link to Size Guide */}
            <div className="mt-4 pt-3 border-t border-neutral-200">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-800">
                  {t.selectSize}
                </span>
                <button
                  type="button"
                  onClick={onOpenSizeGuide}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-neutral-600 hover:text-black underline cursor-pointer"
                >
                  <Ruler className="w-3.5 h-3.5" />
                  <span>{t.sizeGuide}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {displaySizes.map((size) => {
                  const sStock = getVariantSizeStock(product, selectedVariantIdx, size);
                  const sOut = sStock !== null && sStock <= 0;
                  const sLow = sStock !== null && sStock > 0 && sStock <= LOW_STOCK_THRESHOLD;
                  return (
                    <button
                      key={size}
                      type="button"
                      onClick={() => {
                        setSelectedSize(size);
                        setQuantity(1);
                      }}
                      className={`py-2 px-3 text-xs border text-center transition-all cursor-pointer uppercase tracking-wider flex flex-col items-center justify-center gap-0.5 ${
                        selectedSize === size
                          ? 'border-neutral-900 bg-neutral-900 text-white font-bold'
                          : sOut
                          ? 'border-neutral-200 bg-neutral-100 text-neutral-400'
                          : 'border-neutral-300 bg-white text-neutral-800 hover:border-neutral-400'
                      }`}
                    >
                      <span className={sOut ? 'line-through' : ''}>{size}</span>
                      {sOut && (
                        <span className={`text-[9px] font-extrabold ${selectedSize === size ? 'text-red-300' : 'text-red-600'}`}>
                          {language === 'ar' ? 'نفذت الكمية' : 'Sold Out'}
                        </span>
                      )}
                      {sLow && (
                        <span className={`text-[9px] font-extrabold ${selectedSize === size ? 'text-amber-300' : 'text-amber-700'}`}>
                          {language === 'ar' ? `متبقي ${sStock} فقط` : `Only ${sStock} left`}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live Stock Status Pill */}
            {currentStock !== null && (
              <div
                className={`mt-3 p-2.5 border text-[11px] font-bold flex items-center gap-2 ${
                  stockBadge.status === 'out'
                    ? 'bg-red-50 border-red-200 text-red-800'
                    : stockBadge.status === 'low'
                    ? 'bg-amber-50 border-amber-300 text-amber-900'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                }`}
              >
                {stockBadge.status === 'out' || stockBadge.status === 'low' ? (
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                ) : (
                  <PackageCheck className="w-4 h-4 shrink-0" />
                )}
                <span>
                  {language === 'ar' ? stockBadge.labelAr : stockBadge.labelEn}
                  {qtyInCartForSelection > 0 &&
                    (language === 'ar'
                      ? ` (${qtyInCartForSelection} في سلتك حالياً)`
                      : ` (${qtyInCartForSelection} already in your bag)`)}
                </span>
              </div>
            )}

            {/* 3. Quantity Counter */}
            <div className="mt-4 pt-3 border-t border-neutral-200 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-800">
                {t.quantity}
              </span>
              <div className="flex items-center border border-neutral-300 bg-white">
                <button
                  type="button"
                  disabled={isSoldOut || clampedQty <= 1}
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="px-3 py-1.5 hover:bg-neutral-100 font-bold text-sm cursor-pointer disabled:opacity-40"
                  aria-label="Decrease quantity"
                >
                  -
                </button>
                <span className="px-4 py-1.5 font-bold text-xs tabular-nums text-neutral-900">
                  {isSoldOut ? 0 : clampedQty}
                </span>
                <button
                  type="button"
                  disabled={isSoldOut || isBagLimitReached || clampedQty >= effectiveMax}
                  onClick={() => setQuantity((q) => Math.min(effectiveMax, q + 1))}
                  className="px-3 py-1.5 hover:bg-neutral-100 font-bold text-sm cursor-pointer disabled:opacity-40"
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
            </div>

          </div>

          {/* Action Buttons & Reassurance */}
          <div className="mt-6 pt-4 border-t border-neutral-200 space-y-2.5">
            {/* Add to Bag Button */}
            <button
              type="button"
              disabled={isSoldOut || isBagLimitReached}
              onClick={() => {
                onAddToCart(product, selectedVariantIdx, selectedSize, clampedQty);
                onClose();
              }}
              className="w-full bg-neutral-900 hover:bg-black text-white py-3.5 px-4 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs disabled:opacity-45 disabled:cursor-not-allowed"
            >
              <ShoppingBag className="w-4 h-4 text-amber-300" />
              <span>
                {isSoldOut
                  ? (language === 'ar' ? 'نفذت الكمية من هذا المقاس' : 'OUT OF STOCK')
                  : isBagLimitReached
                  ? (language === 'ar' ? 'تمت إضافة كامل الكمية المتاحة لسلتك' : 'MAX AVAILABLE IN BAG')
                  : t.addToBag}
              </span>
            </button>

            {/* Instant Checkout Button */}
            <button
              type="button"
              disabled={isSoldOut}
              onClick={() => {
                const instantMax = currentStock === null ? clampedQty : Math.min(quantity, currentStock);
                onInstantBuy(product, selectedVariantIdx, selectedSize, Math.max(1, instantMax));
                onClose();
              }}
              className="w-full bg-white hover:bg-neutral-100 text-neutral-900 border border-neutral-900 py-3 px-4 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
            >
              <Zap className="w-4 h-4 text-amber-600" />
              <span>{isSoldOut ? (language === 'ar' ? 'غير متوفر حالياً' : 'UNAVAILABLE') : t.instantBuy}</span>
            </button>

            {/* Inspection Guarantee */}
            <div className="bg-neutral-100 p-2.5 border border-neutral-200 flex items-center gap-2 text-[11px] text-neutral-700">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{t.inspectionNotice}</span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
