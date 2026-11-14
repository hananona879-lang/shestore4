import React from 'react';
import { CheckCircle2, X, Truck, ShieldCheck, Printer, MessageCircle, Clock } from 'lucide-react';
import { PlacedOrder } from '../types';
import { WHATSAPP_PHONE } from '../data/products';
import { useLanguage } from '../context/LanguageContext';

interface OrderSuccessModalProps {
  order: PlacedOrder | null;
  isOpen: boolean;
  onClose: () => void;
}

export const OrderSuccessModal: React.FC<OrderSuccessModalProps> = ({
  order,
  isOpen,
  onClose,
}) => {
  const { language, isRTL, t } = useLanguage();

  if (!isOpen || !order) return null;

  const subtotal = order.subtotal ?? order.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const shippingCost = order.shippingCost ?? Math.max(0, order.total - subtotal);

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-fadeIn text-start ${isRTL ? 'rtl' : 'ltr'}`}>
      <div 
        className="bg-[#FAF7F2] w-full max-w-lg border border-neutral-400 p-6 sm:p-8 relative shadow-2xl no-scrollbar max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className={`absolute top-4 ${isRTL ? 'left-4' : 'right-4'} p-1.5 hover:bg-black/5 transition-colors cursor-pointer`}
          title="Close"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand Logo & Success Icon */}
        <div className="flex flex-col items-center justify-center mx-auto mb-4">
          <img 
            src="/assets/aistudio/WhatsApp_Image_2026-11-12_at_5.30.13_PM_2b767034.jpeg" 
            alt="She Store" 
            className="h-14 w-auto object-contain mb-3 mix-blend-multiply"
          />
          <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center border border-emerald-200">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
        </div>

        <div className="text-center mb-6">
          <span className="text-[10px] tracking-widest uppercase font-bold text-emerald-700 bg-emerald-100/80 px-3 py-1 inline-block">
            {t.orderSentTitle}
          </span>
          <h3 className="text-xl sm:text-2xl font-black text-neutral-900 mt-2 font-brand uppercase">
            {t.thankYouTitle}
          </h3>
          <p className="text-xs text-neutral-500 mt-1">
            {t.orderRef}: <span className="font-mono font-bold text-black text-sm">#{order.orderNumber}</span>
          </p>
        </div>

        {/* Full Receipt Box */}
        <div className="border border-neutral-300 bg-white p-4 space-y-3 text-xs mb-5">
          <div className="flex justify-between border-b border-neutral-200 pb-2 font-bold text-neutral-800 uppercase tracking-wider text-[11px]">
            <span>{t.orderSummaryTitle}</span>
            <span className="text-neutral-500 font-normal">{order.date}</span>
          </div>

          <div className="space-y-2 py-1">
            {order.items.map((it) => (
              <div key={it.id} className="flex justify-between items-center text-neutral-700 gap-2">
                <span>
                  <strong className="text-black">{it.quantity}x</strong> {language === 'ar' && it.nameAr ? it.nameAr : it.name}{' '}
                  <span className="text-neutral-500">
                    ({language === 'ar' && it.colorAr ? it.colorAr : it.color} / {language === 'ar' && it.sizeAr ? it.sizeAr : it.size})
                  </span>
                </span>
                <span className="font-bold tabular-nums shrink-0 text-black">
                  {it.price * it.quantity} {t.egp}
                </span>
              </div>
            ))}
          </div>

          <div className="border-t border-neutral-200 pt-2 space-y-1.5 text-neutral-600">
            <div className="flex justify-between gap-2">
              <span>{t.customerLabel}:</span>
              <span className="font-bold text-black">{order.customer.name}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span>{t.phoneLabel}:</span>
              <span className="text-black font-mono">{order.customer.phone}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span>{t.locationLabel}:</span>
              <span className="text-black text-end">{order.customer.governorate} - {order.customer.address}</span>
            </div>
            {order.customer.notes && (
              <div className="flex justify-between gap-2">
                <span>{language === 'ar' ? 'ملاحظات:' : 'Notes:'}</span>
                <span className="text-neutral-800 text-end">{order.customer.notes}</span>
              </div>
            )}
            {order.deliveryTime && (
              <div className="flex justify-between gap-2">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{language === 'ar' ? 'التوصيل المتوقع:' : 'Est. Delivery:'}</span>
                </span>
                <span className="font-semibold text-black">{order.deliveryTime}</span>
              </div>
            )}
          </div>

          <div className="border-t border-neutral-200 pt-2 space-y-1 text-neutral-600">
            <div className="flex justify-between">
              <span>{t.subtotal}:</span>
              <span className="font-semibold text-black tabular-nums">{subtotal} {t.egp}</span>
            </div>
            <div className="flex justify-between">
              <span>{t.shipping}:</span>
              <span className="font-semibold text-black tabular-nums">{shippingCost} {t.egp}</span>
            </div>
            <div className="flex justify-between">
              <span>{language === 'ar' ? 'طريقة الدفع:' : 'Payment:'}</span>
              <span className="font-semibold text-emerald-700">
                {language === 'ar' ? 'كاش عند الاستلام بعد المعاينة' : 'Cash on Delivery (Inspect First)'}
              </span>
            </div>
          </div>

          <div className="border-t border-neutral-300 pt-2.5 flex justify-between items-center text-sm font-black text-neutral-900">
            <span>{t.totalDueOnDelivery}:</span>
            <span className="text-base text-black tabular-nums">{order.total} {t.egp}</span>
          </div>
        </div>

        {/* Next Step Info */}
        <div className="bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900 mb-3 flex items-start gap-2">
          <Truck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed">
            {t.courierReminder}
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-200/80 p-2.5 text-xs text-amber-900 mb-6 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
          <p className="text-[11px] font-medium">
            {t.inspectionNotice}
          </p>
        </div>

        {/* CTA Buttons */}
        <div className="space-y-2">
          <button
            onClick={onClose}
            className="w-full bg-black hover:bg-neutral-800 text-white py-3.5 px-4 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
          >
            {t.backToShopping}
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="w-full bg-white hover:bg-neutral-100 text-neutral-800 border border-neutral-300 py-2.5 px-3 text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{language === 'ar' ? 'طباعة الفاتورة' : 'Print Receipt'}</span>
            </button>

            <a
              href={`https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(
                language === 'ar'
                  ? `مرحباً SHE STORE، أستفسر عن طلبي رقم #${order.orderNumber}`
                  : `Hello SHE STORE, I have a question about order #${order.orderNumber}`
              )}`}
              target="_blank"
              rel="noreferrer"
              className="w-full bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-300 py-2.5 px-3 text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span>{t.chatWhatsAppReceipt}</span>
            </a>
          </div>
        </div>

      </div>
    </div>
  );
};
