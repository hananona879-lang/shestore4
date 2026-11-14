import React from 'react';
import { Tag, SearchCheck, Zap, RefreshCw } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export const FeaturesStrip: React.FC = () => {
  const { t } = useLanguage();

  return (
    <section id="features-section" className="scroll-mt-28 border-t border-b border-neutral-300 py-10 px-4 bg-[#FAF7F2]">
      <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
        
        <div className="p-4 bg-white border border-neutral-200 shadow-xs flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center shrink-0 text-black">
            <Tag className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-xs sm:text-sm text-neutral-900 mb-1 uppercase tracking-wider">
              {t.featureFactoryDirectTitle}
            </h4>
            <p className="text-[11px] text-neutral-500 leading-relaxed">
              {t.featureFactoryDirectDesc}
            </p>
          </div>
        </div>

        <div className="p-4 bg-white border border-neutral-200 shadow-xs flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center shrink-0 text-black">
            <SearchCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-xs sm:text-sm text-neutral-900 mb-1 uppercase tracking-wider">
              {t.featureInspectionTitle}
            </h4>
            <p className="text-[11px] text-neutral-500 leading-relaxed">
              {t.featureInspectionDesc}
            </p>
          </div>
        </div>

        <div className="p-4 bg-white border border-neutral-200 shadow-xs flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center shrink-0 text-black">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-xs sm:text-sm text-neutral-900 mb-1 uppercase tracking-wider">
              {t.featureExpressTitle}
            </h4>
            <p className="text-[11px] text-neutral-500 leading-relaxed">
              {t.featureExpressDesc}
            </p>
          </div>
        </div>

        <div className="p-4 bg-white border border-neutral-200 shadow-xs flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center shrink-0 text-black">
            <RefreshCw className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-xs sm:text-sm text-neutral-900 mb-1 uppercase tracking-wider">
              {t.featureExchangesTitle}
            </h4>
            <p className="text-[11px] text-neutral-500 leading-relaxed">
              {t.featureExchangesDesc}
            </p>
          </div>
        </div>

      </div>
    </section>
  );
};
