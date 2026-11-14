import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useLanguage } from '../context/LanguageContext';

interface HeroProps {
  onShopClick: () => void;
  onOpenSizeGuide?: () => void;
}

const HERO_IMAGE = '/assets/aistudio/WhatsApp_Image_2026-11-13_at_8.38.29_PM_c3b86005.jpeg';

export const Hero: React.FC<HeroProps> = ({ onShopClick }) => {
  const { language, isRTL, t } = useLanguage();
  const shouldReduceMotion = useReducedMotion();

  const marqueeItems =
    language === 'ar'
      ? [
          'سعر المصنع مباشرة وبدون وسيط',
          'المعاينة مجاناً مع المندوب قبل الاستلام',
          'خامات فاخرة وقصّات عصرية محتشمة',
          'شحن سريع لجميع محافظات مصر',
          'SHE STORE EG • COLLECTION 2026',
        ]
      : [
          'FACTORY DIRECT PRICING',
          'INSPECT BEFORE PAYMENT WITH COURIER',
          'MODEST CONTEMPORARY SILHOUETTES',
          'EXPRESS CAIRO & ALL EGYPT DELIVERY',
          'SHE STORE EG • COLLECTION 2026',
        ];

  return (
    <section
      aria-label={language === 'ar' ? 'العرض الرئيسي للمتجر' : 'SHE STORE Hero'}
      className="relative w-full bg-[#EDE7DE] border-b border-[#111111]/15 overflow-hidden"
    >
      {/* Full-Width Edge-to-Edge Hero Photo (Both Phone & PC) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
        onClick={onShopClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onShopClick();
          }
        }}
        aria-label={t.heroShopCta}
        className="relative w-full aspect-[1024/1360] overflow-hidden cursor-pointer select-none bg-[#EDE7DE]"
      >
        <motion.img
          src={HERO_IMAGE}
          referrerPolicy="no-referrer"
          alt={
            language === 'ar'
              ? 'تشكيلة SHE STORE الجديدة — جاكيتات جلد وتريكو وحقيبة المتجر'
              : 'SHE STORE New Collection — Leather jacket, knitwear and boutique showcase'
          }
          animate={shouldReduceMotion ? undefined : { scale: [1, 1.022, 1] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
          style={{ transformOrigin: '50% 100%' }}
          className="w-full h-full object-cover object-bottom block"
        />

        {/* Subtle Warm Sunlight Sheen Sweep */}
        {!shouldReduceMotion && (
          <motion.div
            aria-hidden="true"
            className="absolute inset-y-0 w-48 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 pointer-events-none"
            animate={{ x: ['-45%', '480%'] }}
            transition={{
              duration: 9,
              repeat: Infinity,
              repeatDelay: 5,
              ease: 'easeInOut',
            }}
          />
        )}
      </motion.div>

      {/* Slow Monochrome Off-White & Black Editorial Marquee Strip */}
      <div
        dir="ltr"
        className="relative z-10 w-full bg-[#111111] text-[#FAF7F2] py-2.5 border-t border-[#111111] overflow-hidden select-none"
      >
        <div className="flex w-max">
          <motion.div
            animate={
              shouldReduceMotion
                ? undefined
                : { x: isRTL ? ['-50%', '0%'] : ['0%', '-50%'] }
            }
            transition={{
              duration: 55,
              repeat: Infinity,
              ease: 'linear',
            }}
            className="flex items-center gap-8 whitespace-nowrap text-[10px] sm:text-[11px] font-semibold tracking-[0.22em] uppercase pr-8"
          >
            {[...marqueeItems, ...marqueeItems, ...marqueeItems, ...marqueeItems].map(
              (item, idx) => (
                <span key={idx} className="inline-flex items-center gap-8">
                  <span>{item}</span>
                  <span className="text-[#FAF7F2]/45 text-[9px]">◆</span>
                </span>
              )
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
};
