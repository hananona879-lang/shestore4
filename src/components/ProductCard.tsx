import React, { useState, useRef, useEffect } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Product } from '../types';
import { useLanguage } from '../context/LanguageContext';
import {
  LOW_STOCK_THRESHOLD,
  getProductTotalStock,
  getVariantTotalStock,
} from '../utils/inventory';

interface ProductCardProps {
  product: Product;
  index?: number;
  onOpenOptions: (product: Product, variantIndex: number) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  index = 0,
  onOpenOptions,
}) => {
  const [selectedVariantIdx, setSelectedVariantIdx] = useState(0);
  const activeVariant = product.variants[selectedVariantIdx] || product.variants[0];
  const { language, isRTL, t } = useLanguage();
  const shouldReduceMotion = useReducedMotion();

  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Handle cached images or variant image switches smoothly
  useEffect(() => {
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      setIsImageLoaded(true);
    } else {
      setIsImageLoaded(false);
    }
  }, [activeVariant.image]);

  const displayName = language === 'ar' && product.nameAr ? product.nameAr : product.name;
  const displayBadge = language === 'ar' && product.badgeAr ? product.badgeAr : product.badge;
  const displayColorName =
    language === 'ar' && activeVariant.colorNameAr
      ? activeVariant.colorNameAr
      : activeVariant.colorName;

  const activeVariantStock = getVariantTotalStock(product, selectedVariantIdx);
  const productTotalStock = getProductTotalStock(product);
  const isVariantSoldOut = activeVariantStock !== null && activeVariantStock <= 0;
  const isProductSoldOut = productTotalStock !== null && productTotalStock <= 0;
  const isLowStock =
    activeVariantStock !== null &&
    activeVariantStock > 0 &&
    activeVariantStock <= LOW_STOCK_THRESHOLD;

  const staggerDelay = shouldReduceMotion ? 0 : (index % 4) * 0.06;

  return (
    <motion.article
      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{
        duration: 0.55,
        delay: staggerDelay,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="group flex flex-col justify-between text-left h-full"
    >
      {/* 1. Main Photo Container */}
      <div
        onClick={() => onOpenOptions(product, selectedVariantIdx)}
        className="relative aspect-[3/4] w-full overflow-hidden bg-[#EFEAE1] cursor-pointer border border-neutral-200/80 transition-colors duration-300 group-hover:border-neutral-400"
      >
        {/* Subtle Warm Off-White Placeholder while photo loads */}
        {!isImageLoaded && (
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[#EDE7DD] animate-pulse"
          />
        )}

        <motion.div
          key={activeVariant.image}
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: isImageLoaded ? 1 : 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="w-full h-full"
        >
          <img
            ref={imgRef}
            src={activeVariant.image}
            alt={`${displayName} - ${displayColorName}`}
            onLoad={() => setIsImageLoaded(true)}
            onError={() => setIsImageLoaded(true)}
            className={`w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105 ${
              isVariantSoldOut ? 'opacity-65 grayscale-[30%]' : ''
            }`}
            loading="lazy"
          />
        </motion.div>

        {/* Badge */}
        {displayBadge && (
          <span className={`absolute top-2 ${isRTL ? 'right-2' : 'left-2'} z-10 bg-black text-white text-[8px] sm:text-[9px] font-bold px-2 py-0.5 tracking-wider uppercase`}>
            {displayBadge}
          </span>
        )}

        {/* Inventory Alert Badge */}
        {isVariantSoldOut ? (
          <span className={`absolute top-2 ${isRTL ? 'left-2' : 'right-2'} z-10 bg-red-700 text-white text-[8px] sm:text-[9px] font-extrabold px-2 py-0.5 tracking-wider uppercase shadow-xs`}>
            {language === 'ar' ? 'نفذت الكمية' : 'SOLD OUT'}
          </span>
        ) : isLowStock ? (
          <span className={`absolute top-2 ${isRTL ? 'left-2' : 'right-2'} z-10 bg-amber-500 text-black text-[8px] sm:text-[9px] font-extrabold px-2 py-0.5 tracking-wider uppercase shadow-xs`}>
            {language === 'ar' ? `متبقي ${activeVariantStock} فقط` : `ONLY ${activeVariantStock} LEFT`}
          </span>
        ) : null}

        {/* Quick color dots overlay at bottom of photo for instant tap preview */}
        <div
          className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 bg-black/60 backdrop-blur-xs px-2 py-1 rounded-full flex items-center gap-1.5 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {product.variants.map((v, idx) => {
            const vStock = getVariantTotalStock(product, idx);
            const vOut = vStock !== null && vStock <= 0;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedVariantIdx(idx)}
                style={{ backgroundColor: v.hex }}
                title={`${language === 'ar' && v.colorNameAr ? v.colorNameAr : v.colorName}${vOut ? (language === 'ar' ? ' (نفذت الكمية)' : ' (Sold Out)') : ''}`}
                className={`relative w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full border cursor-pointer transition-transform ${
                  selectedVariantIdx === idx
                    ? 'ring-1.5 ring-white scale-110 border-transparent'
                    : 'border-white/50 opacity-80 hover:opacity-100'
                } ${vOut ? 'opacity-40' : ''}`}
                aria-label={v.colorName}
              />
            );
          })}
        </div>
      </div>

      {/* 2. Text Details & CHOOSE OPTIONS Button */}
      <div className="pt-2.5 sm:pt-3 flex flex-col flex-1 justify-between">
        <div>
          {/* Title with underline aesthetic */}
          <h3
            onClick={() => onOpenOptions(product, selectedVariantIdx)}
            className="cursor-pointer font-brand text-xs sm:text-sm font-semibold tracking-wider text-neutral-900 uppercase leading-snug hover:opacity-75 transition-opacity"
          >
            <span className="border-b border-transparent group-hover:border-neutral-900 transition-colors inline-block pb-0.5">
              {displayName}
            </span>
          </h3>

          {/* Price & Low Stock hint */}
          <div className="mt-1 flex items-baseline justify-between gap-2 flex-wrap">
            <div className="flex items-baseline gap-2">
              <span className="text-xs sm:text-sm font-medium text-neutral-900 tracking-tight tabular-nums">
                {language === 'ar'
                  ? `${product.price.toLocaleString()} ${t.egp}`
                  : `LE ${product.price.toLocaleString()}.00 EGP`}
              </span>
              {product.originalPrice && (
                <span className="text-[10px] sm:text-xs text-neutral-400 line-through tabular-nums">
                  {language === 'ar'
                    ? `${product.originalPrice.toLocaleString()} ${t.egp}`
                    : `LE ${product.originalPrice.toLocaleString()}.00 EGP`}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* CHOOSE OPTIONS Button */}
        <button
          type="button"
          onClick={() => onOpenOptions(product, selectedVariantIdx)}
          className={`w-full mt-3 py-2 sm:py-2.5 px-2 border text-[10px] sm:text-xs font-semibold tracking-[0.18em] sm:tracking-[0.2em] uppercase transition-colors duration-200 cursor-pointer text-center ${
            isProductSoldOut
              ? 'border-neutral-300 bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
              : 'border-neutral-900 bg-transparent hover:bg-neutral-900 hover:text-white text-neutral-900'
          }`}
        >
          {isProductSoldOut
            ? (language === 'ar' ? 'نفذت الكمية' : 'SOLD OUT')
            : isVariantSoldOut
            ? (language === 'ar' ? 'اختر لوناً آخر' : 'VIEW OTHER COLORS')
            : t.chooseOptions}
        </button>
      </div>
    </motion.article>
  );
};
