import React, { useState } from 'react';
import { Lock, Eye, EyeOff, ArrowLeft, KeyRound, Languages, ShieldCheck } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { useLanguage } from '../../context/LanguageContext';
import { db } from '../../lib/firebase';
import { BOOTSTRAPPED_ADMIN_EMAIL, signInAdminWithGoogle, signOutAdminFirebase } from '../../services/firestoreStore';

interface AdminLoginProps {
  onLoginSuccess: () => void;
  onBackToStore: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({
  onLoginSuccess,
  onBackToStore,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const { language, toggleLanguage, isRTL, t } = useLanguage();

  const [isVerifying, setIsVerifying] = useState(false);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);

  const handleGoogleLogin = async () => {
    setError('');
    setIsGoogleSigningIn(true);
    try {
      const user = await signInAdminWithGoogle();
      const email = (user.email || '').toLowerCase();
      let authorized = email === BOOTSTRAPPED_ADMIN_EMAIL && user.emailVerified;
      if (!authorized && user.uid) {
        try {
          const adminDoc = await getDoc(doc(db, 'admins', user.uid));
          authorized = adminDoc.exists();
        } catch {
          authorized = false;
        }
      }
      if (authorized) {
        localStorage.setItem('shestore_admin_auth', 'true');
        onLoginSuccess();
      } else {
        await signOutAdminFirebase().catch(() => {});
        setError(
          language === 'ar'
            ? `الحساب (${user.email || ''}) غير مصرح له بإدارة المتجر. يرجى استخدام حساب ${BOOTSTRAPPED_ADMIN_EMAIL}`
            : `Account (${user.email || ''}) is not authorized for store admin access.`
        );
      }
    } catch (err) {
      const msg = (err as Error)?.message || '';
      if (!msg.includes('popup-closed-by-user')) {
        setError(
          language === 'ar'
            ? 'تعذر تسجيل الدخول بحساب Google. تأكدي من السماح بالنوافذ المنبثقة أو استخدمي كلمة المرور.'
            : 'Could not sign in with Google. Please allow popups or use the admin password.'
        );
      }
    } finally {
      setIsGoogleSigningIn(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);
    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        localStorage.setItem('shestore_admin_auth', 'true');
        setError('');
        setIsVerifying(false);
        onLoginSuccess();
        return;
      }
      if (res.status === 401) {
        setError(language === 'ar' ? 'كلمة المرور غير صحيحة، يرجى المحاولة مرة أخرى.' : 'Incorrect password. Please try again.');
        setIsVerifying(false);
        return;
      }
    } catch {
      // fallback to local check if network error
    }

    const storedPass = localStorage.getItem('shestore_admin_password') || 'shestore2026';
    if (password === storedPass) {
      localStorage.setItem('shestore_admin_auth', 'true');
      setError('');
      onLoginSuccess();
    } else {
      setError(language === 'ar' ? 'كلمة المرور غير صحيحة، يرجى المحاولة مرة أخرى.' : 'Incorrect password. Please try again.');
    }
    setIsVerifying(false);
  };

  return (
    <div className={`min-h-screen bg-[#FAF7F2] flex flex-col justify-center items-center px-4 py-12 selection:bg-black selection:text-white ${isRTL ? 'rtl' : 'ltr'}`}>
      
      {/* Return to Store Link */}
      <div className="w-full max-w-md mb-6 flex justify-between items-center">
        <button
          onClick={onBackToStore}
          className="inline-flex items-center gap-2 text-xs font-bold text-neutral-600 hover:text-black uppercase tracking-wider transition-colors cursor-pointer"
        >
          <ArrowLeft className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
          <span>{language === 'ar' ? 'العودة للمتجر' : 'Back to Storefront'}</span>
        </button>

        {/* Language switch */}
        <button
          onClick={toggleLanguage}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-700 hover:text-black px-2 py-1 bg-white border border-neutral-300 cursor-pointer"
        >
          <Languages className="w-3.5 h-3.5" />
          <span>{language === 'en' ? 'العربية' : 'English'}</span>
        </button>
      </div>

      {/* Card */}
      <div className="w-full max-w-md bg-white border border-neutral-300 p-8 shadow-sm">
        
        {/* Logo */}
        <div className="flex flex-col items-center text-center pb-6 border-b border-neutral-200">
          <img
            src="/assets/aistudio/WhatsApp_Image_2026-11-12_at_5.30.13_PM_2b767034.jpeg"
            alt="SHE STORE"
            className="h-16 w-auto object-contain mix-blend-multiply mb-3"
          />
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-neutral-100 text-[10px] font-extrabold uppercase tracking-widest text-neutral-800 border border-neutral-300">
            <Lock className="w-3 h-3 text-neutral-700" />
            <span>{t.adminPortal}</span>
          </div>
          <h1 className="text-xl font-black uppercase tracking-tight text-neutral-900 mt-3 font-brand">
            {language === 'ar' ? 'تسجيل دخول الإدارة' : 'Merchant Access'}
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            {language === 'ar' ? 'تسجيل الدخول لإدارة الطلبات والمنتجات والإعدادات' : 'Sign in to manage orders, catalog items & store settings'}
          </p>
        </div>

        {/* Google Cloud Sign-In (Recommended for permanent Firebase Sync) */}
        <div className="pt-5 pb-4 border-b border-neutral-200 space-y-2">
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isGoogleSigningIn}
            className="w-full bg-emerald-700 hover:bg-emerald-800 text-white py-3 px-4 text-xs font-bold tracking-wider uppercase transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-200" />
            <span>
              {isGoogleSigningIn
                ? (language === 'ar' ? 'جاري التحقق من الحساب...' : 'Signing in...')
                : (language === 'ar' ? 'دخول بحساب Google (للحفظ السحابي الدائم)' : 'Sign in with Google (Cloud Sync)')}
            </span>
          </button>
          <p className="text-[11px] text-neutral-500 text-center">
            {language === 'ar'
              ? 'مُوصى به لحفظ صور الفيدباك والمنتجات على السحابة بشكل دائم'
              : 'Recommended so feedback screenshots & catalog updates persist permanently'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="pt-5 space-y-4 text-left">
          
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-2">
              {language === 'ar' ? 'أو الدخول بكلمة مرور الإدارة' : 'Or Admin Password'}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                placeholder={language === 'ar' ? 'أدخلي كلمة المرور...' : 'Enter password...'}
                className="w-full bg-white border border-neutral-300 px-4 py-3 text-sm focus:outline-none focus:border-black rounded-none pr-10"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black cursor-pointer p-1"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {error && (
              <p className="text-xs font-semibold text-red-600 mt-2">
                {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isVerifying}
            className="w-full bg-black text-white hover:bg-neutral-800 py-3.5 text-xs font-bold tracking-widest uppercase transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <KeyRound className="w-4 h-4 text-amber-300" />
            <span>{language === 'ar' ? 'فتح لوحة التحكم' : 'Unlock Dashboard'}</span>
          </button>
        </form>

      </div>

      {/* Footer reassurance */}
      <div className="mt-8 text-center text-xs text-neutral-400">
        SHE STORE EG &copy; 2026 · Confidential Merchant Portal
      </div>

    </div>
  );
};
