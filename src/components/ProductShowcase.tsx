import React, { useState } from 'react';
import { MessageCircle, ShoppingBag, ShieldCheck, Ruler, Truck, RefreshCw } from 'lucide-react';
import { Product } from '../types';

interface ProductShowcaseProps {
  product: Product;
  onInstantBuy: (product: Product, variantIndex: number, size: string, quantity: number) => void;
  onAddToCart: (product: Product, variantIndex: number, size: string, quantity: number) => void;
  onOpenSizeGuide: () => void;
}

export const ProductShowcase: React.FC<ProductShowcaseProps> = ({
  product,
  onInstantBuy,
  onAddToCart,
  onOpenSizeGuide,
}) => {
  const [selectedVariantIdx, setSelectedVariantIdx] = useState(0);
  const [selectedSize, setSelectedSize] = useState(product.sizes[0] || 'Free Size (55 - 90 KG)');
  const [quantity, setQuantity] = useState(1);

  React.useEffect(() => {
    setSelectedVariantIdx(0);
    setSelectedSize(product.sizes[0] || 'Free Size (55 - 90 KG)');
    setQuantity(1);
  }, [product.id]);

  const activeVariant = product.variants[selectedVariantIdx] || product.variants[0];

  return (
    <article className="bg-[#FAF7F2] border border-neutral-300 p-4 sm:p-5 lg:p-6 shadow-xs flex flex-col justify-between h-full transition-all hover:border-neutral-400">
      
      {/* Top Section: Photo + Gallery + Info */}
      <div className="space-y-4">
        
        {/* Main Photo with smooth frame & badge */}
        <div className="relative aspect-[4/5] sm:aspect-[3/4] w-full overflow-hidden bg-white border border-neutral-200 shadow-xs">
          <img
            src={activeVariant.image}
            alt={`${product.name} - ${activeVariant.colorName}`}
            className="w-full h-full object-cover transition-opacity duration-300"
          />

          {product.badge && (
            <span className="absolute top-2.5 left-2.5 bg-black text-white text-[9px] sm:text-[10px] font-bold px-2 py-0.5 sm:px-2.5 sm:py-1 tracking-widest uppercase">
              {product.badge}
            </span>
          )}
        </div>

        {/* Thumbnail Gallery Strip (Tap to view any color / detail) */}
        <div className="grid grid-cols-4 gap-2">
          {product.variants.map((v, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setSelectedVariantIdx(idx)}
              className={`relative aspect-[3/4] overflow-hidden border transition-all cursor-pointer ${
                selectedVariantIdx === idx
                  ? 'ring-2 ring-black border-black scale-105 shadow-xs'
                  : 'border-neutral-300 opacity-60 hover:opacity-100'
              }`}
              title={v.colorName}
            >
              <img
                src={v.image}
                alt={v.colorName}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>

        {/* Product Meta */}
        <div className="space-y-2 pt-1 text-left">
          
          <p className="text-[10px] tracking-[0.25em] font-bold text-neutral-400 uppercase font-brand">
            SHE STORE — MADE TO MATCH
          </p>

          <h2 className="text-lg sm:text-xl font-extrabold text-neutral-900 tracking-tight font-brand uppercase leading-tight">
            {product.name}
          </h2>

          {/* Price */}
          <div className="flex items-baseline gap-2.5 pt-0.5">
            <span className="text-xl font-black text-neutral-900 tabular-nums">
              LE {product.price.toLocaleString()}.00 EGP
            </span>
            {product.originalPrice && (
              <span className="text-xs text-neutral-400 line-through tabular-nums">
                LE {product.originalPrice.toLocaleString()}.00 EGP
              </span>
            )}
          </div>

          <p className="text-[11px] text-neutral-500 font-medium">
            Cash on delivery · Full inspection before payment.
          </p>

          {/* Divider */}
          <div className="h-[1px] w-full bg-neutral-300 my-2" />

          {/* Exact caption per specification */}
          <div className="py-0.5">
            <p className="text-xs sm:text-sm font-semibold text-neutral-800 whitespace-pre-line leading-relaxed">
              {product.desc}
            </p>
            <p className="text-[11px] text-neutral-500 mt-1.5 leading-snug">
              Fabric: {product.fabric}
            </p>
          </div>

          {/* Divider */}
          <div className="h-[1px] w-full bg-neutral-300 my-2" />

          {/* COLOR Selection */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-700">
              COLOR: <span className="font-extrabold text-black">{activeVariant.colorName.toUpperCase()}</span>
            </div>

            <div className="flex items-center gap-2.5">
              {product.variants.map((v, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedVariantIdx(idx)}
                  style={{ backgroundColor: v.hex }}
                  title={v.colorName}
                  className={`w-6 h-6 rounded-full border transition-transform cursor-pointer ${
                    selectedVariantIdx === idx
                      ? 'ring-2 ring-black ring-offset-2 scale-110 border-transparent shadow-xs'
                      : 'border-neutral-300 opacity-70 hover:opacity-100'
                  }`}
                  aria-label={`Select ${v.colorName}`}
                />
              ))}
            </div>
          </div>

          {/* SIZE Selection */}
          <div className="space-y-1.5 pt-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-neutral-700">
              <span>SIZE:</span>
              <button
                type="button"
                onClick={onOpenSizeGuide}
                className="text-neutral-500 hover:text-black underline text-[10px] font-normal flex items-center gap-1 cursor-pointer"
              >
                <Ruler className="w-3 h-3" />
                <span>Size Guide</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {product.sizes.map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setSelectedSize(sz)}
                  className={`py-2 px-2 text-[11px] sm:text-xs font-bold border transition-all text-center cursor-pointer ${
                    selectedSize === sz
                      ? 'bg-black text-white border-black'
                      : 'bg-white text-neutral-900 border-neutral-300 hover:border-black'
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>

          {/* QUANTITY Stepper */}
          <div className="space-y-1.5 pt-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-700 block">
              QUANTITY:
            </label>
            
            <div className="inline-flex items-center border border-neutral-400 bg-white">
              <button
                type="button"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="px-3 py-1 text-sm font-bold hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                -
              </button>
              <span className="px-4 py-1 text-xs font-extrabold min-w-[32px] text-center tabular-nums">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity(quantity + 1)}
                className="px-3 py-1 text-sm font-bold hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                +
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* Bottom Section: Action Buttons & Guarantees */}
      <div className="space-y-2.5 pt-5 mt-4 border-t border-neutral-300">
        
        {/* WhatsApp Instant Order Button */}
        <button
          type="button"
          onClick={() => onInstantBuy(product, selectedVariantIdx, selectedSize, quantity)}
          className="w-full bg-black text-white hover:bg-neutral-800 py-3 text-xs font-bold tracking-widest uppercase flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer group"
        >
          <MessageCircle className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
          <span>ORDER VIA WHATSAPP (INSTANT)</span>
          <span className="text-amber-300">⚡</span>
        </button>

        {/* Add to Bag Button */}
        <button
          type="button"
          onClick={() => onAddToCart(product, selectedVariantIdx, selectedSize, quantity)}
          className="w-full bg-white text-black hover:bg-neutral-900 hover:text-white border border-black py-2.5 text-xs font-bold tracking-widest uppercase transition-colors flex items-center justify-center gap-2 cursor-pointer"
        >
          <ShoppingBag className="w-4 h-4" />
          <span>ADD TO BAG</span>
        </button>

        {/* Compact Guarantees */}
        <div className="pt-2 space-y-1.5 text-[11px] text-neutral-600">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Try & inspect with courier before paying</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Truck className="w-3.5 h-3.5 text-neutral-700 shrink-0" />
            <span>Express delivery to all Egypt governorates</span>
          </div>
          <div className="flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5 text-neutral-700 shrink-0" />
            <span>14-day exchange via WhatsApp support</span>
          </div>
        </div>

      </div>

    </article>
  );
};
