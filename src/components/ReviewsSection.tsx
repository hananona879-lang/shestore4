import React, { useEffect, useRef, useState } from 'react';
import {
  Star,
  CheckCircle,
  Instagram,
  Camera,
  X,
  ZoomIn,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { INSTAGRAM_URL } from '../data/products';
import { useLanguage } from '../context/LanguageContext';
import { FeedbackScreenshot } from '../types';
import { fetchPublishedFeedbacksFromCloud } from '../services/firestoreStore';

interface Review {
  name: string;
  nameAr: string;
  city: string;
  cityAr: string;
  item: string;
  itemAr: string;
  text: string;
  textAr: string;
  rating: number;
  date: string;
  dateAr: string;
}

const REVIEWS: Review[] = [
  {
    name: 'Marwa El-Desouky',
    nameAr: 'مروة الدسوقي',
    city: 'Fifth Settlement, Cairo',
    cityAr: 'التجمع الخامس، القاهرة',
    item: 'Oversized Knit Suit (Olive Green)',
    itemAr: 'سوت تريكو واسع (زيتي)',
    text: 'The fabric is so soft and cozy in person! The courier was very polite and waited while I opened the package and checked the knit quality before paying. The fit is beautifully relaxed.',
    textAr:
      'الخامة وهمية وناعمة جداً في اللبس! والمندوب كان محترم واستنى لحد ما فتحت وعاينت جودة التريكو قبل ما ادفع. القصة واسعة ومريحة جداً.',
    rating: 5,
    date: '4 days ago',
    dateAr: 'منذ 4 أيام',
  },
  {
    name: 'Nayerah Kamal',
    nameAr: 'نيرة كمال',
    city: 'Smouha, Alexandria',
    cityAr: 'سموحة، الإسكندرية',
    item: 'Oversized Knit Suit (Classic Black)',
    itemAr: 'سوت تريكو واسع (أسود)',
    text: 'Super chic and heavy-duty ribbed knit. Neat stitching and button finish with zero loose threads. Arrived in Alexandria in just 2 days. Ordering the brown set now!',
    textAr:
      'شيك جداً وخامة التريكو محملة وتقفيل الزراير والخياطة نظيف بدون أي خيوط زيادة. وصل إسكندرية في يومين بس، وبطلب اللون البني حالياً!',
    rating: 5,
    date: '1 week ago',
    dateAr: 'منذ أسبوع',
  },
  {
    name: 'Sarah Abdelrahman',
    nameAr: 'سارة عبد الرحمن',
    city: 'Mansoura, Dakahlia',
    cityAr: 'المنصورة، الدقهلية',
    item: 'Oversized Knit Suit (Mocha Brown)',
    itemAr: 'سوت تريكو واسع (بني موكا)',
    text: 'The mocha tone is gorgeous and modest—totally non-transparent and wrinkle resistant. Thank you for the quick responses on WhatsApp!',
    textAr:
      'درجة الموكا تحفة ومحتشمة ومش بتشف أبداً وما بتكرمش. شكراً جداً لذوقكم وسرعة الرد على الواتساب!',
    rating: 5,
    date: '2 weeks ago',
    dateAr: 'منذ أسبوعين',
  },
  {
    name: 'Heba El-Shennawy',
    nameAr: 'هبة الشناوي',
    city: 'Sheikh Zayed, Giza',
    cityAr: 'الشيخ زايد، الجيزة',
    item: 'Oversized Knit Suit (Olive Green)',
    itemAr: 'سوت تريكو واسع (زيتي)',
    text: 'My favorite everyday outfit this season. Genuine soft knit that looks like international boutique quality for a fraction of mall prices.',
    textAr:
      'أحلى طقم لبسته الموسم ده، تريكو ناعم بجودة البراندات العالمية وبسعر المصنع الحقيقي بدون مبالغة المولات.',
    rating: 5,
    date: '3 weeks ago',
    dateAr: 'منذ 3 أسابيع',
  },
];

export const ReviewsSection: React.FC = () => {
  const { language, isRTL, t } = useLanguage();
  const [feedbacks, setFeedbacks] = useState<FeedbackScreenshot[]>([]);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const trackRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      fetchPublishedFeedbacksFromCloud(),
      fetch('/api/feedbacks').then((res) => (res.ok ? res.json() : null)),
    ]).then(([cloudRes, serverRes]) => {
      if (!active) return;
      const cloudList: FeedbackScreenshot[] =
        cloudRes.status === 'fulfilled' && Array.isArray(cloudRes.value)
          ? cloudRes.value
          : [];
      const serverList: FeedbackScreenshot[] =
        serverRes.status === 'fulfilled' && Array.isArray(serverRes.value?.feedbacks)
          ? serverRes.value.feedbacks
          : [];

      const byId = new Map<string, FeedbackScreenshot>();
      // Add server entries first, then overwrite with Firestore cloud entries (permanent self-contained images)
      for (const item of serverList) {
        if (item?.id) byId.set(item.id, item);
      }
      for (const item of cloudList) {
        if (item?.id) byId.set(item.id, item);
      }

      const merged = [
        ...cloudList,
        ...serverList.filter((s) => !cloudList.some((c) => c.id === s.id)),
      ];
      setFeedbacks(merged.length > 0 ? merged : Array.from(byId.values()));
      setActiveIndex(0);
    });
    return () => {
      active = false;
    };
  }, []);

  const scrollToCard = (targetIdx: number) => {
    if (feedbacks.length === 0) return;
    const wrapped = (targetIdx + feedbacks.length) % feedbacks.length;
    setActiveIndex(wrapped);

    const container = trackRef.current;
    const card = cardRefs.current[wrapped];
    if (container && card) {
      const containerRect = container.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const delta =
        cardRect.left + cardRect.width / 2 - (containerRect.left + containerRect.width / 2);
      container.scrollBy({ left: delta, behavior: 'smooth' });
    }
  };

  // Physical left / right arrows behave intuitively in both RTL and LTR
  const handlePhysicalLeft = () => {
    scrollToCard(isRTL ? activeIndex + 1 : activeIndex - 1);
  };

  const handlePhysicalRight = () => {
    scrollToCard(isRTL ? activeIndex - 1 : activeIndex + 1);
  };

  const selectedScreenshot =
    selectedIndex !== null && feedbacks[selectedIndex] ? feedbacks[selectedIndex] : null;

  return (
    <section
      id="reviews-section"
      className={`scroll-mt-28 py-14 px-4 bg-white border-b border-neutral-300 ${isRTL ? 'rtl' : 'ltr'}`}
    >
      <div className="max-w-6xl mx-auto text-start">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 pb-4 border-b border-neutral-200 gap-4">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-400 block mb-1">
              {t.reviewsTag}
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-neutral-900 uppercase font-brand">
              {t.reviewsTitle}
            </h3>
            <p className="text-xs text-neutral-500 mt-1">{t.reviewsSubtitle}</p>
          </div>

          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-800 hover:text-black border border-neutral-300 px-3.5 py-2 hover:border-black transition-colors self-start md:self-auto"
          >
            <Instagram className="w-4 h-4 text-pink-600" />
            <span>{t.viewInstaHighlights}</span>
          </a>
        </div>

        {/* Real Uploaded Client Feedback Screenshots Horizontal Carousel */}
        {feedbacks.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-emerald-700" />
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-neutral-900">
                  {language === 'ar'
                    ? `لقطات حقيقية لآراء عميلاتنا (${feedbacks.length})`
                    : `Real Client Feedback Screenshots (${feedbacks.length})`}
                </h4>
              </div>

              {feedbacks.length > 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono font-bold text-neutral-500 tabular-nums">
                    {activeIndex + 1} / {feedbacks.length}
                  </span>
                </div>
              )}
            </div>

            <div className="relative group/carousel">
              {/* Physical Left Arrow Button */}
              {feedbacks.length > 1 && (
                <button
                  type="button"
                  onClick={handlePhysicalLeft}
                  aria-label={language === 'ar' ? 'السكرين شوت التالي يساراً' : 'Scroll left'}
                  className="absolute left-0 sm:left-1 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-10 sm:h-10 bg-black/85 hover:bg-black text-white border border-white/25 shadow-lg flex items-center justify-center cursor-pointer transition-transform active:scale-95"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}

              {/* Physical Right Arrow Button */}
              {feedbacks.length > 1 && (
                <button
                  type="button"
                  onClick={handlePhysicalRight}
                  aria-label={language === 'ar' ? 'السكرين شوت السابق يميناً' : 'Scroll right'}
                  className="absolute right-0 sm:right-1 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-10 sm:h-10 bg-black/85 hover:bg-black text-white border border-white/25 shadow-lg flex items-center justify-center cursor-pointer transition-transform active:scale-95"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}

              {/* Horizontal Single-Row Scroll Track (One Beside Another) */}
              <div
                ref={trackRef}
                className="flex flex-row items-start gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar px-10 sm:px-12 py-1"
              >
                {feedbacks.map((fb, idx) => {
                  const isActive = idx === activeIndex;
                  return (
                    <button
                      key={fb.id}
                      ref={(el) => {
                        cardRefs.current[idx] = el;
                      }}
                      type="button"
                      onClick={() => {
                        setActiveIndex(idx);
                        setSelectedIndex(idx);
                      }}
                      className={`group shrink-0 snap-center w-[250px] sm:w-[290px] md:w-[315px] border bg-[#FAF7F2] transition-all text-start overflow-hidden flex flex-col cursor-pointer ${
                        isActive
                          ? 'border-black shadow-md'
                          : 'border-neutral-300 hover:border-black'
                      }`}
                    >
                      <div className="relative w-full bg-[#F3EFE6] p-1.5 overflow-hidden">
                        <img
                          src={fb.image}
                          alt={fb.customerName || 'Client feedback screenshot'}
                          className="w-full h-auto max-h-[540px] object-contain mx-auto group-hover:scale-[1.015] transition-transform duration-300"
                        />
                        <span className="absolute top-2.5 right-2.5 bg-black/75 text-white text-[9px] font-bold px-2 py-0.5 flex items-center gap-1 opacity-90 group-hover:opacity-100">
                          <ZoomIn className="w-3 h-3" />
                          <span>{language === 'ar' ? 'تكبير' : 'Zoom'}</span>
                        </span>
                      </div>

                      {(fb.customerName || fb.productName || fb.caption) && (
                        <div className="p-2.5 space-y-1 border-t border-neutral-200 bg-white w-full">
                          {fb.customerName && (
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="font-bold text-[11px] text-neutral-900">
                                {fb.customerName}
                              </span>
                              <CheckCircle className="w-3 h-3 text-emerald-600 shrink-0" />
                            </div>
                          )}
                          {fb.productName && (
                            <p className="text-[10px] text-neutral-500">{fb.productName}</p>
                          )}
                          {fb.caption && (
                            <p className="text-[11px] text-neutral-700 leading-relaxed whitespace-pre-line">
                              {fb.caption}
                            </p>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Reviews Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {REVIEWS.map((rev, i) => (
            <div
              key={i}
              className="p-4 border border-neutral-200 bg-[#FAF7F2] flex flex-col justify-between hover:border-black transition-colors"
            >
              <div>
                {/* Rating stars */}
                <div className="flex items-center gap-1 text-amber-500 mb-2.5">
                  {[...Array(rev.rating)].map((_, idx) => (
                    <Star key={idx} className="w-3.5 h-3.5 fill-current" />
                  ))}
                  <span className="text-[10px] text-neutral-400 mx-2">
                    {language === 'ar' ? rev.dateAr : rev.date}
                  </span>
                </div>

                {/* Review Text */}
                <p className="text-xs text-neutral-700 leading-relaxed font-normal mb-3">
                  "{language === 'ar' ? rev.textAr : rev.text}"
                </p>
              </div>

              {/* Author & Item */}
              <div className="pt-3 border-t border-neutral-200/80">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-xs text-neutral-900">
                    {language === 'ar' ? rev.nameAr : rev.name}
                  </span>
                  <span title={t.verifiedClient} className="inline-flex">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  </span>
                </div>
                <div className="text-[10px] text-neutral-500 mt-0.5">
                  <span>{language === 'ar' ? rev.cityAr : rev.city}</span>
                </div>
                <div className="text-[10px] text-neutral-400 mt-1 truncate">
                  {language === 'ar' ? 'القطعة: ' : 'Item: '}
                  <span className="text-neutral-700 font-medium">
                    {language === 'ar' ? rev.itemAr : rev.item}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lightbox Modal for Screenshot Inspection with Left / Right Navigation */}
      {selectedScreenshot && selectedIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSelectedIndex(null)}
        >
          <div
            className="relative max-w-lg w-full bg-[#FAF7F2] border border-neutral-400 p-3 sm:p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelectedIndex(null)}
              className="absolute top-2.5 right-2.5 z-20 bg-black text-white p-1.5 hover:bg-neutral-800 cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            {feedbacks.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const nextIdx =
                      ((isRTL ? selectedIndex + 1 : selectedIndex - 1) + feedbacks.length) %
                      feedbacks.length;
                    setSelectedIndex(nextIdx);
                    scrollToCard(nextIdx);
                  }}
                  aria-label="Previous / Next left"
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 bg-black/85 hover:bg-black text-white flex items-center justify-center cursor-pointer shadow-md"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const nextIdx =
                      ((isRTL ? selectedIndex - 1 : selectedIndex + 1) + feedbacks.length) %
                      feedbacks.length;
                    setSelectedIndex(nextIdx);
                    scrollToCard(nextIdx);
                  }}
                  aria-label="Previous / Next right"
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 bg-black/85 hover:bg-black text-white flex items-center justify-center cursor-pointer shadow-md"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}

            <div className="bg-black/5 max-h-[75vh] overflow-auto flex items-center justify-center">
              <img
                src={selectedScreenshot.image}
                alt={selectedScreenshot.customerName || 'Client Feedback'}
                className="w-full h-auto max-h-[75vh] object-contain"
              />
            </div>

            {(selectedScreenshot.customerName ||
              selectedScreenshot.productName ||
              selectedScreenshot.caption) && (
              <div className="mt-3 pt-2.5 border-t border-neutral-300 text-xs space-y-1 text-start">
                {selectedScreenshot.customerName && (
                  <div className="flex items-center gap-1.5 font-bold text-neutral-900">
                    <span>{selectedScreenshot.customerName}</span>
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                )}
                {selectedScreenshot.productName && (
                  <p className="text-[11px] text-neutral-500">{selectedScreenshot.productName}</p>
                )}
                {selectedScreenshot.caption && (
                  <p className="text-xs text-neutral-800 whitespace-pre-line">
                    {selectedScreenshot.caption}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
