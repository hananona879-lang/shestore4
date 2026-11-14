import React, { useState } from 'react';
import { ShoppingBag, Instagram, Search, Sparkles, HelpCircle, Menu, X, MessageCircle, ChevronRight, Languages } from 'lucide-react';
import { INSTAGRAM_URL, INSTAGRAM_HANDLE, WHATSAPP_PHONE } from '../data/products';
import { useLanguage } from '../context/LanguageContext';
import { smoothScrollToSection, smoothScrollToTop } from '../utils/scroll';

export interface CategoryItem {
  id: string;
  label: string;
  labelAr?: string;
}

interface HeaderProps {
  cartCount: number;
  onOpenCart: () => void;
  onOpenSizeGuide: () => void;
  onSelectCategory: (cat: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isSearchOpen: boolean;
  setIsSearchOpen: (open: boolean) => void;
  categories?: CategoryItem[];
  activeCategory?: string;
}

export const Header: React.FC<HeaderProps> = ({
  cartCount,
  onOpenCart,
  onOpenSizeGuide,
  onSelectCategory,
  searchQuery,
  setSearchQuery,
  isSearchOpen,
  setIsSearchOpen,
  categories = [],
  activeCategory = 'all',
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { language, toggleLanguage, isRTL, t } = useLanguage();

  return (
    <>
      {/* 1. Slim Announcement Bar */}
      <div className="bg-black text-white text-[11px] sm:text-xs py-2 px-3 text-center tracking-wider font-medium flex items-center justify-center gap-3 overflow-x-auto no-scrollbar uppercase">
        <span className="flex items-center gap-1.5 shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          <span>{t.announcementFactoryDirect}</span>
        </span>
        <span className="opacity-40">•</span>
        <span className="shrink-0">{t.announcementInspection}</span>
        <span className="opacity-40">•</span>
        <span className="shrink-0">{t.announcementExpressDelivery}</span>
      </div>

      {/* 2. Main Top Navigation Bar - Centered Logo Layout */}
      <header className="sticky top-0 z-40 bg-[#FAF7F2]/95 backdrop-blur-md border-b border-neutral-300/80 px-3 sm:px-4 md:px-8 py-2 transition-shadow">
        <div className="max-w-7xl mx-auto grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
          
          {/* Side 1: Menu & Search */}
          <div className="flex items-center gap-1 sm:gap-2.5 justify-start min-w-0">
            {/* Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-1.5 sm:p-2 text-neutral-800 hover:text-black hover:bg-black/5 transition-colors cursor-pointer shrink-0"
              title="Menu"
              aria-label="Open Menu"
            >
              <Menu className="w-5 h-5 sm:w-6 sm:h-6 stroke-[1.75]" />
            </button>

            {/* Search Trigger */}
            <button
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="p-1.5 sm:p-2 text-neutral-800 hover:text-black hover:bg-black/5 transition-colors cursor-pointer shrink-0"
              title="Search"
              aria-label="Search items"
            >
              <Search className="w-5 h-5 stroke-[1.75]" />
            </button>
          </div>

          {/* Center: The Official Brand Logo (Dead Center, Isolated Track) */}
          <div className="flex items-center justify-center shrink-0 px-1 sm:px-3">
            <a 
              href="/"
              className="flex items-center justify-center group py-0.5"
              onClick={(e) => {
                e.preventDefault();
                onSelectCategory('all');
                smoothScrollToTop();
              }}
              title="SHE STORE"
            >
              <div className="relative flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
                <img 
                  src="/assets/aistudio/WhatsApp_Image_2026-11-12_at_5.30.13_PM_2b767034.jpeg" 
                  alt="She Store - Women's Clothes Store" 
                  className="h-11 sm:h-14 md:h-16 w-auto max-w-[110px] sm:max-w-[140px] object-contain mix-blend-multiply"
                />
              </div>
            </a>
          </div>

          {/* Side 2: Language Switcher, Instagram, Size Guide & Shopping Bag */}
          <div className="flex items-center gap-1 sm:gap-2.5 justify-end min-w-0">
            
            {/* Primary Language Toggle Button (EN | العربية) */}
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 text-[11px] font-bold border border-neutral-300 bg-white hover:bg-neutral-100 hover:border-black transition-colors cursor-pointer text-neutral-800 shrink-0"
              title="Switch Language / تبديل اللغة"
              aria-label="Switch Language"
            >
              <Languages className="w-3.5 h-3.5 text-neutral-600 shrink-0" />
              <span className="font-bold whitespace-nowrap">
                {language === 'en' ? 'العربية' : 'EN'}
              </span>
            </button>

            {/* Instagram Link */}
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noreferrer"
              className="p-2 text-neutral-700 hover:text-black hover:bg-black/5 transition-colors hidden sm:flex items-center gap-1.5 shrink-0"
              title="Instagram @she.store._eg"
            >
              <Instagram className="w-4 h-4 text-pink-600" />
              <span className="hidden xl:inline text-[11px] font-bold text-neutral-600 whitespace-nowrap">{INSTAGRAM_HANDLE}</span>
            </a>

            {/* Size Guide Trigger */}
            <button
              onClick={onOpenSizeGuide}
              className="p-2 text-neutral-700 hover:text-black hover:bg-black/5 transition-colors hidden sm:flex items-center gap-1 cursor-pointer shrink-0"
              title={t.sizeGuide}
            >
              <HelpCircle className="w-4 h-4 text-neutral-500" />
              <span className="hidden md:inline text-xs font-bold uppercase tracking-wider whitespace-nowrap">{t.navSizes}</span>
            </button>

            {/* Shopping Bag Button */}
            <button
              onClick={onOpenCart}
              className="relative p-1.5 sm:p-2 text-neutral-900 hover:opacity-75 transition-opacity cursor-pointer shrink-0"
              title={t.shoppingBag}
              aria-label="Shopping Bag"
            >
              <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6 stroke-[1.75]" />
              {cartCount > 0 && (
                <span className="absolute top-0.5 end-0 bg-black text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center tabular-nums">
                  {cartCount}
                </span>
              )}
            </button>
          </div>

        </div>

        {/* Desktop Category Navigation Row (Isolated beneath the logo so it never overlaps) */}
        <nav
          aria-label="Primary categories"
          className="hidden lg:flex items-center justify-center flex-wrap gap-x-6 gap-y-1.5 max-w-7xl mx-auto mt-1.5 pt-2 pb-0.5 border-t border-neutral-200/70 text-xs font-bold uppercase tracking-wider text-neutral-700"
        >
          <button
            onClick={() => {
              onSelectCategory('all');
            }}
            className={`hover:text-black transition-colors whitespace-nowrap cursor-pointer ${
              activeCategory === 'all' ? 'text-black font-extrabold underline underline-offset-4' : ''
            }`}
          >
            {t.navCollection}
          </button>

          {categories.slice(0, 6).map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                onSelectCategory(cat.id);
              }}
              className={`hover:text-black transition-colors whitespace-nowrap cursor-pointer ${
                activeCategory.toLowerCase() === cat.id.toLowerCase()
                  ? 'text-black font-extrabold underline underline-offset-4'
                  : ''
              }`}
            >
              {language === 'ar' && cat.labelAr ? cat.labelAr : cat.label}
            </button>
          ))}

          <span className="text-neutral-300 select-none">|</span>

          <button
            type="button"
            onClick={() => smoothScrollToSection('reviews-section')}
            className="hover:text-black transition-colors whitespace-nowrap cursor-pointer"
          >
            {language === 'ar' ? 'آراء العميلات' : 'Reviews'}
          </button>

          <button
            type="button"
            onClick={() => smoothScrollToSection('faq-section')}
            className="hover:text-black transition-colors whitespace-nowrap cursor-pointer"
          >
            {language === 'ar' ? 'الأسئلة الشائعة' : 'FAQ'}
          </button>
        </nav>

        {/* Collapsible Search Input */}
        {isSearchOpen && (
          <div className="max-w-2xl mx-auto mt-3 pt-3 border-t border-neutral-200 animate-fadeIn">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.searchPlaceholder}
                className="w-full bg-white border border-neutral-300 px-4 py-2.5 text-xs md:text-sm rounded-none focus:outline-none focus:border-black ps-10 pe-16"
                autoFocus
              />
              <Search className="w-4 h-4 text-neutral-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400 hover:text-black font-bold uppercase cursor-pointer"
                >
                  {t.clear}
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Slide-over Mobile Navigation Menu */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex justify-start bg-black/60 backdrop-blur-xs animate-fadeIn text-start">
          <div 
            className="absolute inset-0"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          <div 
            className="relative bg-[#FAF7F2] w-full max-w-xs sm:max-w-sm h-full flex flex-col justify-between shadow-2xl p-6 z-10 border-e border-neutral-300 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              {/* Drawer Top */}
              <div className="flex items-center justify-between pb-4 border-b border-neutral-300">
                <img 
                  src="/assets/aistudio/WhatsApp_Image_2026-11-12_at_5.30.13_PM_2b767034.jpeg" 
                  alt="She Store" 
                  className="h-12 w-auto object-contain mix-blend-multiply"
                />
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1.5 hover:bg-black/5 transition-colors cursor-pointer"
                  title="Close Menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Language Switcher in Mobile Drawer */}
              <div className="py-3 border-b border-neutral-200 flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-700">Language / اللغة</span>
                <button
                  onClick={toggleLanguage}
                  className="flex items-center gap-1.5 px-3 py-1 bg-white border border-neutral-300 text-xs font-bold text-neutral-900 cursor-pointer"
                >
                  <Languages className="w-3.5 h-3.5" />
                  <span>{language === 'en' ? 'العربية' : 'English'}</span>
                </button>
              </div>

              {/* Categories */}
              <div className="py-4 space-y-1">
                <span className="text-[10px] font-bold tracking-widest uppercase text-neutral-400 block mb-2 px-2">
                  {t.navAllCategories}
                </span>

                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    requestAnimationFrame(() => onSelectCategory('all'));
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-bold transition-colors uppercase tracking-wider cursor-pointer ${
                    activeCategory === 'all' ? 'bg-black text-white' : 'text-neutral-800 hover:bg-black/5 hover:text-black'
                  }`}
                >
                  <span>{t.allPieces}</span>
                  <ChevronRight className={`w-4 h-4 opacity-70 ${isRTL ? 'rotate-180' : ''}`} />
                </button>

                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      requestAnimationFrame(() => onSelectCategory(cat.id));
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-bold transition-colors uppercase tracking-wider cursor-pointer ${
                      activeCategory.toLowerCase() === cat.id.toLowerCase()
                        ? 'bg-black text-white'
                        : 'text-neutral-800 hover:bg-black/5 hover:text-black'
                    }`}
                  >
                    <span>{language === 'ar' && cat.labelAr ? cat.labelAr : cat.label}</span>
                    <ChevronRight className={`w-4 h-4 opacity-70 ${isRTL ? 'rotate-180' : ''}`} />
                  </button>
                ))}
              </div>

              {/* Page Sections Quick Smooth Links */}
              <div className="py-3 border-t border-neutral-200 space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    requestAnimationFrame(() => smoothScrollToSection('features-section'));
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-black/5 hover:text-black transition-colors cursor-pointer"
                >
                  <span>{language === 'ar' ? 'مميزات وضمان المتجر' : 'Store Guarantees'}</span>
                  <ChevronRight className={`w-3.5 h-3.5 opacity-60 ${isRTL ? 'rotate-180' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    requestAnimationFrame(() => smoothScrollToSection('reviews-section'));
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-black/5 hover:text-black transition-colors cursor-pointer"
                >
                  <span>{language === 'ar' ? 'آراء وتقييمات العميلات' : 'Customer Reviews'}</span>
                  <ChevronRight className={`w-3.5 h-3.5 opacity-60 ${isRTL ? 'rotate-180' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    requestAnimationFrame(() => smoothScrollToSection('faq-section'));
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-black/5 hover:text-black transition-colors cursor-pointer"
                >
                  <span>{language === 'ar' ? 'الأسئلة الشائعة' : 'FAQ'}</span>
                  <ChevronRight className={`w-3.5 h-3.5 opacity-60 ${isRTL ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {/* Customer Assistance */}
              <div className="pt-4 border-t border-neutral-200 space-y-1">
                <span className="text-[10px] font-bold tracking-widest uppercase text-neutral-400 block mb-2 px-2">
                  {t.customerAssistance}
                </span>
                
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onOpenSizeGuide();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-black/5 hover:text-black transition-colors cursor-pointer"
                >
                  <HelpCircle className="w-4 h-4 text-neutral-500" />
                  <span>{t.sizeGuide}</span>
                </button>

                <a
                  href={INSTAGRAM_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-black/5 hover:text-black transition-colors"
                >
                  <Instagram className="w-4 h-4 text-pink-600" />
                  <span>Instagram ({INSTAGRAM_HANDLE})</span>
                </a>

                <a
                  href={`https://wa.me/${WHATSAPP_PHONE}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 transition-colors"
                >
                  <MessageCircle className="w-4 h-4 text-emerald-600" />
                  <span>{t.whatsappSupport}</span>
                </a>
              </div>
            </div>

            {/* Drawer Bottom Guarantee */}
            <div className="pt-4 border-t border-neutral-300 text-[11px] text-neutral-500 text-center">
              <p className="font-bold text-black mb-0.5">✨ {t.announcementInspection}</p>
              <p>{t.announcementExpressDelivery}</p>
            </div>

          </div>
        </div>
      )}
    </>
  );
};
