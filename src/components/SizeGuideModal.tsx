import React from 'react';
import { X, Check, Ruler } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface SizeGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SizeGuideModal: React.FC<SizeGuideModalProps> = ({ isOpen, onClose }) => {
  const { language, isRTL, t } = useLanguage();

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-fadeIn text-left ${isRTL ? 'rtl' : 'ltr'}`}>
      <div 
        className="bg-[#FAF7F2] w-full max-w-lg max-h-[92vh] overflow-y-auto border border-neutral-400 p-5 sm:p-7 relative shadow-2xl no-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 hover:bg-black/5 transition-colors cursor-pointer"
          title="Close"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="text-center mb-6 pb-3 border-b border-neutral-300">
          <div className="w-10 h-10 bg-white border border-neutral-300 mx-auto flex items-center justify-center rounded-full mb-2">
            <Ruler className="w-5 h-5 text-neutral-800" />
          </div>
          <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-400">
            SHE STORE • FIT & SIZING
          </span>
          <h3 className="text-xl font-black text-neutral-900 mt-1 font-brand uppercase">
            {t.sizeGuideTitle}
          </h3>
          <p className="text-xs text-neutral-500 mt-1">
            {t.sizeGuideSubtitle}
          </p>
        </div>

        {/* Size Chart */}
        <div className="mb-6">
          <div className="border border-neutral-300 bg-white divide-y divide-neutral-200 text-xs">
            <div className="bg-neutral-100 font-bold p-3 grid grid-cols-3 text-center uppercase tracking-wider text-[11px]">
              <span>{t.colSize}</span>
              <span>{t.colWeight}</span>
              <span>{t.colFit}</span>
            </div>

            <div className="p-3 grid grid-cols-3 text-center items-center">
              <span className="font-extrabold text-black">Free Size</span>
              <span className="text-neutral-700 font-medium">55 to 90 KG</span>
              <span className="text-neutral-500 text-[11px]">{t.freeSizeDesc}</span>
            </div>

            <div className="p-3 grid grid-cols-3 text-center items-center bg-neutral-50/50">
              <span className="font-extrabold text-black">Oversized</span>
              <span className="text-neutral-700 font-medium">90 to 120 KG</span>
              <span className="text-neutral-500 text-[11px]">{t.oversizedDesc}</span>
            </div>
          </div>
        </div>

        {/* Fabric & Measurements Notice */}
        <div className="space-y-3 mb-6 text-xs text-neutral-700">
          <div className="p-3 border border-neutral-200 bg-white">
            <h5 className="font-bold mb-1 text-black">{t.fabricStretchNoticeTitle}</h5>
            <p className="text-[11px] text-neutral-600 leading-relaxed">
              {t.fabricStretchNoticeDesc}
            </p>
          </div>
        </div>

        {/* Inspection Guarantee */}
        <div className="bg-emerald-50 p-3.5 border border-emerald-200 text-xs text-emerald-900 space-y-1">
          <div className="font-bold flex items-center gap-1.5">
            <Check className="w-4 h-4 text-emerald-700" />
            <span>{t.tryBeforePayTitle}</span>
          </div>
          <p className="text-[11px] text-emerald-800 leading-relaxed">
            {t.tryBeforePayDesc}
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-full bg-black text-white hover:bg-neutral-800 py-3 text-xs sm:text-sm font-bold uppercase tracking-wider mt-5 transition-colors cursor-pointer"
        >
          {t.closeGuide}
        </button>

      </div>
    </div>
  );
};
