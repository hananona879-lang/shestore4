import React from 'react';
import { X, Trash2, ArrowRight, ShoppingBag } from 'lucide-react';
import { CartItem, Product } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { findVariantIndexForItem, getVariantSizeStock } from '../utils/inventory';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  products?: Product[];
  onUpdateQuantity: (id: string, delta: number) => void;
  onRemoveItem: (id: string) => void;
  onCheckout: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  items,
  products = [],
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
}) => {
  const { language, isRTL, t } = useLanguage();

  if (!isOpen) return null;

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className={`fixed inset-0 z-50 flex ${isRTL ? 'justify-start' : 'justify-end'} bg-black/60 backdrop-blur-xs animate-fadeIn text-left ${isRTL ? 'rtl' : 'ltr'}`}>
      
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      <div 
        className="relative bg-[#FAF7F2] w-full max-w-md h-full flex flex-col justify-between shadow-2xl p-5 sm:p-6 border-l border-neutral-300 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-neutral-300">
          <div className="flex items-center gap-2.5">
            <img 
              src="/assets/aistudio/WhatsApp_Image_2026-11-12_at_5.30.13_PM_2b767034.jpeg" 
              alt="She Store" 
              className="h-9 w-auto object-contain mix-blend-multiply"
            />
            <div className="h-5 w-[1px] bg-neutral-300"></div>
            <h3 className="font-extrabold tracking-wider text-xs sm:text-sm uppercase text-neutral-900 font-brand">
              {t.yourBag}
            </h3>
            <span className="text-[11px] bg-black text-white px-2 py-0.5 font-bold tabular-nums">
              {totalCount}
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 hover:bg-black/5 transition-colors cursor-pointer"
            title="Close Bag"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Body (Items List) */}
        <div className="flex-1 overflow-y-auto py-4 space-y-3.5 no-scrollbar">
          {items.length === 0 ? (
            <div className="text-center py-24 px-4 space-y-3">
              <div className="w-16 h-16 mx-auto bg-white border border-neutral-200 flex items-center justify-center text-neutral-400">
                <ShoppingBag className="w-8 h-8" />
              </div>
              <p className="text-sm font-bold text-neutral-800 uppercase tracking-wider">{t.emptyBagTitle}</p>
              <p className="text-xs text-neutral-500 max-w-xs mx-auto">
                {t.emptyBagDesc}
              </p>
              <button
                onClick={onClose}
                className="mt-2 bg-black text-white px-6 py-2.5 text-xs font-bold uppercase tracking-wider hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                {t.exploreCollection}
              </button>
            </div>
          ) : (
            items.map((item) => {
              const matchedProd = products.find((p) => p.id === item.productId);
              const availStock = matchedProd
                ? getVariantSizeStock(matchedProd, findVariantIndexForItem(matchedProd, item), item.sizeAr || item.size)
                : null;
              const atMaxStock = availStock !== null && item.quantity >= availStock;

              return (
                <div
                  key={item.id}
                  className="flex gap-3 border border-neutral-200 p-2.5 bg-white hover:border-black transition-colors"
                >
                  {/* Thumbnail */}
                  <div className="w-16 h-20 bg-neutral-100 shrink-0 overflow-hidden border border-neutral-200">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Details */}
                  <div className="flex-1 flex flex-col justify-between text-xs">
                    <div>
                      <h4 className="font-bold text-neutral-900 line-clamp-1">
                        {language === 'ar' && item.nameAr ? item.nameAr : item.name}
                      </h4>
                      <div className="text-neutral-500 text-[11px] mt-0.5 flex items-center gap-2">
                        <span>{language === 'ar' && item.colorAr ? item.colorAr : item.color}</span>
                        <span>•</span>
                        <span>{language === 'ar' && item.sizeAr ? item.sizeAr : item.size}</span>
                      </div>
                      {availStock !== null && item.quantity >= availStock && (
                        <p className="text-[10px] text-amber-700 font-bold mt-0.5">
                          {availStock <= 0
                            ? (language === 'ar' ? 'نفذت الكمية من هذا المقاس' : 'Out of stock')
                            : (language === 'ar' ? `الحد الأقصى المتوفر: ${availStock}` : `Max available: ${availStock}`)}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <span className="font-bold text-neutral-900 tabular-nums">
                        {language === 'ar' ? `${(item.price * item.quantity).toLocaleString()} ${t.egp}` : `LE ${(item.price * item.quantity).toLocaleString()} EGP`}
                      </span>

                      {/* Quantity Selector */}
                      <div className="flex items-center border border-neutral-300">
                        <button
                          onClick={() => onUpdateQuantity(item.id, -1)}
                          className="px-2 py-0.5 hover:bg-neutral-100 text-xs font-bold cursor-pointer"
                        >
                          -
                        </button>
                        <span className="px-2.5 py-0.5 text-xs font-bold tabular-nums">
                          {item.quantity}
                        </span>
                        <button
                          disabled={atMaxStock}
                          onClick={() => onUpdateQuantity(item.id, 1)}
                          className="px-2 py-0.5 hover:bg-neutral-100 text-xs font-bold cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
                        >
                          +
                        </button>
                      </div>

                      <button
                        onClick={() => onRemoveItem(item.id)}
                        className="text-neutral-400 hover:text-red-600 transition-colors cursor-pointer p-1"
                        title={t.removeItem}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Drawer Footer with Subtotal & Checkout Button */}
        {items.length > 0 && (
          <div className="pt-4 border-t border-neutral-300 space-y-3">
            <div className="space-y-1 text-xs">
              <div className="flex justify-between items-center text-neutral-600">
                <span>{t.subtotal}</span>
                <span className="font-bold text-neutral-900 tabular-nums text-sm">
                  {language === 'ar' ? `${total.toLocaleString()} ${t.egp}` : `LE ${total.toLocaleString()}.00 EGP`}
                </span>
              </div>
              <p className="text-[10px] text-neutral-400">
                {t.shippingCalculatedAtCheckout}
              </p>
            </div>

            <button
              onClick={onCheckout}
              className="w-full bg-black hover:bg-neutral-800 text-white py-3.5 px-4 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
            >
              <span>{t.proceedToCheckout}</span>
              <ArrowRight className="w-4 h-4 text-amber-300" />
            </button>

            {/* Courier inspection reassurance */}
            <div className="bg-neutral-100 p-2 text-center text-[10px] text-neutral-600 border border-neutral-200">
              <span className="font-bold text-neutral-900">✨ {t.announcementInspection}</span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
