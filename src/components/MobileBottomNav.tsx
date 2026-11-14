import React from 'react';
import { Home, Grid, HelpCircle, ShoppingBag, MessageCircle } from 'lucide-react';
import { WHATSAPP_PHONE } from '../data/products';

interface MobileBottomNavProps {
  cartCount: number;
  onOpenCart: () => void;
  onOpenSizeGuide: () => void;
  onOpenCategories: () => void;
  onGoHome: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  cartCount,
  onOpenCart,
  onOpenSizeGuide,
  onOpenCategories,
  onGoHome,
}) => {
  return (
    <nav 
      aria-label="التنقل السفلي للموبايل"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-neutral-200/90 py-1 px-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]"
    >
      <div className="grid grid-cols-5 items-center justify-items-center text-center">
        
        {/* 1. Home / Catalog */}
        <button
          onClick={onGoHome}
          className="flex flex-col items-center justify-center py-1.5 w-full text-neutral-800 hover:text-black transition-colors"
        >
          <Home className="w-5 h-5 stroke-[1.75]" />
          <span className="text-[10px] font-bold mt-1">الرئيسية</span>
        </button>

        {/* 2. Categories Drawer */}
        <button
          onClick={onOpenCategories}
          className="flex flex-col items-center justify-center py-1.5 w-full text-neutral-600 hover:text-black transition-colors"
        >
          <Grid className="w-5 h-5 stroke-[1.75]" />
          <span className="text-[10px] font-semibold mt-1">الأقسام</span>
        </button>

        {/* 3. Shopping Bag (Center Highlight) */}
        <button
          onClick={onOpenCart}
          className="flex flex-col items-center justify-center py-1 w-full relative text-black"
        >
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center shadow-md">
              <ShoppingBag className="w-5 h-5 stroke-[2]" />
            </div>
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center tabular-nums">
                {cartCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-black mt-0.5">الحقيبة</span>
        </button>

        {/* 4. Sizing Guide */}
        <button
          onClick={onOpenSizeGuide}
          className="flex flex-col items-center justify-center py-1.5 w-full text-neutral-600 hover:text-black transition-colors"
        >
          <HelpCircle className="w-5 h-5 stroke-[1.75]" />
          <span className="text-[10px] font-semibold mt-1">المقاسات</span>
        </button>

        {/* 5. Direct WhatsApp Chat */}
        <a
          href={`https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent('مرحباً SHE STORE، أود الاستفسار وتأكيد المقاس المناسب')}`}
          target="_blank"
          rel="noreferrer"
          className="flex flex-col items-center justify-center py-1.5 w-full text-emerald-600 hover:text-emerald-700 transition-colors"
        >
          <MessageCircle className="w-5 h-5 stroke-[1.75]" />
          <span className="text-[10px] font-bold mt-1">واتساب</span>
        </a>

      </div>
    </nav>
  );
};
