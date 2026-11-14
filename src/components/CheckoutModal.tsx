import React, { useState } from 'react';
import { X, CheckCircle2, ShieldCheck, MapPin, Phone, User, FileText, Truck, Banknote, AlertCircle, Clock } from 'lucide-react';
import { CartItem, PlacedOrder, Product } from '../types';
import { EGYPT_GOVERNORATES } from '../data/governorates';
import { useLanguage } from '../context/LanguageContext';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onOrderSuccess: (order: PlacedOrder, updatedProducts?: Product[]) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  items,
  onOrderSuccess,
}) => {
  const { language, isRTL, t } = useLanguage();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [governorateName, setGovernorateName] = useState(EGYPT_GOVERNORATES[0].name);
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const selectedGov = EGYPT_GOVERNORATES.find((g) => g.name === governorateName) || EGYPT_GOVERNORATES[0];
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shipping = selectedGov.shippingCost;
  const grandTotal = subtotal + shipping;

  const govDisplayName = language === 'ar' ? selectedGov.nameAr : selectedGov.name;
  const deliveryTimeDisplay = language === 'ar' ? selectedGov.deliveryTimeAr : selectedGov.deliveryTime;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const trimmedAddress = address.trim();

    if (!trimmedName || !trimmedPhone || !trimmedAddress) {
      setErrorMsg(
        language === 'ar'
          ? 'يرجى استكمال الاسم ورقم الموبايل والعنوان بالتفصيل.'
          : 'Please complete your name, phone number, and delivery address.'
      );
      return;
    }

    const digitsOnly = trimmedPhone.replace(/\D/g, '');
    if (digitsOnly.length < 10) {
      setErrorMsg(
        language === 'ar'
          ? 'يرجى إدخال رقم موبايل صحيح للتواصل مع المندوب.'
          : 'Please enter a valid mobile phone number.'
      );
      return;
    }

    setIsSubmitting(true);

    const orderNumber = `SHE-${Math.floor(100000 + Math.random() * 900000)}`;
    const orderDate = new Date().toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const orderPayload: PlacedOrder = {
      orderNumber,
      customer: {
        name: trimmedName,
        phone: trimmedPhone,
        governorate: govDisplayName,
        address: trimmedAddress,
        notes: notes.trim(),
      },
      items: [...items],
      subtotal,
      shippingCost: shipping,
      deliveryTime: deliveryTimeDisplay,
      total: grandTotal,
      date: orderDate,
      status: 'pending',
    };

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Server error');
      }

      const data = await response.json();
      const confirmedOrder: PlacedOrder = data.order || orderPayload;

      // Also keep local cache copy
      try {
        const existingOrdersRaw = localStorage.getItem('shestore_orders');
        const existingOrders = existingOrdersRaw ? JSON.parse(existingOrdersRaw) : [];
        localStorage.setItem('shestore_orders', JSON.stringify([confirmedOrder, ...existingOrders]));
      } catch (err) {
        console.error(err);
      }

      setIsSubmitting(false);
      onOrderSuccess(confirmedOrder, Array.isArray(data.products) ? data.products : undefined);
    } catch (err) {
      console.error('Failed to submit order:', err);
      setIsSubmitting(false);
      const errMessage = (err as Error)?.message;
      setErrorMsg(
        errMessage && errMessage !== 'Server error'
          ? errMessage
          : language === 'ar'
          ? 'حدث خطأ أثناء إرسال الطلب. يرجى المحاولة مرة أخرى.'
          : 'Could not submit your order right now. Please try again.'
      );
    }
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-fadeIn text-start ${isRTL ? 'rtl' : 'ltr'}`}>
      <div 
        className="bg-[#FAF7F2] w-full max-w-xl max-h-[92vh] overflow-y-auto border border-neutral-400 p-5 sm:p-7 relative shadow-2xl no-scrollbar"
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

        {/* Title & Assurance */}
        <div className="pb-4 border-b border-neutral-300 mb-5">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-500 font-brand">
              {language === 'ar' ? 'SHE STORE • الطلب المباشر داخل الموقع' : 'SHE STORE • DIRECT WEBSITE CHECKOUT'}
            </span>
          </div>
          <h3 className="text-xl font-extrabold text-neutral-900 uppercase font-brand">
            {t.checkoutTitle}
          </h3>
          <p className="text-xs text-neutral-500 mt-0.5">
            {t.checkoutSubtitle}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          
          {errorMsg && (
            <div className="bg-red-50 border border-red-300 text-red-800 p-3 flex items-center gap-2 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Customer Details */}
          <div>
            <label className="block font-bold uppercase text-neutral-800 mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-neutral-500" />
              <span>{t.fullName} *</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.fullNamePlaceholder}
              className="w-full bg-white border border-neutral-300 p-2.5 text-xs focus:outline-none focus:border-black rounded-none"
            />
          </div>

          <div>
            <label className="block font-bold uppercase text-neutral-800 mb-1.5 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-neutral-500" />
              <span>{t.phoneLabel} *</span>
            </label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t.phonePlaceholder}
              className="w-full bg-white border border-neutral-300 p-2.5 text-xs font-mono focus:outline-none focus:border-black rounded-none"
            />
          </div>

          {/* Governorate Selection */}
          <div>
            <label className="block font-bold uppercase text-neutral-800 mb-1.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-neutral-500" />
              <span>{t.governorateLabel} *</span>
            </label>
            <select
              value={governorateName}
              onChange={(e) => setGovernorateName(e.target.value)}
              className="w-full bg-white border border-neutral-300 p-2.5 text-xs font-medium focus:outline-none focus:border-black rounded-none cursor-pointer"
            >
              {EGYPT_GOVERNORATES.map((gov) => (
                <option key={gov.name} value={gov.name}>
                  {language === 'ar' 
                    ? `${gov.nameAr} — (${gov.shippingCost} ج.م • ${gov.deliveryTimeAr})`
                    : `${gov.name} — (${gov.shippingCost} EGP • ${gov.deliveryTime})`
                  }
                </option>
              ))}
            </select>
          </div>

          {/* Detailed Street Address */}
          <div>
            <label className="block font-bold uppercase text-neutral-800 mb-1.5 flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-neutral-500" />
              <span>{t.addressLabel} *</span>
            </label>
            <textarea
              required
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={t.addressPlaceholder}
              className="w-full bg-white border border-neutral-300 p-2.5 text-xs focus:outline-none focus:border-black rounded-none"
            />
          </div>

          {/* Delivery Notes */}
          <div>
            <label className="block font-bold uppercase text-neutral-800 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-neutral-500" />
              <span>{t.notesLabel}</span>
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t.notesPlaceholder}
              className="w-full bg-white border border-neutral-300 p-2.5 text-xs focus:outline-none focus:border-black rounded-none"
            />
          </div>

          {/* Payment Method Info (Inside Website) */}
          <div className="bg-white border border-neutral-300 p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-extrabold uppercase text-[11px] tracking-wider text-neutral-900 flex items-center gap-1.5">
                <Banknote className="w-4 h-4 text-emerald-700" />
                <span>{language === 'ar' ? 'طريقة الدفع' : 'Payment Method'}</span>
              </span>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 uppercase">
                {language === 'ar' ? 'الدفع عند الاستلام' : 'Cash on Delivery'}
              </span>
            </div>
            <p className="text-[11px] text-neutral-600">
              {language === 'ar'
                ? 'لا يوجد أي دفع مسبق — تدفعين كاش للمندوب بعد استلام الطلب ومعاينة الخامة والمقاس.'
                : 'No upfront payment needed — pay in cash to the courier only after receiving and inspecting your order.'}
            </p>
          </div>

          {/* Full Order Summary Box */}
          <div className="bg-white border border-neutral-300 p-4 space-y-2 mt-4">
            <h4 className="font-extrabold uppercase text-[11px] tracking-wider text-neutral-900 border-b border-neutral-200 pb-2">
              {t.orderSummary} ({items.reduce((sum, i) => sum + i.quantity, 0)} {language === 'ar' ? 'قطع' : 'items'})
            </h4>

            <div className="space-y-2 py-1 max-h-44 overflow-y-auto no-scrollbar">
              {items.map((it) => (
                <div key={it.id} className="flex justify-between items-center text-neutral-700 text-[11px] gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {it.image && (
                      <img src={it.image} alt={it.name} className="w-8 h-10 object-cover border border-neutral-200 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-neutral-900 truncate">
                        {it.quantity}x {language === 'ar' && it.nameAr ? it.nameAr : it.name}
                      </p>
                      <p className="text-[10px] text-neutral-500">
                        {language === 'ar' && it.colorAr ? it.colorAr : it.color} • {language === 'ar' && it.sizeAr ? it.sizeAr : it.size}
                      </p>
                    </div>
                  </div>
                  <span className="font-bold tabular-nums shrink-0 text-neutral-900">
                    {it.price * it.quantity} {t.egp}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-neutral-200 pt-2 space-y-1.5 text-neutral-600">
              <div className="flex justify-between">
                <span>{t.subtotal}:</span>
                <span className="font-bold text-black tabular-nums">{subtotal} {t.egp}</span>
              </div>
              <div className="flex justify-between">
                <span>{t.shipping} ({govDisplayName}):</span>
                <span className="font-bold text-black tabular-nums">{shipping} {t.egp}</span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-neutral-500" />
                  <span>{language === 'ar' ? 'مدة التوصيل المتوقعة:' : 'Estimated Delivery:'}</span>
                </span>
                <span className="font-semibold text-neutral-800">{deliveryTimeDisplay}</span>
              </div>
            </div>

            <div className="border-t border-neutral-300 pt-2 flex justify-between items-center text-sm font-black text-neutral-900">
              <span>{t.totalDue}:</span>
              <span className="text-base text-black tabular-nums">
                {language === 'ar' ? `${grandTotal} ${t.egp}` : `${grandTotal} EGP`}
              </span>
            </div>
          </div>

          {/* Guarantee banner */}
          <div className="bg-emerald-50 border border-emerald-200 p-3 flex items-start gap-2.5 text-[11px] text-emerald-900">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>{t.inspectionAssurance}</span>
          </div>

          {/* Action button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-black hover:bg-neutral-800 text-white py-4 px-4 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{isSubmitting ? t.submitting : t.confirmWhatsAppOrder}</span>
          </button>

        </form>

      </div>
    </div>
  );
};
