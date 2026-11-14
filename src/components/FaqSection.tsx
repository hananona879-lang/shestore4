import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface FaqItem {
  question: string;
  questionAr: string;
  answer: string;
  answerAr: string;
}

const FAQS: FaqItem[] = [
  {
    question: "How does the courier inspection work before payment?",
    questionAr: "كيف تتم المعاينة مع المندوب قبل دفع ثمن الأوردر؟",
    answer: "When your delivery arrives, you have the full right to open the parcel and inspect the fabric, stitching, and color with the courier before handing over any money. If you are not satisfied for any reason, you only pay the standard shipping fee.",
    answerAr: "عند وصول مندوب الشحن، يحق لكِ تماماً فتح الشحنة ومعاينة جودة القماش، التقفيل، والألوان والتأكد من مطابقتها قبل دفع أي جنيه. في حال رغبتك في عدم الاستلام، تدفعين مصاريف الشحن فقط."
  },
  {
    question: "How long does delivery take to my city in Egypt?",
    questionAr: "كم يستغرق التوصيل لمحافظتي داخل مصر؟",
    answer: "Orders for Cairo, Giza, and Alexandria are typically delivered within 24 to 48 hours. Delta, Canal, and Upper Egypt governorates are delivered within 2 to 4 business days.",
    answerAr: "توصيل طلبات القاهرة، الجيزة والإسكندرية يتم عادةً خلال 24 إلى 48 ساعة. ومحافظات الدلتا والقناة والصعيد خلال 2 إلى 4 أيام عمل."
  },
  {
    question: "What is the fabric composition of the knit set?",
    questionAr: "ما هي مواصفات وجودة خامات أطقم وسوتات SHE STORE؟",
    answer: "Our pieces are crafted from high-density, anti-pilling ribbed knits, heavy cotton, and soft-grain leather blends. They are treated to prevent shrinkage, maintaining a luxurious drape.",
    answerAr: "نعتمد على خامات تريكو تركي وقطن محمل معالج ضد الوبر والانكماش، بالإضافة لجلود البومبر الفاخرة المبطنة بعناية لضمان إطلالة أنيقة وعمر طويل."
  },
  {
    question: "Can I exchange for a different size or color later?",
    questionAr: "هل متاح الاستبدال لمقاس أو لون آخر بعد الاستلام؟",
    answer: "Yes, we offer a 14-day exchange policy. Simply message our official WhatsApp number (01115010812) with your order code and we will arrange the replacement directly.",
    answerAr: "نعم بالطبع، نوفر سياسة استبدال سلسة خلال 14 يوماً. فقط تواصلي مع خدمة العملاء عبر الواتساب برقم الطلب وسنقوم بإرسال البديل حتى باب بيتك."
  },
  {
    question: "What payment methods are supported?",
    questionAr: "ما هي طرق الدفع المتاحة؟",
    answer: "We support Cash on Delivery (COD) upon receiving and inspecting your package. We also accept InstaPay and Vodafone Cash upon request.",
    answerAr: "الدفع عند الاستلام كاش بعد المعاينة، كما نوفر خيار الدفع عبر إنستاباي (InstaPay) أو فودافون كاش لمن يفضل ذلك."
  }
];

export const FaqSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const { language, t } = useLanguage();

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section id="faq-section" className="scroll-mt-28 py-14 px-4 bg-[#FAF7F2] border-b border-neutral-300">
      <div className="max-w-4xl mx-auto text-left">
        
        <div className="text-center mb-8">
          <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-400">
            {t.faqTag}
          </span>
          <h3 className="text-xl sm:text-2xl font-black text-neutral-900 mt-1 font-brand uppercase">
            {t.faqTitle}
          </h3>
          <p className="text-xs text-neutral-500 mt-1">
            {t.faqSubtitle}
          </p>
        </div>

        <div className="space-y-3">
          {FAQS.map((faq, idx) => (
            <div 
              key={idx} 
              className="border border-neutral-300 bg-white transition-all overflow-hidden"
            >
              <button
                type="button"
                onClick={() => toggle(idx)}
                className="w-full p-4 flex items-center justify-between text-left text-xs sm:text-sm font-bold text-neutral-900 hover:bg-neutral-50 transition-colors cursor-pointer"
              >
                <span>{language === 'ar' ? faq.questionAr : faq.question}</span>
                <ChevronDown 
                  className={`w-4 h-4 text-neutral-500 shrink-0 transition-transform duration-200 ${
                    openIndex === idx ? 'rotate-180 text-black' : ''
                  }`} 
                />
              </button>

              {openIndex === idx && (
                <div className="px-4 pb-4 pt-1 text-xs text-neutral-600 leading-relaxed border-t border-neutral-100 animate-fadeIn">
                  {language === 'ar' ? faq.answerAr : faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};
