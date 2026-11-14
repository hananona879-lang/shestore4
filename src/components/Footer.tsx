import React from 'react';
import { Instagram, MessageCircle, Heart, Lock } from 'lucide-react';
import { INSTAGRAM_URL, INSTAGRAM_HANDLE, WHATSAPP_PHONE } from '../data/products';
import { useLanguage } from '../context/LanguageContext';
import { smoothScrollToSection, smoothScrollToTop } from '../utils/scroll';

interface FooterProps {
  onOpenSizeGuide: () => void;
  onSelectCategory: (cat: string) => void;
  onNavigateAdmin?: () => void;
  categories?: { id: string; label: string; labelAr?: string }[];
}

export const Footer: React.FC<FooterProps> = ({ 
  onOpenSizeGuide, 
  onSelectCategory, 
  onNavigateAdmin,
  categories = [] 
}) => {
  const { language, t } = useLanguage();

  return (
    <footer className="border-t border-neutral-300 py-12 px-4 bg-[#FAF7F2] text-left">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-neutral-300">
          
          {/* Brand Info */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <img 
                src="/assets/aistudio/WhatsApp_Image_2026-11-12_at_5.30.13_PM_2b767034.jpeg" 
                alt="She Store" 
                className="h-16 w-auto object-contain mix-blend-multiply"
              />
            </div>
            <p className="text-xs text-neutral-600 leading-relaxed max-w-sm">
              {t.footerDesc}
            </p>
            <div className="flex items-center gap-3 pt-2">
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-neutral-700 hover:text-black font-semibold border border-neutral-300 px-3 py-1.5 bg-white transition-colors"
              >
                <Instagram className="w-4 h-4 text-pink-600" />
                <span>{INSTAGRAM_HANDLE}</span>
              </a>

              <a
                href={`https://wa.me/${WHATSAPP_PHONE}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-white bg-emerald-700 hover:bg-emerald-800 font-semibold px-3 py-1.5 transition-colors shadow-xs"
              >
                <MessageCircle className="w-4 h-4" />
                <span>WhatsApp: 01115010812</span>
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-2 text-xs">
            <h5 className="font-bold text-neutral-900 uppercase tracking-wider text-xs mb-3 font-brand">
              {t.navCollection}
            </h5>
            <ul className="space-y-2 text-neutral-600">
              <li>
                <button
                  onClick={() => onSelectCategory('all')}
                  className="hover:text-black transition-colors cursor-pointer"
                >
                  {t.allPieces}
                </button>
              </li>
              {categories.slice(0, 4).map((cat) => (
                <li key={cat.id}>
                  <button
                    onClick={() => onSelectCategory(cat.id)}
                    className="hover:text-black transition-colors cursor-pointer"
                  >
                    {language === 'ar' && cat.labelAr ? cat.labelAr : cat.label}
                  </button>
                </li>
              ))}
              <li>
                <button
                  onClick={() => smoothScrollToSection('reviews-section')}
                  className="hover:text-black transition-colors cursor-pointer"
                >
                  {language === 'ar' ? 'آراء العميلات' : 'Customer Reviews'}
                </button>
              </li>
              <li>
                <button
                  onClick={() => smoothScrollToSection('faq-section')}
                  className="hover:text-black transition-colors cursor-pointer"
                >
                  {language === 'ar' ? 'الأسئلة الشائعة' : 'FAQ'}
                </button>
              </li>
              <li>
                <button
                  onClick={onOpenSizeGuide}
                  className="hover:text-black transition-colors font-semibold text-black cursor-pointer"
                >
                  {t.sizeGuide}
                </button>
              </li>
            </ul>
          </div>

          {/* Customer Care info & Merchant Login */}
          <div className="space-y-2 text-xs">
            <h5 className="font-bold text-neutral-900 uppercase tracking-wider text-xs mb-3 font-brand">
              {t.customerAssistance}
            </h5>
            <p className="text-neutral-500 text-[11px] leading-relaxed">
              {language === 'ar' 
                ? 'فريق خدمة العملاء متاح يومياً على واتساب لمساعدتك في اختيار المقاس وتتبع شحنتك.'
                : 'Our styling team is available daily on WhatsApp to help with sizing and order tracking.'
              }
            </p>
            <div className="pt-2 text-[11px] text-neutral-700 space-y-1">
              <div>📍 {t.footerHQ}</div>
              <div>🚚 {t.announcementExpressDelivery}</div>
              <div>✨ {t.announcementInspection}</div>
            </div>

            {/* Admin Portal Link */}
            {onNavigateAdmin && (
              <div className="pt-4">
                <button
                  onClick={onNavigateAdmin}
                  className="inline-flex items-center gap-1.5 text-[11px] text-neutral-500 hover:text-black font-bold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{t.merchantLogin}</span>
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Bottom copyright */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-[11px] text-neutral-500 gap-3">
          <p>© 2026 {t.footerRights}</p>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={smoothScrollToTop}
              className="text-neutral-700 hover:text-black font-bold uppercase tracking-wider underline underline-offset-4 cursor-pointer transition-colors"
            >
              {language === 'ar' ? 'العودة للأعلى ↑' : 'Back to Top ↑'}
            </button>
            <p className="flex items-center gap-1">
              <span>Made with quality in Egypt</span>
              <Heart className="w-3.5 h-3.5 text-red-500 fill-current" />
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};
