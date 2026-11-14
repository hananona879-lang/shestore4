import React, { useState, useEffect, useRef } from 'react';
import { 
  ShoppingBag, 
  Package, 
  DollarSign, 
  ExternalLink, 
  LogOut, 
  Plus, 
  Search, 
  MessageCircle, 
  CheckCircle, 
  Edit3, 
  Trash2, 
  Settings, 
  Save, 
  X,
  Upload, 
  Image as ImageIcon, 
  Check, 
  Languages, 
  Link as LinkIcon,
  Bell,
  RefreshCw,
  Send,
  Camera,
  AlertTriangle,
  Boxes,
  Minus,
  Cloud,
  CloudOff
} from 'lucide-react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { Product, PlacedOrder, Variant, StoreSettings, FeedbackScreenshot } from '../../types';
import { PRODUCTS, WHATSAPP_PHONE, INSTAGRAM_HANDLE, STORE_PHOTO_LIBRARY } from '../../data/products';
import { useLanguage } from '../../context/LanguageContext';
import { auth, db } from '../../lib/firebase';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  compressImageFileForCloud,
  deleteFeedbackFromCloud,
  fetchActiveProductsFromCloud,
  fetchPublishedFeedbacksFromCloud,
  fetchSettingsFromCloud,
  saveFeedbackToCloud,
  saveSettingsToCloud,
  signInAdminWithGoogle,
  signOutAdminFirebase,
  syncProductsToCloud,
} from '../../services/firestoreStore';
import {
  LOW_STOCK_THRESHOLD,
  DEFAULT_STOCK_PER_SIZE,
  ensureProductInventory,
  getProductTotalStock,
  getVariantSizeStock,
  normalizeVariantInventory,
  resolveCanonicalSizeKey,
} from '../../utils/inventory';

interface AdminDashboardProps {
  onNavigateStore: () => void;
  onLogout: () => void;
  onProductsUpdated?: (products: Product[]) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onNavigateStore,
  onLogout,
  onProductsUpdated,
}) => {
  const { language, toggleLanguage, isRTL, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'products' | 'inventory' | 'feedbacks' | 'settings'>('overview');

  // Load orders from server API (with localStorage fallback)
  const [orders, setOrders] = useState<PlacedOrder[]>(() => {
    try {
      const saved = localStorage.getItem('shestore_orders');
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return [];
  });
  const [isRefreshingOrders, setIsRefreshingOrders] = useState(false);

  const fetchServerOrders = async (showSpinner = false) => {
    if (showSpinner) setIsRefreshingOrders(true);
    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.orders)) {
          setOrders(data.orders);
          localStorage.setItem('shestore_orders', JSON.stringify(data.orders));
        }
      }
    } catch (err) {
      console.error('Failed to fetch orders from server:', err);
    } finally {
      if (showSpinner) setIsRefreshingOrders(false);
    }
  };

  useEffect(() => {
    fetchServerOrders(true);
    fetchServerProducts();
    const interval = setInterval(() => {
      fetchServerOrders(false);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Firebase Cloud Admin Auth & Sync state
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(() => auth.currentUser);
  const [isCloudConnecting, setIsCloudConnecting] = useState(false);

  // Feedback Screenshots state (synced with Firestore + /api/feedbacks)
  const [feedbacks, setFeedbacks] = useState<FeedbackScreenshot[]>([]);
  const [feedbackCustomerName, setFeedbackCustomerName] = useState('');
  const [feedbackProductName, setFeedbackProductName] = useState('');
  const [feedbackCaption, setFeedbackCaption] = useState('');
  const [feedbackUrlInput, setFeedbackUrlInput] = useState('');
  const [isUploadingFeedback, setIsUploadingFeedback] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const feedbackFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setFirebaseUser(null);
        return;
      }
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
        setFirebaseUser(user);
        // Hydrate Telegram & store settings from Firestore so they never vanish on restart
        fetchSettingsFromCloud()
          .then((cloudSettings) => {
            if (cloudSettings && (cloudSettings.telegramBotToken || cloudSettings.telegramChatId || cloudSettings.ownerEmail)) {
              applySettingsObject(cloudSettings);
              try {
                localStorage.setItem('shestore_admin_settings', JSON.stringify(cloudSettings));
              } catch {
                // ignore
              }
              fetch('/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ settings: cloudSettings }),
              }).catch(() => {});
            }
          })
          .catch(() => {});
      } else {
        setFirebaseUser(null);
      }
    });
    return () => unsub();
  }, []);

  const handleConnectCloud = async () => {
    setIsCloudConnecting(true);
    setFeedbackError(null);
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
      if (!authorized) {
        await signOutAdminFirebase().catch(() => {});
        setFeedbackError(
          language === 'ar'
            ? `الحساب (${user.email || ''}) غير مصرح له. يرجى اختيار ${BOOTSTRAPPED_ADMIN_EMAIL}`
            : `Account (${user.email || ''}) is not authorized. Please select ${BOOTSTRAPPED_ADMIN_EMAIL}.`
        );
        return;
      }
      setFirebaseUser(user);
      // Back up any server-only feedbacks, products, and Telegram/store settings into Firestore
      const cloudFeedbacks = await fetchPublishedFeedbacksFromCloud().catch(() => []);
      const cloudIds = new Set(cloudFeedbacks.map((f) => f.id));
      for (const fb of feedbacks) {
        if (!cloudIds.has(fb.id)) {
          await saveFeedbackToCloud(fb, user.uid).catch(() => {});
        }
      }
      await syncProductsToCloud(productsList).catch(() => {});
      const currentSettingsObj: StoreSettings = {
        adminPhone,
        instaHandle,
        adminPassword,
        telegramBotToken,
        telegramChatId,
        callmebotPhone: '',
        callmebotApiKey: '',
        textmebotApiKey: '',
        ultramsgInstanceId: '',
        ultramsgToken: '',
        metaWhatsappPhoneId: '',
        metaWhatsappToken: '',
        webhookUrl,
        ownerEmail,
        resendApiKey,
      };
      const existingCloudSettings = await fetchSettingsFromCloud().catch(() => null);
      if (existingCloudSettings && (existingCloudSettings.telegramBotToken || existingCloudSettings.telegramChatId) && !telegramBotToken.trim()) {
        applySettingsObject(existingCloudSettings);
        fetch('/api/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ settings: existingCloudSettings }),
        }).catch(() => {});
      } else if (telegramBotToken.trim() || telegramChatId.trim() || ownerEmail.trim()) {
        await saveSettingsToCloud(currentSettingsObj, user.uid).catch(() => {});
      }
      await fetchFeedbacks();
      setFeedbackBanner(
        language === 'ar'
          ? 'تم ربط الحفظ السحابي الدائم (Firebase) ومزامنة بياناتك وإعدادات التيليجرام بنجاح! ☁️'
          : 'Permanent Firebase Cloud Sync connected and backed up!'
      );
      setTimeout(() => setFeedbackBanner(null), 5000);
    } catch (err) {
      const msg = (err as Error)?.message || '';
      if (!msg.includes('popup-closed-by-user')) {
        setFeedbackError(
          language === 'ar'
            ? 'تعذر ربط حساب Google. تأكدي من السماح بالنوافذ المنبثقة وحاولي مرة أخرى.'
            : 'Could not connect Google account. Please allow popups and try again.'
        );
      }
    } finally {
      setIsCloudConnecting(false);
    }
  };

  const fetchFeedbacks = async () => {
    try {
      const [cloudRes, serverRes] = await Promise.allSettled([
        fetchPublishedFeedbacksFromCloud(),
        fetch('/api/feedbacks').then((r) => (r.ok ? r.json() : null)),
      ]);
      const cloudList: FeedbackScreenshot[] =
        cloudRes.status === 'fulfilled' && Array.isArray(cloudRes.value) ? cloudRes.value : [];
      const serverList: FeedbackScreenshot[] =
        serverRes.status === 'fulfilled' && Array.isArray(serverRes.value?.feedbacks)
          ? serverRes.value.feedbacks
          : [];

      const merged = [
        ...cloudList,
        ...serverList.filter((s) => !cloudList.some((c) => c.id === s.id)),
      ];
      setFeedbacks(merged);
    } catch (err) {
      console.error('Failed to fetch feedback screenshots:', err);
    }
  };

  useEffect(() => {
    fetchFeedbacks();
  }, []);

  const handleFeedbackFilesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingFeedback(true);
    setFeedbackBanner(null);
    setFeedbackError(null);
    let uploadedCount = 0;
    let savedToCloudCount = 0;
    const activeUser = firebaseUser || auth.currentUser;

    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue;
        const compressedDataUrl = await compressImageFileForCloud(file);
        const res = await fetch('/api/feedbacks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: compressedDataUrl,
            customerName: feedbackCustomerName.trim(),
            productName: feedbackProductName.trim(),
            caption: feedbackCaption.trim(),
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const created: FeedbackScreenshot | undefined = data.feedback;
          uploadedCount += 1;

          if (created && activeUser) {
            try {
              // Store self-contained compressed data URL directly inside Firestore so image survives container resets
              await saveFeedbackToCloud(
                { ...created, image: compressedDataUrl },
                activeUser.uid
              );
              savedToCloudCount += 1;
            } catch (cloudErr) {
              console.error('Firestore feedback save failed:', cloudErr);
            }
          }
        } else {
          const errData = await res.json().catch(() => ({}));
          setFeedbackError(errData.error || 'Failed to upload image.');
        }
      }

      if (uploadedCount > 0) {
        await fetchFeedbacks();
        setFeedbackCustomerName('');
        setFeedbackProductName('');
        setFeedbackCaption('');
        setFeedbackBanner(
          savedToCloudCount > 0
            ? (language === 'ar'
              ? `تم رفع ${uploadedCount} اسكرين شوت وحفظها على السحابة بشكل دائم! ☁️`
              : `Uploaded ${uploadedCount} screenshot(s) & saved permanently to Cloud!`)
            : (language === 'ar'
              ? `تم رفع ${uploadedCount} اسكرين شوت مؤقتاً — اضغطي "تفعيل الحفظ السحابي" بالأعلى لحفظها للأبد.`
              : `Uploaded ${uploadedCount} screenshot(s) locally — connect Google Cloud above to keep permanently.`)
        );
        setTimeout(() => setFeedbackBanner(null), 5000);
      }
    } catch (err) {
      console.error('Failed uploading feedback screenshot:', err);
      setFeedbackError(
        language === 'ar'
          ? 'حدث خطأ أثناء رفع الصورة. يرجى المحاولة مرة أخرى.'
          : 'Error uploading screenshot. Please try again.'
      );
    } finally {
      setIsUploadingFeedback(false);
      if (feedbackFileInputRef.current) {
        feedbackFileInputRef.current.value = '';
      }
    }
  };

  const handleAddFeedbackUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = feedbackUrlInput.trim();
    if (!url) return;

    setIsUploadingFeedback(true);
    setFeedbackError(null);
    const activeUser = firebaseUser || auth.currentUser;
    try {
      const res = await fetch('/api/feedbacks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: url,
          customerName: feedbackCustomerName.trim(),
          productName: feedbackProductName.trim(),
          caption: feedbackCaption.trim(),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const created: FeedbackScreenshot | undefined = data.feedback;
        if (created && activeUser) {
          await saveFeedbackToCloud(created, activeUser.uid).catch((err) => {
            console.error('Cloud URL save error:', err);
          });
        }
        await fetchFeedbacks();
        setFeedbackUrlInput('');
        setFeedbackCustomerName('');
        setFeedbackProductName('');
        setFeedbackCaption('');
        setFeedbackBanner(
          activeUser
            ? (language === 'ar'
              ? 'تمت إضافة الاسكرين شوت وحفظها على السحابة بشكل دائم! ☁️'
              : 'Screenshot added & saved permanently to Cloud!')
            : (language === 'ar'
              ? 'تمت إضافة الاسكرين شوت مؤقتاً — اربطي حساب Google لحفظها للأبد.'
              : 'Screenshot added — connect Google Cloud to keep permanently.')
        );
        setTimeout(() => setFeedbackBanner(null), 4000);
      } else {
        setFeedbackError(
          language === 'ar' ? 'تعذر إضافة رابط الصورة.' : 'Could not add screenshot URL.'
        );
      }
    } finally {
      setIsUploadingFeedback(false);
    }
  };

  const [pendingDelete, setPendingDelete] = useState<{
    type: 'feedback' | 'order' | 'product';
    id: string;
    message: string;
  } | null>(null);
  const [isDeletingItem, setIsDeletingItem] = useState(false);

  const handleDeleteFeedback = (id: string) => {
    setPendingDelete({
      type: 'feedback',
      id,
      message:
        language === 'ar'
          ? 'هل أنتِ متأكدة من حذف هذا الاسكرين شوت من المتجر؟'
          : 'Delete this feedback screenshot from your store?',
    });
  };

  const executePendingDelete = async () => {
    if (!pendingDelete) return;
    setIsDeletingItem(true);
    try {
      if (pendingDelete.type === 'feedback') {
        const targetId = pendingDelete.id;
        await fetch(`/api/feedbacks/${encodeURIComponent(targetId)}`, {
          method: 'DELETE',
        }).catch(() => {});
        if (firebaseUser || auth.currentUser) {
          await deleteFeedbackFromCloud(targetId).catch(() => {});
        }
        setFeedbacks((prev) => prev.filter((f) => f.id !== targetId));
        setFeedbackBanner(
          language === 'ar' ? 'تم حذف الاسكرين شوت بنجاح.' : 'Feedback screenshot deleted.'
        );
        setTimeout(() => setFeedbackBanner(null), 3000);
      } else if (pendingDelete.type === 'order') {
        const orderNumber = pendingDelete.id;
        setOrders((prev) => prev.filter((o) => o.orderNumber !== orderNumber));
        const res = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}`, {
          method: 'DELETE',
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.products)) {
            syncLocalProducts(data.products);
          }
        }
      } else if (pendingDelete.type === 'product') {
        const numId = Number(pendingDelete.id);
        const updated = productsList.filter((p) => p.id !== numId);
        updateProducts(updated);
      }
    } catch (err) {
      console.error('Delete action failed:', err);
    } finally {
      setIsDeletingItem(false);
      setPendingDelete(null);
    }
  };

  // Save orders cache to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('shestore_orders', JSON.stringify(orders));
    } catch (e) {
      console.error(e);
    }
  }, [orders]);

  // Load products from localStorage or default
  const [productsList, setProductsList] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem('shestore_admin_products');
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return PRODUCTS;
  });

  // Custom uploaded photos saved in localStorage
  const [userUploadedPhotos, setUserUploadedPhotos] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('shestore_user_photos');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [];
  });

  const saveUserPhoto = (dataUrl: string) => {
    setUserUploadedPhotos((prev) => {
      const next = [dataUrl, ...prev.filter((p) => p !== dataUrl)].slice(0, 30);
      try {
        localStorage.setItem('shestore_user_photos', JSON.stringify(next));
      } catch (err) {
        console.warn('LocalStorage limit reached for custom photos:', err);
      }
      return next;
    });
  };

  // Sync local state & parent without looping server PUT
  const syncLocalProducts = (nextProducts: Product[]) => {
    setProductsList(nextProducts);
    try {
      localStorage.setItem('shestore_admin_products', JSON.stringify(nextProducts));
    } catch (e) {
      console.error(e);
    }
    if (onProductsUpdated) {
      onProductsUpdated(nextProducts);
    }
  };

  const fetchServerProducts = async () => {
    try {
      const [cloudRes, serverRes] = await Promise.allSettled([
        fetchActiveProductsFromCloud(),
        fetch('/api/products').then((r) => (r.ok ? r.json() : null)),
      ]);
      const cloudProducts =
        cloudRes.status === 'fulfilled' && Array.isArray(cloudRes.value) && cloudRes.value.length > 0
          ? cloudRes.value
          : null;
      const serverProducts =
        serverRes.status === 'fulfilled' && Array.isArray(serverRes.value?.products) && serverRes.value.products.length > 0
          ? serverRes.value.products
          : null;
      const resolved = cloudProducts || serverProducts;
      if (resolved) {
        syncLocalProducts(resolved);
      }
    } catch (err) {
      console.error('Failed to fetch products:', err);
    }
  };

  // Save products to server + Firestore + localStorage and update parent
  const updateProducts = async (newProducts: Product[]) => {
    const normalized = newProducts.map((p) => (p.trackStock === false ? p : ensureProductInventory(p)));
    syncLocalProducts(normalized);
    if (firebaseUser || auth.currentUser) {
      syncProductsToCloud(normalized).catch((err) =>
        console.error('Failed to sync products to cloud:', err)
      );
    }
    try {
      const res = await fetch('/api/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: normalized }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.products)) {
          syncLocalProducts(data.products);
        }
      }
    } catch (err) {
      console.error('Failed to save products to server:', err);
    }
  };

  // Inventory filter state & quick stock adjusters
  const [inventoryFilter, setInventoryFilter] = useState<'all' | 'low' | 'out'>('all');
  const [inventorySearch, setInventorySearch] = useState('');
  const [savingStockKey, setSavingStockKey] = useState<string | null>(null);

  const handlePatchProductStock = async (
    productId: number,
    payload: { variantIndex?: number; size?: string; qty?: number; delta?: number; trackStock?: boolean }
  ) => {
    const opKey = `${productId}-${payload.variantIndex ?? 'all'}-${payload.size ?? 'all'}`;
    setSavingStockKey(opKey);
    try {
      const res = await fetch(`/api/products/${productId}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.products)) {
          syncLocalProducts(data.products);
          if (firebaseUser || auth.currentUser) {
            syncProductsToCloud(data.products).catch((err) =>
              console.error('Failed to sync stock to cloud:', err)
            );
          }
        }
      }
    } catch (err) {
      console.error('Failed to update stock:', err);
    } finally {
      setSavingStockKey(null);
    }
  };

  // Orders filters
  const [orderSearch, setOrderSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'>('all');

  // Change order status
  const handleUpdateOrderStatus = async (orderNumber: string, newStatus: PlacedOrder['status']) => {
    setOrders((prev) =>
      prev.map((o) => (o.orderNumber === orderNumber ? { ...o, status: newStatus } : o))
    );
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.products)) {
          syncLocalProducts(data.products);
        }
      }
    } catch (err) {
      console.error('Failed to sync order status:', err);
    }
  };

  const handleDeleteOrder = (orderNumber: string) => {
    setPendingDelete({
      type: 'order',
      id: orderNumber,
      message:
        language === 'ar'
          ? `هل أنتِ متأكدة من حذف الطلب رقم #${orderNumber}؟`
          : `Are you sure you want to delete order #${orderNumber}?`,
    });
  };

  // Product Add / Edit modal state
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form states for Product
  const [prodName, setProdName] = useState('');
  const [prodNameAr, setProdNameAr] = useState('');
  const [prodCategory, setProdCategory] = useState(language === 'ar' ? 'سوتات وتريكو' : 'Suits & Sets');
  const [prodBadge, setProdBadge] = useState('NEW DROP ✨');
  const [prodBadgeAr, setProdBadgeAr] = useState('كولكشن جديد ✨');
  const [prodPrice, setProdPrice] = useState(1000);
  const [prodOrigPrice, setProdOrigPrice] = useState<number | undefined>(1250);
  const [prodDesc, setProdDesc] = useState('');
  const [prodDescAr, setProdDescAr] = useState('');
  const [prodFabric, setProdFabric] = useState('100% Premium Fabric');
  const [prodFabricAr, setProdFabricAr] = useState('خامة فاخرة عالية الجودة');
  const [prodSizesStr, setProdSizesStr] = useState('Free Size (55 - 90 KG), Oversized (90 - 115 KG)');
  const [prodTrackStock, setProdTrackStock] = useState(true);
  
  // Variants editor: support multiple color variants with their own image
  const [variants, setVariants] = useState<Variant[]>([
    {
      colorName: 'Classic Black',
      colorNameAr: 'أسود كلاسيك',
      hex: '#121212',
      image: '/assets/aistudio/WhatsApp_Image_2026-11-12_at_5.52.27_PM_57062f15.jpeg',
    },
  ]);
  const [activeVariantIdx, setActiveVariantIdx] = useState(0);

  // Photo Selection Mode for Active Variant ('upload' | 'library' | 'url')
  const [photoTab, setPhotoTab] = useState<'upload' | 'library' | 'url'>('upload');
  const [urlInput, setUrlInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derive unique categories from existing products to offer as one-click suggestions
  const suggestedCategories = Array.from(
    new Set([
      language === 'ar' ? 'سوتات وتريكو' : 'Suits & Sets',
      language === 'ar' ? 'جواكت وكوتات جلد' : 'Coats & Jackets',
      language === 'ar' ? 'هوديز قطن' : 'Cotton Hoodies',
      language === 'ar' ? 'بلوزات' : 'Blouses & Tops',
      language === 'ar' ? 'فساتين' : 'Dresses',
      language === 'ar' ? 'عبايات' : 'Abayas',
      ...productsList.map((p) => p.category).filter(Boolean),
    ])
  );

  const openAddProductModal = () => {
    setEditingProduct(null);
    setProdName('');
    setProdNameAr('');
    setProdCategory(language === 'ar' ? 'سوتات وتريكو' : 'Suits & Sets');
    setProdBadge('NEW DROP ✨');
    setProdBadgeAr('كولكشن جديد ✨');
    setProdPrice(950);
    setProdOrigPrice(1200);
    setProdDesc('Soft knit, classy look 🤎✨\n\nYour perfect everyday set');
    setProdDescAr('تريكو ناعم، إطلالة راقية ومميزة 🤎✨\n\nطقمك المثالي لكل يوم');
    setProdFabric('High-density luxury fabric');
    setProdFabricAr('خامة فاخرة عالية الكثافة');
    const defaultSizes = language === 'ar' ? 'مقاس موحد (٥٥ - ٩٠ كجم)، أوفر سايز (٩٠ - ١١٥ كجم)' : 'Free Size (55 - 90 KG), Oversized (90 - 115 KG)';
    setProdSizesStr(defaultSizes);
    setProdTrackStock(true);
    const parsedDefaultSizes = defaultSizes.split(/[,،]/).map((s) => s.trim()).filter(Boolean);
    const initSizeStock: Record<string, number> = {};
    parsedDefaultSizes.forEach((s) => { initSizeStock[s] = DEFAULT_STOCK_PER_SIZE; });
    setVariants([
      {
        colorName: 'Classic Black',
        colorNameAr: 'أسود كلاسيك',
        hex: '#121212',
        image: '/assets/aistudio/WhatsApp_Image_2026-11-12_at_5.48.24_PM__1__cc8c2d52.jpeg',
        stock: parsedDefaultSizes.length * DEFAULT_STOCK_PER_SIZE,
        sizeStock: initSizeStock,
      },
    ]);
    setActiveVariantIdx(0);
    setPhotoTab('upload');
    setIsProductModalOpen(true);
  };

  const openEditProductModal = (product: Product) => {
    setEditingProduct(product);
    setProdName(product.name);
    setProdNameAr(product.nameAr || product.name);
    setProdCategory(product.category);
    setProdBadge(product.badge || '');
    setProdBadgeAr(product.badgeAr || product.badge || '');
    setProdPrice(product.price);
    setProdOrigPrice(product.originalPrice);
    setProdDesc(product.desc);
    setProdDescAr(product.descAr || product.desc || '');
    setProdFabric(product.fabric);
    setProdFabricAr(product.fabricAr || product.fabric || '');
    setProdSizesStr(
      language === 'ar' && product.sizesAr && product.sizesAr.length > 0
        ? product.sizesAr.join('، ')
        : product.sizes.join(', ')
    );
    setProdTrackStock(product.trackStock !== false);
    const baseVariants = product.variants && product.variants.length > 0 ? product.variants : [
      {
        colorName: 'Default',
        colorNameAr: 'الافتراضي',
        hex: '#000000',
        image: '/assets/aistudio/WhatsApp_Image_2026-11-12_at_5.52.27_PM_57062f15.jpeg',
      }
    ];
    setVariants(baseVariants.map((v) => ({ ...v, sizeStock: v.sizeStock ? { ...v.sizeStock } : undefined })));
    setActiveVariantIdx(0);
    setPhotoTab('upload');
    setIsProductModalOpen(true);
  };

  // Image Upload Handler (reads file, compresses via canvas for fast loading)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1000;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);

          setVariants((prev) => {
            const next = [...prev];
            if (next[activeVariantIdx]) {
              next[activeVariantIdx] = {
                ...next[activeVariantIdx],
                image: compressedDataUrl,
              };
            }
            return next;
          });

          saveUserPhoto(compressedDataUrl);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSelectLibraryPhoto = (url: string) => {
    setVariants((prev) => {
      const next = [...prev];
      if (next[activeVariantIdx]) {
        next[activeVariantIdx] = {
          ...next[activeVariantIdx],
          image: url,
        };
      }
      return next;
    });
  };

  const handleAddVariant = () => {
    const newVariant: Variant = {
      colorName: `Color ${variants.length + 1}`,
      colorNameAr: `لون ${variants.length + 1}`,
      hex: '#333333',
      image: STORE_PHOTO_LIBRARY[variants.length % STORE_PHOTO_LIBRARY.length]?.url || '/assets/aistudio/WhatsApp_Image_2026-11-12_at_5.52.27_PM_57062f15.jpeg',
    };
    setVariants((prev) => [...prev, newVariant]);
    setActiveVariantIdx(variants.length);
  };

  const handleRemoveVariant = (index: number) => {
    if (variants.length <= 1) return;
    setVariants((prev) => prev.filter((_, idx) => idx !== index));
    if (activeVariantIdx >= index && activeVariantIdx > 0) {
      setActiveVariantIdx((prev) => prev - 1);
    }
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = prodName.trim() || prodNameAr.trim();
    if (!finalName) return;

    const rawSizes = prodSizesStr
      .split(/[,،]/)
      .map((s) => s.trim())
      .filter(Boolean);

    const safeEnteredSizes = rawSizes.length ? rawSizes : ['Free Size (55 - 90 KG)'];

    let finalSizesEn = safeEnteredSizes;
    let finalSizesAr = safeEnteredSizes;

    if (editingProduct) {
      if (language === 'ar') {
        finalSizesAr = safeEnteredSizes;
        if (safeEnteredSizes.length === editingProduct.sizes.length) {
          finalSizesEn = editingProduct.sizes;
        } else {
          finalSizesEn = safeEnteredSizes.map((entered, idx) => {
            const matchedArIdx = (editingProduct.sizesAr || []).findIndex(
              (s) => s.trim().toLowerCase() === entered.toLowerCase()
            );
            if (matchedArIdx !== -1 && editingProduct.sizes[matchedArIdx]) {
              return editingProduct.sizes[matchedArIdx];
            }
            if (editingProduct.sizes[idx] && safeEnteredSizes.length <= editingProduct.sizes.length) {
              return editingProduct.sizes[idx];
            }
            return entered;
          });
        }
      } else {
        finalSizesEn = safeEnteredSizes;
        if (
          Array.isArray(editingProduct.sizesAr) &&
          editingProduct.sizesAr.length === safeEnteredSizes.length
        ) {
          finalSizesAr = editingProduct.sizesAr;
        } else {
          finalSizesAr = safeEnteredSizes.map((entered, idx) => {
            const matchedEnIdx = editingProduct.sizes.findIndex(
              (s) => s.trim().toLowerCase() === entered.toLowerCase()
            );
            if (matchedEnIdx !== -1 && editingProduct.sizesAr?.[matchedEnIdx]) {
              return editingProduct.sizesAr[matchedEnIdx];
            }
            return editingProduct.sizesAr?.[idx] || entered;
          });
        }
      }
    }

    const rawVariants = variants.length > 0 ? variants : [
      {
        colorName: 'Classic Black',
        colorNameAr: 'أسود كلاسيك',
        hex: '#121212',
        image: '/assets/aistudio/WhatsApp_Image_2026-11-12_at_5.52.27_PM_57062f15.jpeg',
      }
    ];

    const safeVariants = rawVariants.map((v) => {
      if (!prodTrackStock) return v;
      if (editingProduct && v.sizeStock) {
        const remappedSizeStock: Record<string, number> = { ...v.sizeStock };
        finalSizesEn.forEach((enKey, idx) => {
          const arKey = finalSizesAr[idx];
          if (typeof remappedSizeStock[enKey] !== 'number' && arKey && typeof remappedSizeStock[arKey] === 'number') {
            remappedSizeStock[enKey] = remappedSizeStock[arKey];
          }
        });
        return normalizeVariantInventory({ ...v, sizeStock: remappedSizeStock }, finalSizesEn, DEFAULT_STOCK_PER_SIZE);
      }
      return normalizeVariantInventory(v, finalSizesEn, DEFAULT_STOCK_PER_SIZE);
    });

    if (editingProduct) {
      const updated = productsList.map((p) => {
        if (p.id === editingProduct.id) {
          return {
            ...p,
            name: finalName.toUpperCase(),
            nameAr: prodNameAr.trim() || finalName,
            category: prodCategory.trim() || 'Suits & Sets',
            badge: prodBadge.trim(),
            badgeAr: prodBadgeAr.trim() || prodBadge.trim(),
            price: Number(prodPrice),
            originalPrice: prodOrigPrice ? Number(prodOrigPrice) : undefined,
            desc: prodDesc.trim(),
            descAr: prodDescAr.trim() || prodDesc.trim(),
            fabric: prodFabric.trim(),
            fabricAr: prodFabricAr.trim() || prodFabric.trim(),
            sizes: finalSizesEn,
            sizesAr: finalSizesAr,
            trackStock: prodTrackStock,
            variants: safeVariants,
          };
        }
        return p;
      });
      updateProducts(updated);
    } else {
      const newId = Math.max(...productsList.map((p) => p.id), 0) + 1;
      const newProd: Product = {
        id: newId,
        name: finalName.toUpperCase(),
        nameAr: prodNameAr.trim() || finalName,
        category: prodCategory.trim() || 'Suits & Sets',
        badge: prodBadge.trim(),
        badgeAr: prodBadgeAr.trim() || prodBadge.trim(),
        price: Number(prodPrice),
        originalPrice: prodOrigPrice ? Number(prodOrigPrice) : undefined,
        desc: prodDesc.trim(),
        descAr: prodDescAr.trim() || prodDesc.trim(),
        fabric: prodFabric.trim(),
        fabricAr: prodFabricAr.trim() || prodFabric.trim(),
        sizes: finalSizesEn,
        sizesAr: finalSizesAr,
        isNewDrop: true,
        trackStock: prodTrackStock,
        variants: safeVariants,
      };
      updateProducts([newProd, ...productsList]);
    }

    setIsProductModalOpen(false);
  };

  const handleDeleteProduct = (id: number) => {
    setPendingDelete({
      type: 'product',
      id: String(id),
      message: t.deleteProductConfirm,
    });
  };

  // Settings State (synced with server data/settings.json)
  const [adminPhone, setAdminPhone] = useState(() => {
    const saved = localStorage.getItem('shestore_admin_phone');
    if (!saved || saved === '201112891062' || saved === '01112891062') {
      localStorage.setItem('shestore_admin_phone', WHATSAPP_PHONE);
      return WHATSAPP_PHONE;
    }
    return saved;
  });
  const [adminPassword, setAdminPassword] = useState(() => localStorage.getItem('shestore_admin_password') || 'shestore2026');
  const [instaHandle, setInstaHandle] = useState(() => localStorage.getItem('shestore_admin_insta') || INSTAGRAM_HANDLE);
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [resendApiKey, setResendApiKey] = useState('');
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [isTestingNotify, setIsTestingNotify] = useState(false);
  const [testNotifyResult, setTestNotifyResult] = useState<{ sent: string[]; failed: Array<{ channel: string; error: string }> } | null>(null);
  const [isDetectingTg, setIsDetectingTg] = useState(false);
  const [tgDetectMsg, setTgDetectMsg] = useState<{
    ok: boolean;
    text: string;
    botUrl?: string;
    chats?: Array<{ id: string; name: string; username: string; type: string }>;
  } | null>(null);

  const handleDetectTelegramChatId = async () => {
    const token = telegramBotToken.trim();
    if (!token) {
      setTgDetectMsg({
        ok: false,
        text: language === 'ar' ? 'الصقي الـ Bot Token أولاً ثم اضغطي هنا.' : 'Paste your Bot Token first.',
      });
      return;
    }
    setIsDetectingTg(true);
    setTgDetectMsg(null);
    try {
      const res = await fetch('/api/settings/telegram-detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken: token }),
      });
      const data = await res.json();
      if (data.ok && data.chatId) {
        const detectedChats: Array<{ id: string; name: string; username: string; type: string }> =
          Array.isArray(data.chats) ? data.chats : [];
        if (!telegramChatId.trim() || detectedChats.length <= 1) {
          setTelegramChatId(String(data.chatId));
        }
        setTgDetectMsg({
          ok: true,
          text:
            language === 'ar'
              ? detectedChats.length > 1
                ? `تم العثور على ${detectedChats.length} حسابات ضغطت Start! اختاري حساب صاحب الموقع بالأسفل ثم اضغطي "حفظ كافة التغييرات".`
                : `تم اكتشاف الـ Chat ID بنجاح (${data.chatName ? `${data.chatName} — ` : ''}${data.chatId})! اضغطي الآن "حفظ كافة التغييرات" بالأسفل ثم "اختبار إرسال إشعار".`
              : `Detected Chat ID (${data.chatId})! Click Save All Changes below, then test.`,
          botUrl: data.botUsername ? `https://t.me/${data.botUsername}` : undefined,
          chats: detectedChats,
        });
      } else {
        setTgDetectMsg({
          ok: false,
          text: data.error || 'Could not detect Chat ID yet.',
          botUrl: data.botUsername ? `https://t.me/${data.botUsername}` : undefined,
        });
      }
    } catch (err) {
      setTgDetectMsg({ ok: false, text: String(err) });
    } finally {
      setIsDetectingTg(false);
    }
  };

  const applySettingsObject = (s: Partial<StoreSettings>) => {
    if (s.adminPhone && s.adminPhone !== '201112891062' && s.adminPhone !== '01112891062') {
      setAdminPhone(s.adminPhone);
    }
    if (s.instaHandle) setInstaHandle(s.instaHandle);
    if (s.adminPassword) setAdminPassword(s.adminPassword);
    if (s.telegramBotToken !== undefined) setTelegramBotToken(s.telegramBotToken || '');
    if (s.telegramChatId !== undefined) setTelegramChatId(s.telegramChatId || '');
    if (s.webhookUrl !== undefined) setWebhookUrl(s.webhookUrl || '');
    if (s.ownerEmail !== undefined) setOwnerEmail(s.ownerEmail || '');
    if (s.resendApiKey !== undefined) setResendApiKey(s.resendApiKey || '');
  };

  useEffect(() => {
    let cachedSettings: Partial<StoreSettings> | null = null;
    try {
      const raw = localStorage.getItem('shestore_admin_settings');
      if (raw) cachedSettings = JSON.parse(raw);
    } catch {
      cachedSettings = null;
    }

    fetch('/api/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then(async (data) => {
        const serverSettings: Partial<StoreSettings> = data?.settings || {};
        let cloudSettings: Partial<StoreSettings> | null = null;
        if (firebaseUser || auth.currentUser) {
          cloudSettings = await fetchSettingsFromCloud().catch(() => null);
        }

        // Prefer non-empty Cloud values, then Server values, then browser cache
        const merged: StoreSettings = {
          adminPhone: cloudSettings?.adminPhone || serverSettings.adminPhone || cachedSettings?.adminPhone || WHATSAPP_PHONE,
          instaHandle: cloudSettings?.instaHandle || serverSettings.instaHandle || cachedSettings?.instaHandle || INSTAGRAM_HANDLE,
          adminPassword: cloudSettings?.adminPassword || serverSettings.adminPassword || cachedSettings?.adminPassword || 'shestore2026',
          telegramBotToken: cloudSettings?.telegramBotToken || serverSettings.telegramBotToken || cachedSettings?.telegramBotToken || '',
          telegramChatId: cloudSettings?.telegramChatId || serverSettings.telegramChatId || cachedSettings?.telegramChatId || '',
          callmebotPhone: '',
          callmebotApiKey: '',
          textmebotApiKey: '',
          ultramsgInstanceId: '',
          ultramsgToken: '',
          metaWhatsappPhoneId: '',
          metaWhatsappToken: '',
          webhookUrl: cloudSettings?.webhookUrl || serverSettings.webhookUrl || cachedSettings?.webhookUrl || '',
          ownerEmail: cloudSettings?.ownerEmail || serverSettings.ownerEmail || cachedSettings?.ownerEmail || '',
          resendApiKey: cloudSettings?.resendApiKey || serverSettings.resendApiKey || cachedSettings?.resendApiKey || '',
        };

        applySettingsObject(merged);
        try {
          localStorage.setItem('shestore_admin_settings', JSON.stringify(merged));
        } catch {
          // ignore
        }

        // If server lost Telegram settings on container restart, restore them to server automatically
        if (
          (merged.telegramBotToken && !serverSettings.telegramBotToken) ||
          (merged.telegramChatId && !serverSettings.telegramChatId)
        ) {
          fetch('/api/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ settings: merged }),
          }).catch(() => {});
        }
      })
      .catch((err) => {
        console.error('Failed to load server settings:', err);
        if (cachedSettings) applySettingsObject(cachedSettings);
      })
      .finally(() => setSettingsLoaded(true));
  }, []);

  const hasExternalAlertChannel = Boolean(
    (telegramBotToken.trim() && telegramChatId.trim()) ||
    (ownerEmail.trim() && resendApiKey.trim()) ||
    webhookUrl.trim()
  );

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const settingsPayload: StoreSettings = {
      adminPhone,
      instaHandle,
      adminPassword,
      telegramBotToken: telegramBotToken.trim(),
      telegramChatId: telegramChatId.trim(),
      callmebotPhone: '',
      callmebotApiKey: '',
      textmebotApiKey: '',
      ultramsgInstanceId: '',
      ultramsgToken: '',
      metaWhatsappPhoneId: '',
      metaWhatsappToken: '',
      webhookUrl: webhookUrl.trim(),
      ownerEmail: ownerEmail.trim(),
      resendApiKey: resendApiKey.trim(),
    };

    localStorage.setItem('shestore_admin_phone', adminPhone);
    localStorage.setItem('shestore_admin_password', adminPassword);
    localStorage.setItem('shestore_admin_insta', instaHandle);
    try {
      localStorage.setItem('shestore_admin_settings', JSON.stringify(settingsPayload));
    } catch {
      // ignore
    }

    const activeUser = firebaseUser || auth.currentUser;
    if (activeUser) {
      saveSettingsToCloud(settingsPayload, activeUser.uid).catch((err) => {
        console.error('Failed to save settings to Firebase Cloud:', err);
      });
    }

    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: settingsPayload }),
      });
    } catch (err) {
      console.error('Failed to save settings to server:', err);
    }

    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 3000);
  };

  const handleTestNotification = async () => {
    setIsTestingNotify(true);
    setTestNotifyResult(null);
    try {
      const res = await fetch('/api/settings/test-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            telegramBotToken,
            telegramChatId,
            webhookUrl,
            ownerEmail,
            resendApiKey,
          },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setTestNotifyResult({
          sent: data.report?.sentChannels || ['dashboard'],
          failed: data.report?.failedChannels || [],
        });
      }
    } catch (err) {
      setTestNotifyResult({
        sent: [],
        failed: [{ channel: 'network', error: String(err) }],
      });
    } finally {
      setIsTestingNotify(false);
    }
  };

  // Overview calculations
  const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
  const pendingOrders = orders.filter((o) => (o.status || 'pending') === 'pending').length;
  const confirmedOrders = orders.filter((o) => o.status === 'confirmed').length;

  // Inventory metrics across all tracked product x color x size slots
  const inventoryMetrics = productsList.reduce(
    (acc, prod) => {
      if (prod.trackStock === false) return acc;
      acc.trackedProducts += 1;
      const sizes = prod.sizes.length > 0 ? prod.sizes : ['Free Size (55 - 90 KG)'];
      prod.variants.forEach((_, vIdx) => {
        sizes.forEach((sz) => {
          const qty = getVariantSizeStock(prod, vIdx, sz);
          if (qty === null) return;
          acc.totalUnits += qty;
          if (qty <= 0) acc.outCount += 1;
          else if (qty <= LOW_STOCK_THRESHOLD) acc.lowCount += 1;
        });
      });
      return acc;
    },
    { trackedProducts: 0, totalUnits: 0, lowCount: 0, outCount: 0 }
  );
  const inventoryAlertCount = inventoryMetrics.lowCount + inventoryMetrics.outCount;

  // Filtered orders list
  const filteredOrders = orders.filter((o) => {
    const q = orderSearch.toLowerCase();
    const matchesSearch =
      o.orderNumber.toLowerCase().includes(q) ||
      o.customer.name.toLowerCase().includes(q) ||
      o.customer.phone.includes(q) ||
      o.customer.governorate.toLowerCase().includes(q);

    const matchesStatus =
      statusFilter === 'all' ? true : (o.status || 'pending') === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const currentVariant = variants[activeVariantIdx] || variants[0];

  const statusLabels: Record<string, { en: string; ar: string }> = {
    all: { en: 'All', ar: 'الكل' },
    pending: { en: 'Pending', ar: 'قيد الانتظار' },
    confirmed: { en: 'Confirmed', ar: 'مؤكد' },
    shipped: { en: 'Shipped', ar: 'تم الشحن' },
    delivered: { en: 'Delivered', ar: 'تم التوصيل' },
    cancelled: { en: 'Cancelled', ar: 'ملغي' },
  };

  return (
    <div className={`min-h-screen bg-[#FAF7F2] text-neutral-900 font-sans selection:bg-black selection:text-white flex flex-col ${isRTL ? 'rtl' : 'ltr'}`}>
      
      {/* 1. Admin Top Bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-neutral-300 px-4 md:px-8 py-3 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <img
              src="/assets/aistudio/WhatsApp_Image_2026-11-12_at_5.30.13_PM_2b767034.jpeg"
              alt="SHE STORE"
              className="h-10 w-auto object-contain mix-blend-multiply"
            />
            <div className="hidden sm:block">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm uppercase tracking-wider text-black font-brand">
                  SHE STORE EG
                </span>
                <span className="bg-neutral-900 text-white text-[9px] font-bold px-1.5 py-0.5 uppercase tracking-wider">
                  {t.adminTitle}
                </span>
              </div>
              <p className="text-[10px] text-neutral-500">
                {language === 'ar' ? 'بوابة عمليات المتجر وإدارة الطلبات' : 'Merchant Operations & Orders Portal'}
              </p>
            </div>
          </div>

          {/* Action links */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Language Switcher */}
            <button
              onClick={toggleLanguage}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 text-xs font-bold border border-neutral-300 transition-colors cursor-pointer"
              title="Change Language"
            >
              <Languages className="w-3.5 h-3.5 text-neutral-700" />
              <span>{t.switchLangLabel}</span>
            </button>

            {/* Cloud Sync Status / Connect Pill */}
            {firebaseUser ? (
              <span
                className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold"
                title={firebaseUser.email || 'Cloud Sync Active'}
              >
                <Cloud className="w-3.5 h-3.5 text-emerald-600" />
                <span>{language === 'ar' ? 'الحفظ السحابي مفعّل' : 'Cloud Sync Active'}</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={handleConnectCloud}
                disabled={isCloudConnecting}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                <CloudOff className="w-3.5 h-3.5 text-amber-700" />
                <span>
                  {isCloudConnecting
                    ? (language === 'ar' ? 'جاري الربط...' : 'Connecting...')
                    : (language === 'ar' ? 'تفعيل الحفظ السحابي' : 'Enable Cloud Sync')}
                </span>
              </button>
            )}

            {/* View Live Store */}
            <button
              onClick={onNavigateStore}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FAF7F2] hover:bg-neutral-200 text-neutral-800 text-xs font-bold border border-neutral-300 uppercase tracking-wider transition-colors cursor-pointer"
              title="Open Storefront"
            >
              <span>{t.viewLiveStore}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>

            {/* Sign Out */}
            <button
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold border border-red-200 uppercase tracking-wider transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.logout}</span>
            </button>
          </div>

        </div>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto flex items-center gap-2 pt-3 border-t border-neutral-100 mt-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-black text-black font-extrabold'
                : 'border-transparent text-neutral-500 hover:text-black'
            }`}
          >
            📊 {t.tabOverview}
          </button>

          <button
            onClick={() => setActiveTab('orders')}
            className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'orders'
                ? 'border-black text-black font-extrabold'
                : 'border-transparent text-neutral-500 hover:text-black'
            }`}
          >
            <span>📦 {t.tabOrders}</span>
            {pendingOrders > 0 && (
              <span className="bg-amber-400 text-black text-[10px] font-black px-1.5 py-0.2 rounded-full">
                {pendingOrders}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('products')}
            className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'products'
                ? 'border-black text-black font-extrabold'
                : 'border-transparent text-neutral-500 hover:text-black'
            }`}
          >
            👗 {t.tabProducts} ({productsList.length})
          </button>

          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'inventory'
                ? 'border-black text-black font-extrabold'
                : 'border-transparent text-neutral-500 hover:text-black'
            }`}
          >
            <span>🏷️ {language === 'ar' ? 'المخزون' : 'Inventory'}</span>
            {inventoryAlertCount > 0 && (
              <span className="bg-red-600 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full">
                {inventoryAlertCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('feedbacks')}
            className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'feedbacks'
                ? 'border-black text-black font-extrabold'
                : 'border-transparent text-neutral-500 hover:text-black'
            }`}
          >
            💬 {language === 'ar' ? `آراء العملاء (${feedbacks.length})` : `Client Feedbacks (${feedbacks.length})`}
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'settings'
                ? 'border-black text-black font-extrabold'
                : 'border-transparent text-neutral-500 hover:text-black'
            }`}
          >
            ⚙️ {t.tabSettings}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto w-full px-4 md:px-8 py-6 flex-1 text-start">
        
        {/* Setup Reminder Banner when no external Telegram/Email/Webhook alert is linked yet */}
        {settingsLoaded && !hasExternalAlertChannel && activeTab !== 'settings' && (
          <div className="mb-6 bg-amber-50 border border-amber-300 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 text-xs text-amber-950">
              <Bell className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">
                  {language === 'ar'
                    ? 'فعّلي بوت تيليجرام الآن ليصلك كل أوردر أوتوماتيك فور تأكيده:'
                    : 'Enable Telegram Bot now so the website automatically sends every order alert:'}
                </p>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  {language === 'ar'
                    ? 'من الإعدادات يمكنك إدخال Bot Token و Chat ID في دقيقة واحدة لاستقبال الطلبات فوراً.'
                    : 'Enter your Telegram Bot Token and Chat ID inside Settings in 1 minute to receive instant alerts.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className="px-4 py-2 bg-sky-700 text-white text-[11px] font-bold uppercase tracking-wider cursor-pointer shrink-0 hover:bg-sky-800"
            >
              {language === 'ar' ? 'إعداد بوت تيليجرام' : 'Setup Telegram Bot'}
            </button>
          </div>
        )}

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-fadeIn">
            
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              
              <div className="bg-white border border-neutral-300 p-4 sm:p-5 shadow-xs">
                <div className="flex items-center justify-between text-neutral-500 text-xs font-bold uppercase tracking-wider">
                  <span>{t.totalSales}</span>
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="mt-2 text-xl sm:text-2xl font-black text-black tabular-nums">
                  {totalRevenue.toLocaleString()} {t.egp}
                </div>
                <p className="text-[11px] text-neutral-400 mt-1">
                  {language === 'ar' ? 'إجمالي مبيعات الدفع عند الاستلام' : 'Cash On Delivery Volume'}
                </p>
              </div>

              <div className="bg-white border border-neutral-300 p-4 sm:p-5 shadow-xs">
                <div className="flex items-center justify-between text-neutral-500 text-xs font-bold uppercase tracking-wider">
                  <span>{t.totalOrders}</span>
                  <ShoppingBag className="w-4 h-4 text-blue-600" />
                </div>
                <div className="mt-2 text-xl sm:text-2xl font-black text-black tabular-nums">
                  {orders.length}
                </div>
                <p className="text-[11px] text-amber-600 font-bold mt-1">
                  {pendingOrders} {language === 'ar' ? 'بانتظار الشحن' : 'awaiting shipment'}
                </p>
              </div>

              <div className="bg-white border border-neutral-300 p-4 sm:p-5 shadow-xs">
                <div className="flex items-center justify-between text-neutral-500 text-xs font-bold uppercase tracking-wider">
                  <span>{t.activeCatalog}</span>
                  <Package className="w-4 h-4 text-purple-600" />
                </div>
                <div className="mt-2 text-xl sm:text-2xl font-black text-black tabular-nums">
                  {productsList.length} {language === 'ar' ? 'موديلات' : 'Items'}
                </div>
                <p className="text-[11px] text-neutral-400 mt-1">
                  {language === 'ar' ? 'معروضة لايف في المتجر' : 'Published live on store'}
                </p>
              </div>

              <div className="bg-white border border-neutral-300 p-4 sm:p-5 shadow-xs">
                <div className="flex items-center justify-between text-neutral-500 text-xs font-bold uppercase tracking-wider">
                  <span>{t.confirmedOrders}</span>
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="mt-2 text-xl sm:text-2xl font-black text-black tabular-nums">
                  {confirmedOrders}
                </div>
                <p className="text-[11px] text-neutral-400 mt-1">
                  {language === 'ar' ? 'طلبات تم معالجتها' : 'Processed orders'}
                </p>
              </div>

            </div>

            {inventoryAlertCount > 0 && (
              <div className="bg-red-50 border border-red-300 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5 text-xs text-red-950">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">
                      {language === 'ar'
                        ? `تنبيه المخزون: يوجد ${inventoryMetrics.outCount} مقاس نافذ الكمية و ${inventoryMetrics.lowCount} مقاس قارب على النفاد`
                        : `Inventory Alert: ${inventoryMetrics.outCount} out-of-stock and ${inventoryMetrics.lowCount} low-stock size slots`}
                    </p>
                    <p className="text-[11px] text-red-800 mt-0.5">
                      {language === 'ar'
                        ? 'تابعي وزوّدي الكميات من تبويب المخزون حتى لا تتوقف المبيعات.'
                        : 'Restock units inside the Inventory tab to prevent missed sales.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('inventory')}
                  className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white text-[11px] font-bold uppercase tracking-wider cursor-pointer shrink-0"
                >
                  {language === 'ar' ? 'فتح المخزون الآن' : 'Manage Inventory'}
                </button>
              </div>
            )}

            {/* Quick Actions & Recent Orders Banner */}
            <div className="bg-white border border-neutral-300 p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200">
                <div>
                  <h2 className="text-base font-extrabold uppercase tracking-wide text-neutral-900 font-brand">
                    {language === 'ar' ? 'أحدث طلبات العميلات' : 'Recent Customer Orders'}
                  </h2>
                  <p className="text-xs text-neutral-500">
                    {language === 'ar' ? 'طلبات واردة ومؤكدة عبر واجهة المتجر' : 'Live order inquiries submitted via the boutique storefront'}
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('orders')}
                  className="bg-black text-white hover:bg-neutral-800 px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer self-start sm:self-auto"
                >
                  {language === 'ar' ? `إدارة جميع الطلبات (${orders.length}) ←` : `Manage All Orders (${orders.length}) →`}
                </button>
              </div>

              {/* Mini Table */}
              <div className="divide-y divide-neutral-200 mt-3">
                {orders.slice(0, 5).map((order) => (
                  <div key={order.orderNumber} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-black">#{order.orderNumber}</span>
                        <span className="text-xs font-bold text-neutral-900">{order.customer.name}</span>
                        <span className="text-[11px] text-neutral-500 font-medium">({order.customer.governorate})</span>
                      </div>
                      <div className="text-xs text-neutral-500 mt-1">
                        {order.items.map((i) => {
                          const itemName = language === 'ar' && i.nameAr ? i.nameAr : i.name;
                          const itemColor = language === 'ar' && i.colorAr ? i.colorAr : i.color;
                          return `${i.quantity}x ${itemName} (${itemColor})`;
                        }).join(' • ')}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-black tabular-nums">
                        {order.total.toLocaleString()} {t.egp}
                      </span>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-none ${
                        order.status === 'confirmed'
                          ? 'bg-blue-100 text-blue-800'
                          : order.status === 'delivered'
                          ? 'bg-emerald-100 text-emerald-800'
                          : order.status === 'cancelled'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {statusLabels[order.status || 'pending']?.[language] || order.status}
                      </span>
                      <a
                        href={`https://wa.me/2${order.customer.phone.replace(/^0+/, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white p-1.5 text-xs font-bold"
                        title="Chat on WhatsApp"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: ORDERS MANAGEMENT */}
        {activeTab === 'orders' && (
          <div className="space-y-4 animate-fadeIn">
            
            {/* Search & Filter Header */}
            <div className="bg-white border border-neutral-300 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 max-w-lg">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder={language === 'ar' ? 'ابحثي باسم العميل، الهاتف، كود الطلب، أو المحافظة...' : 'Search by customer, phone, order ref, or city...'}
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-neutral-300 focus:outline-none focus:border-black"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => fetchServerOrders(true)}
                  className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
                  title={language === 'ar' ? 'تحديث الطلبات' : 'Refresh Orders'}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingOrders ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">{language === 'ar' ? 'تحديث' : 'Refresh'}</span>
                </button>
              </div>

              {/* Status Filters */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {(['all', 'pending', 'confirmed', 'shipped', 'delivered', 'cancelled'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider border cursor-pointer whitespace-nowrap ${
                      statusFilter === st
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-neutral-600 border-neutral-300 hover:border-black'
                    }`}
                  >
                    {statusLabels[st]?.[language] || st}
                  </button>
                ))}
              </div>
            </div>

            {/* Orders Table */}
            <div className="bg-white border border-neutral-300 shadow-xs overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-neutral-100 border-b border-neutral-200 text-neutral-600 uppercase text-[10px] tracking-wider font-extrabold">
                    <th className="py-3 px-4">{language === 'ar' ? 'كود الطلب' : 'Order Ref'}</th>
                    <th className="py-3 px-4">{language === 'ar' ? 'بيانات العميل' : 'Customer Details'}</th>
                    <th className="py-3 px-4">{language === 'ar' ? 'المحافظة والعنوان' : 'Governorate & Address'}</th>
                    <th className="py-3 px-4">{language === 'ar' ? 'المنتجات المطلوبة' : 'Items Ordered'}</th>
                    <th className="py-3 px-4">{language === 'ar' ? 'المبلغ الإجمالي' : 'Total Amount'}</th>
                    <th className="py-3 px-4">{language === 'ar' ? 'الحالة' : 'Status'}</th>
                    <th className="py-3 px-4 text-right">{language === 'ar' ? 'الإجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {filteredOrders.map((order) => (
                    <tr key={order.orderNumber} className="hover:bg-neutral-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-neutral-900 whitespace-nowrap">
                        #{order.orderNumber}
                        <div className="text-[10px] text-neutral-400 font-sans">{order.date}</div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-bold text-black">{order.customer.name}</div>
                        <div className="text-neutral-500 font-mono text-[11px]">{order.customer.phone}</div>
                      </td>
                      <td className="py-3.5 px-4 max-w-xs">
                        <span className="font-bold text-black">{order.customer.governorate}</span>
                        <p className="text-neutral-500 text-[11px] truncate">{order.customer.address}</p>
                        {order.customer.notes && (
                          <p className="text-amber-700 text-[10px] italic">
                            {language === 'ar' ? 'ملاحظة:' : 'Note:'} {order.customer.notes}
                          </p>
                        )}
                      </td>
                      <td className="py-3.5 px-4 max-w-sm">
                        <div className="space-y-1">
                          {order.items.map((it, idx) => (
                            <div key={idx} className="text-[11px]">
                              <span className="font-bold">{it.quantity}x</span> {language === 'ar' && it.nameAr ? it.nameAr : it.name}
                              <span className="text-neutral-500"> ({language === 'ar' && it.colorAr ? it.colorAr : it.color} / {it.size})</span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-black tabular-nums whitespace-nowrap">
                        {order.total.toLocaleString()} {t.egp}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <select
                            value={order.status || 'pending'}
                            onChange={(e) => handleUpdateOrderStatus(order.orderNumber, e.target.value as PlacedOrder['status'])}
                            className={`text-[11px] font-bold px-2 py-1 border cursor-pointer uppercase ${
                              order.status === 'confirmed'
                                ? 'bg-blue-50 text-blue-800 border-blue-300'
                                : order.status === 'delivered'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : order.status === 'shipped'
                                ? 'bg-purple-50 text-purple-800 border-purple-300'
                                : order.status === 'cancelled'
                                ? 'bg-red-50 text-red-800 border-red-300'
                                : 'bg-amber-50 text-amber-800 border-amber-300'
                            }`}
                          >
                            <option value="pending">{language === 'ar' ? 'قيد الانتظار' : 'Pending'}</option>
                            <option value="confirmed">{language === 'ar' ? 'مؤكد' : 'Confirmed'}</option>
                            <option value="shipped">{language === 'ar' ? 'تم الشحن' : 'Shipped'}</option>
                            <option value="delivered">{language === 'ar' ? 'تم التوصيل' : 'Delivered'}</option>
                            <option value="cancelled">{language === 'ar' ? 'ملغي' : 'Cancelled'}</option>
                          </select>
                          {order.notificationChannels && order.notificationChannels.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {order.notificationChannels.map((ch) => (
                                <span key={ch} className="text-[9px] font-mono bg-neutral-100 text-neutral-600 px-1.5 py-0.5 border border-neutral-200">
                                  {ch}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <a
                            href={`https://wa.me/2${order.customer.phone.replace(/^0+/, '')}?text=${encodeURIComponent(
                              language === 'ar'
                                ? `مرحباً ${order.customer.name}، معكِ براند SHE STORE لتأكيد طلبك رقم #${order.orderNumber}`
                                : `Hello ${order.customer.name}, this is SHE STORE confirming your order #${order.orderNumber}`
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 text-[11px] font-bold flex items-center gap-1"
                            title="Chat with Customer"
                          >
                            <MessageCircle className="w-3 h-3" />
                            <span>{language === 'ar' ? 'واتساب' : 'WhatsApp'}</span>
                          </a>
                          <button
                            onClick={() => handleDeleteOrder(order.orderNumber)}
                            className="p-1 text-neutral-400 hover:text-red-600 transition-colors cursor-pointer"
                            title="Delete order"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredOrders.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-neutral-500">
                        {language === 'ar' ? 'لا توجد طلبات تطابق الفلتر الحالي.' : 'No orders match the current filter.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

          </div>
        )}

        {/* TAB 3: PRODUCTS & INVENTORY */}
        {activeTab === 'products' && (
          <div className="space-y-4 animate-fadeIn">
            
            {/* Header with Add Button */}
            <div className="bg-white border border-neutral-300 p-4 shadow-xs flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-extrabold uppercase tracking-wide text-neutral-900 font-brand">
                  {language === 'ar' ? `قطع الكتالوج المعروضة (${productsList.length})` : `Live Catalog Items (${productsList.length})`}
                </h2>
                <p className="text-xs text-neutral-500">
                  {language === 'ar' ? 'إضافة موديلات جديدة أو تعديل الأسعار، التصنيفات، والصور' : 'Add new designs or update prices, categories, and photos'}
                </p>
              </div>

              <button
                onClick={openAddProductModal}
                className="bg-black text-white hover:bg-neutral-800 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-2 shadow-xs"
              >
                <Plus className="w-4 h-4 text-amber-300" />
                <span>{t.addNewPiece}</span>
              </button>
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {productsList.map((product) => {
                const prodTitle = language === 'ar' && product.nameAr ? product.nameAr : product.name;
                const prodBadgeText = language === 'ar' && product.badgeAr ? product.badgeAr : product.badge;
                const prodDescText = language === 'ar' && product.descAr ? product.descAr : product.desc;

                return (
                  <div key={product.id} className="bg-white border border-neutral-300 p-4 shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="relative aspect-[3/4] w-full overflow-hidden bg-neutral-100 border border-neutral-200 mb-3">
                        <img
                          src={product.variants[0]?.image}
                          alt={prodTitle}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-2 left-2 flex flex-col gap-1">
                          {prodBadgeText && (
                            <span className="bg-black text-white text-[9px] font-bold px-2 py-0.5 uppercase tracking-wider">
                              {prodBadgeText}
                            </span>
                          )}
                          <span className="bg-neutral-800/90 text-white text-[9px] font-semibold px-2 py-0.5 uppercase tracking-wider">
                            {product.category}
                          </span>
                        </div>
                      </div>

                      <h3 className="font-extrabold text-sm uppercase text-black font-brand line-clamp-1">
                        {prodTitle}
                      </h3>

                      <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-base font-black text-neutral-900 tabular-nums">
                          {product.price.toLocaleString()} {t.egp}
                        </span>
                        {product.originalPrice && (
                          <span className="text-xs text-neutral-400 line-through tabular-nums">
                            {product.originalPrice.toLocaleString()} {t.egp}
                          </span>
                        )}
                      </div>

                      {prodDescText && (
                        <p className="text-xs text-neutral-600 mt-2 line-clamp-2 italic">
                          "{prodDescText}"
                        </p>
                      )}

                      <div className="mt-2 text-[11px] text-neutral-500">
                        <span className="font-bold text-neutral-700">{language === 'ar' ? 'الألوان: ' : 'Colors: '}</span>
                        {product.variants.map((v) => (language === 'ar' && v.colorNameAr ? v.colorNameAr : v.colorName)).join('، ')}
                      </div>

                      {(() => {
                        const prodStock = getProductTotalStock(product);
                        if (prodStock === null) {
                          return (
                            <div className="mt-2 inline-block text-[10px] font-bold px-2 py-0.5 bg-neutral-100 text-neutral-600 border border-neutral-200">
                              {language === 'ar' ? 'المخزون: مفتوح بدون حد' : 'Stock: Unlimited'}
                            </div>
                          );
                        }
                        return (
                          <div
                            className={`mt-2 inline-block text-[10px] font-bold px-2 py-0.5 border ${
                              prodStock <= 0
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : prodStock <= LOW_STOCK_THRESHOLD * product.variants.length
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            }`}
                          >
                            {prodStock <= 0
                              ? (language === 'ar' ? 'نفذت الكمية بالكامل' : 'Out of Stock (0)')
                              : (language === 'ar' ? `إجمالي المخزون: ${prodStock} قطعة` : `Total Stock: ${prodStock} pcs`)}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Actions */}
                    <div className="pt-3 mt-3 border-t border-neutral-200 flex items-center justify-between gap-2">
                      <button
                        onClick={() => openEditProductModal(product)}
                        className="flex-1 py-1.5 px-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>{t.editDetails}</span>
                      </button>

                      <button
                        onClick={() => handleDeleteProduct(product.id)}
                        className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        title="Delete Product"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        )}

        {/* TAB 3A-2: INVENTORY TRACKING */}
        {activeTab === 'inventory' && (
          <div className="space-y-5 animate-fadeIn">

            {/* Inventory KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-white border border-neutral-300 p-4 shadow-xs">
                <div className="flex items-center justify-between text-neutral-500 text-xs font-bold uppercase">
                  <span>{language === 'ar' ? 'إجمالي القطع بالمخزن' : 'Total Stock Units'}</span>
                  <Boxes className="w-4 h-4 text-neutral-800" />
                </div>
                <div className="mt-2 text-2xl font-black text-black tabular-nums">
                  {inventoryMetrics.totalUnits.toLocaleString()}
                </div>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  {language === 'ar' ? 'تنقص تلقائياً مع كل أوردر' : 'Auto-deducted per order'}
                </p>
              </div>

              <div className="bg-white border border-neutral-300 p-4 shadow-xs">
                <div className="flex items-center justify-between text-neutral-500 text-xs font-bold uppercase">
                  <span>{language === 'ar' ? 'موديلات قيد التتبع' : 'Tracked Models'}</span>
                  <Package className="w-4 h-4 text-blue-600" />
                </div>
                <div className="mt-2 text-2xl font-black text-black tabular-nums">
                  {inventoryMetrics.trackedProducts} / {productsList.length}
                </div>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  {language === 'ar' ? 'مربوطة بحالة الطلبات' : 'Synced live with orders'}
                </p>
              </div>

              <div className="bg-amber-50 border border-amber-300 p-4 shadow-xs">
                <div className="flex items-center justify-between text-amber-900 text-xs font-bold uppercase">
                  <span>{language === 'ar' ? `مخزون منخفض (≤ ${LOW_STOCK_THRESHOLD})` : `Low Stock (≤ ${LOW_STOCK_THRESHOLD})`}</span>
                  <AlertTriangle className="w-4 h-4 text-amber-700" />
                </div>
                <div className="mt-2 text-2xl font-black text-amber-950 tabular-nums">
                  {inventoryMetrics.lowCount}
                </div>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  {language === 'ar' ? 'مقاسات قاربت على النفاد' : 'Variant sizes running low'}
                </p>
              </div>

              <div className="bg-red-50 border border-red-300 p-4 shadow-xs">
                <div className="flex items-center justify-between text-red-900 text-xs font-bold uppercase">
                  <span>{language === 'ar' ? 'نفذت الكمية (0)' : 'Sold Out (0)'}</span>
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                </div>
                <div className="mt-2 text-2xl font-black text-red-950 tabular-nums">
                  {inventoryMetrics.outCount}
                </div>
                <p className="text-[11px] text-red-800 mt-0.5">
                  {language === 'ar' ? 'مغلقة أمام الطلب حالياً' : 'Blocked at checkout'}
                </p>
              </div>
            </div>

            {/* Search & Filter Toolbar */}
            <div className="bg-white border border-neutral-300 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={inventorySearch}
                  onChange={(e) => setInventorySearch(e.target.value)}
                  placeholder={language === 'ar' ? 'ابحثي باسم الموديل أو اللون...' : 'Search by model or color...'}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-neutral-300 focus:outline-none focus:border-black"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {(
                  [
                    { id: 'all', ar: 'الكل', en: 'All' },
                    { id: 'low', ar: 'مخزون منخفض', en: 'Low Stock' },
                    { id: 'out', ar: 'نفذت الكمية', en: 'Sold Out' },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setInventoryFilter(f.id)}
                    className={`px-3 py-1.5 text-[11px] font-bold uppercase border cursor-pointer whitespace-nowrap ${
                      inventoryFilter === f.id
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-neutral-700 border-neutral-300 hover:border-black'
                    }`}
                  >
                    {language === 'ar' ? f.ar : f.en}
                  </button>
                ))}
              </div>
            </div>

            {/* Inventory Product Cards */}
            <div className="space-y-4">
              {productsList
                .filter((prod) => {
                  const q = inventorySearch.trim().toLowerCase();
                  if (q) {
                    const matchName =
                      prod.name.toLowerCase().includes(q) ||
                      (prod.nameAr && prod.nameAr.toLowerCase().includes(q));
                    const matchColor = prod.variants.some(
                      (v) =>
                        v.colorName.toLowerCase().includes(q) ||
                        (v.colorNameAr && v.colorNameAr.toLowerCase().includes(q))
                    );
                    if (!matchName && !matchColor) return false;
                  }

                  if (inventoryFilter === 'all') return true;
                  if (prod.trackStock === false) return false;
                  const sizes = prod.sizes.length > 0 ? prod.sizes : ['Free Size (55 - 90 KG)'];
                  let hasOut = false;
                  let hasLow = false;
                  prod.variants.forEach((_, vIdx) => {
                    sizes.forEach((sz) => {
                      const qty = getVariantSizeStock(prod, vIdx, sz);
                      if (qty !== null) {
                        if (qty <= 0) hasOut = true;
                        else if (qty <= LOW_STOCK_THRESHOLD) hasLow = true;
                      }
                    });
                  });
                  return inventoryFilter === 'out' ? hasOut : hasLow;
                })
                .map((prod) => {
                  const pTitle = language === 'ar' && prod.nameAr ? prod.nameAr : prod.name;
                  const totalProdStock = getProductTotalStock(prod);
                  const sizesEn = prod.sizes.length > 0 ? prod.sizes : ['Free Size (55 - 90 KG)'];
                  const isTracking = prod.trackStock !== false;

                  return (
                    <div key={prod.id} className="bg-white border border-neutral-300 p-4 sm:p-5 shadow-xs space-y-4">
                      {/* Product Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-200">
                        <div className="flex items-center gap-3">
                          <img
                            src={prod.variants[0]?.image}
                            alt={pTitle}
                            className="w-12 h-16 object-cover border border-neutral-200 shrink-0"
                          />
                          <div>
                            <h3 className="font-extrabold text-sm text-black">{pTitle}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[11px] text-neutral-500 font-bold">
                                {prod.price.toLocaleString()} {t.egp}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 border ${
                                  !isTracking
                                    ? 'bg-neutral-100 text-neutral-600 border-neutral-300'
                                    : totalProdStock === 0
                                    ? 'bg-red-100 text-red-800 border-red-300'
                                    : totalProdStock !== null && totalProdStock <= LOW_STOCK_THRESHOLD * prod.variants.length
                                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                                    : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                }`}
                              >
                                {!isTracking
                                  ? (language === 'ar' ? 'بدون حد أقصى' : 'Unlimited')
                                  : (language === 'ar' ? `المجموع: ${totalProdStock ?? 0} قطعة` : `Total: ${totalProdStock ?? 0} pcs`)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer select-none bg-[#FAF7F2] px-3 py-1.5 border border-neutral-300 self-start sm:self-auto">
                          <input
                            type="checkbox"
                            checked={isTracking}
                            onChange={(e) =>
                              handlePatchProductStock(prod.id, { trackStock: e.target.checked })
                            }
                            className="accent-black w-4 h-4 cursor-pointer"
                          />
                          <span>
                            {language === 'ar' ? 'تتبع الكمية تلقائياً' : 'Auto-Track Stock'}
                          </span>
                        </label>
                      </div>

                      {/* Variant × Size Stock Matrix */}
                      {!isTracking ? (
                        <p className="text-xs text-neutral-500 italic">
                          {language === 'ar'
                            ? 'تتبع المخزون متوقف لهذا الموديل (متاح للطلب دائماً بدون خصم كميات).'
                            : 'Stock tracking is disabled for this product (always available for order).'}
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {prod.variants.map((variant, vIdx) => {
                            const vColor =
                              language === 'ar' && variant.colorNameAr
                                ? variant.colorNameAr
                                : variant.colorName;

                            return (
                              <div
                                key={vIdx}
                                className="border border-neutral-200 bg-[#FAF7F2]/60 p-3 space-y-2.5"
                              >
                                <div className="flex items-center justify-between gap-2 pb-2 border-b border-neutral-200">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className="w-4 h-4 rounded-full border border-black/25 shrink-0 inline-block"
                                      style={{ backgroundColor: variant.hex }}
                                    />
                                    <span className="font-bold text-xs text-neutral-900">{vColor}</span>
                                  </div>

                                  <button
                                    type="button"
                                    disabled={savingStockKey !== null}
                                    onClick={() =>
                                      handlePatchProductStock(prod.id, {
                                        variantIndex: vIdx,
                                        delta: 5,
                                      })
                                    }
                                    className="px-2 py-1 bg-black hover:bg-neutral-800 text-white text-[10px] font-bold cursor-pointer disabled:opacity-50"
                                  >
                                    {language === 'ar' ? '+٥ لكل المقاسات' : '+5 All Sizes'}
                                  </button>
                                </div>

                                <div className="space-y-2">
                                  {sizesEn.map((sz, sIdx) => {
                                    const szDisplay =
                                      language === 'ar' && prod.sizesAr?.[sIdx] ? prod.sizesAr[sIdx] : sz;
                                    const currentQty = getVariantSizeStock(prod, vIdx, sz) ?? 0;

                                    return (
                                      <div
                                        key={sz}
                                        className="flex items-center justify-between gap-2 bg-white border border-neutral-200 px-2.5 py-1.5 text-xs"
                                      >
                                        <span className="font-semibold text-neutral-800 truncate">
                                          {szDisplay}
                                        </span>

                                        <div className="flex items-center gap-1.5 shrink-0">
                                          <button
                                            type="button"
                                            disabled={currentQty <= 0 || savingStockKey !== null}
                                            onClick={() =>
                                              handlePatchProductStock(prod.id, {
                                                variantIndex: vIdx,
                                                size: sz,
                                                delta: -1,
                                              })
                                            }
                                            className="w-7 h-7 flex items-center justify-center border border-neutral-300 bg-neutral-50 hover:bg-neutral-200 cursor-pointer disabled:opacity-40"
                                            aria-label="Decrease stock"
                                          >
                                            <Minus className="w-3 h-3" />
                                          </button>

                                          <input
                                            type="number"
                                            min={0}
                                            value={currentQty}
                                            onChange={(e) => {
                                              const nextVal = Math.max(0, Number(e.target.value) || 0);
                                              handlePatchProductStock(prod.id, {
                                                variantIndex: vIdx,
                                                size: sz,
                                                qty: nextVal,
                                              });
                                            }}
                                            className={`w-12 h-7 text-center font-black tabular-nums border text-xs focus:outline-none focus:border-black ${
                                              currentQty <= 0
                                                ? 'bg-red-50 text-red-700 border-red-300'
                                                : currentQty <= LOW_STOCK_THRESHOLD
                                                ? 'bg-amber-50 text-amber-800 border-amber-300'
                                                : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                            }`}
                                          />

                                          <button
                                            type="button"
                                            disabled={savingStockKey !== null}
                                            onClick={() =>
                                              handlePatchProductStock(prod.id, {
                                                variantIndex: vIdx,
                                                size: sz,
                                                delta: 1,
                                              })
                                            }
                                            className="w-7 h-7 flex items-center justify-center border border-neutral-300 bg-neutral-50 hover:bg-neutral-200 cursor-pointer disabled:opacity-40"
                                            aria-label="Increase stock"
                                          >
                                            <Plus className="w-3 h-3" />
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>

          </div>
        )}

        {/* TAB 3B: CLIENT FEEDBACK SCREENSHOTS */}
        {activeTab === 'feedbacks' && (
          <div className="space-y-6 animate-fadeIn text-start">
            {/* Upload Card */}
            <div className="bg-white border border-neutral-300 p-5 sm:p-6 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-neutral-200">
                <div>
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-emerald-700" />
                    <h2 className="text-base font-black uppercase tracking-tight text-neutral-900 font-brand">
                      {language === 'ar' ? 'رفع اسكرين شوت آراء العملاء (الفيدباك)' : 'Upload Client Feedback Screenshots'}
                    </h2>
                  </div>
                  <p className="text-xs text-neutral-500 mt-1">
                    {language === 'ar'
                      ? 'أي صورة اسكرين شوت ترفعيها هنا من الواتساب أو إنستجرام هتظهر فوراً في قسم آراء العملاء في المتجر قدام كل الزوار.'
                      : 'Any WhatsApp or Instagram feedback screenshot uploaded here appears immediately in the Client Reviews section on your live store.'}
                  </p>
                </div>
                <span className="text-[11px] font-bold bg-[#FAF7F2] border border-neutral-300 px-3 py-1 self-start">
                  {language === 'ar' ? `المنشور حالياً: ${feedbacks.length}` : `Published: ${feedbacks.length}`}
                </span>
              </div>

              {/* Firebase Cloud Persistence Status Banner */}
              {firebaseUser ? (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-3 text-xs flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 font-bold">
                    <Cloud className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>
                      {language === 'ar'
                        ? `متصل بالحفظ السحابي الدائم (Firebase • ${firebaseUser.email || ''}) — أي صورة ترفعيها ستظل محفوظة على طول ولن تُمسح أبداً.`
                        : `Connected to Firebase Cloud (${firebaseUser.email || ''}) — screenshots stay saved permanently.`}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-300 text-amber-950 px-4 py-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">
                        {language === 'ar'
                          ? 'تنبيه مهم: لحفظ صور الفيدباك على طول وعدم مسحها عند الخروج'
                          : 'Connect Google Cloud Sync to keep screenshots permanently'}
                      </p>
                      <p className="text-[11px] text-amber-800 mt-0.5">
                        {language === 'ar'
                          ? 'اضغطي على الزر المجاور لتسجيل الدخول بحساب Google مرة واحدة حتى تُحفظ كل الصور والمنتجات في قاعدة البيانات السحابية.'
                          : 'Sign in once with your admin Google account so uploaded screenshots persist across server restarts.'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleConnectCloud}
                    disabled={isCloudConnecting}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    {isCloudConnecting
                      ? (language === 'ar' ? 'جاري الربط...' : 'Connecting...')
                      : (language === 'ar' ? 'تفعيل الحفظ السحابي (Google)' : 'Enable Cloud Sync (Google)')}
                  </button>
                </div>
              )}

              {feedbackError && (
                <div className="bg-red-50 border border-red-300 text-red-900 px-4 py-3 text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-700 shrink-0" />
                  <span>{feedbackError}</span>
                </div>
              )}

              {feedbackBanner && (
                <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 text-xs font-bold flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>{feedbackBanner}</span>
                </div>
              )}

              {/* Optional metadata fields before picking files */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                    {language === 'ar' ? 'اسم العميلة (اختياري)' : 'Customer Name (Optional)'}
                  </label>
                  <input
                    type="text"
                    value={feedbackCustomerName}
                    onChange={(e) => setFeedbackCustomerName(e.target.value)}
                    placeholder={language === 'ar' ? 'مثلاً: سارة أحمد' : 'e.g. Sarah Ahmed'}
                    className="w-full bg-white border border-neutral-300 px-3 py-2 text-xs focus:outline-none focus:border-black"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                    {language === 'ar' ? 'اسم القطعة (اختياري)' : 'Product Name (Optional)'}
                  </label>
                  <input
                    type="text"
                    value={feedbackProductName}
                    onChange={(e) => setFeedbackProductName(e.target.value)}
                    placeholder={language === 'ar' ? 'مثلاً: سوت تريكو زيتي' : 'e.g. Ribbed Knit Suit'}
                    className="w-full bg-white border border-neutral-300 px-3 py-2 text-xs focus:outline-none focus:border-black"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                    {language === 'ar' ? 'تعليق قصير (اختياري)' : 'Short Caption (Optional)'}
                  </label>
                  <input
                    type="text"
                    value={feedbackCaption}
                    onChange={(e) => setFeedbackCaption(e.target.value)}
                    placeholder={language === 'ar' ? 'مثلاً: رأي عميلتنا بعد الاستلام ❤️' : 'e.g. Client review after delivery'}
                    className="w-full bg-white border border-neutral-300 px-3 py-2 text-xs focus:outline-none focus:border-black"
                  />
                </div>
              </div>

              {/* File picker dropzone */}
              <div className="border-2 border-dashed border-neutral-300 hover:border-black bg-[#FAF7F2] p-6 text-center transition-colors">
                <input
                  ref={feedbackFileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFeedbackFilesUpload}
                  className="hidden"
                  id="feedback-screenshot-upload"
                />
                <label
                  htmlFor="feedback-screenshot-upload"
                  className="cursor-pointer flex flex-col items-center justify-center gap-2"
                >
                  <div className="w-12 h-12 bg-black text-white flex items-center justify-center">
                    <Upload className="w-5 h-5" />
                  </div>
                  <p className="text-xs sm:text-sm font-extrabold text-neutral-900">
                    {isUploadingFeedback
                      ? (language === 'ar' ? 'جاري رفع الاسكرين شوت...' : 'Uploading screenshot(s)...')
                      : (language === 'ar'
                        ? 'اضغطي هنا لاختيار صورة أو أكثر لاسكرين شوت الفيدباك من موبايلك أو جهازك'
                        : 'Click here to select one or multiple feedback screenshots from your device')}
                  </p>
                  <p className="text-[11px] text-neutral-500">
                    {language === 'ar' ? 'يدعم رفع عدة صور مرة واحدة (PNG / JPG / WEBP)' : 'Supports uploading multiple screenshots at once (PNG / JPG / WEBP)'}
                  </p>
                </label>
              </div>

              {/* Alternative Image URL */}
              <form onSubmit={handleAddFeedbackUrl} className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-neutral-200">
                <input
                  type="url"
                  value={feedbackUrlInput}
                  onChange={(e) => setFeedbackUrlInput(e.target.value)}
                  placeholder={language === 'ar' ? 'أو الصقي رابط صورة مباشرة (اختياري)...' : 'Or paste direct image URL (optional)...'}
                  className="flex-1 bg-white border border-neutral-300 px-3 py-2 text-xs font-mono focus:outline-none focus:border-black"
                />
                <button
                  type="submit"
                  disabled={isUploadingFeedback || !feedbackUrlInput.trim()}
                  className="px-4 py-2 bg-neutral-900 hover:bg-black text-white text-xs font-bold uppercase tracking-wider cursor-pointer disabled:opacity-50 shrink-0"
                >
                  {language === 'ar' ? 'إضافة بالرابط' : 'Add via URL'}
                </button>
              </form>
            </div>

            {/* Uploaded Feedback Screenshots Gallery */}
            <div className="bg-white border border-neutral-300 p-5 sm:p-6 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-200 mb-4">
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-neutral-900 font-brand">
                  {language === 'ar' ? 'الاسكرينات المرفوعة حالياً' : 'Published Feedback Screenshots'}
                </h3>
                <button
                  type="button"
                  onClick={fetchFeedbacks}
                  className="text-xs font-bold text-neutral-600 hover:text-black flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{language === 'ar' ? 'تحديث' : 'Refresh'}</span>
                </button>
              </div>

              {feedbacks.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-neutral-300 bg-[#FAF7F2] text-xs text-neutral-500">
                  <ImageIcon className="w-8 h-8 text-neutral-400 mx-auto mb-2" />
                  <p className="font-bold text-neutral-700">
                    {language === 'ar' ? 'لا توجد اسكرينات مرفوعة حتى الآن' : 'No feedback screenshots uploaded yet'}
                  </p>
                  <p className="mt-1 text-[11px]">
                    {language === 'ar'
                      ? 'ارفعي أول اسكرين شوت من الصندوق بالأعلى ليظهر في المتجر فوراً.'
                      : 'Upload your first feedback screenshot above to showcase it in the storefront.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 items-start">
                  {feedbacks.map((fb) => (
                    <div key={fb.id} className="border border-neutral-300 bg-[#FAF7F2] flex flex-col justify-between">
                      <div>
                        <div className="w-full bg-[#F3EFE6] p-1.5 overflow-hidden border-b border-neutral-200">
                          <img
                            src={fb.image}
                            alt={fb.customerName || 'Feedback'}
                            className="w-full h-auto max-h-[420px] object-contain mx-auto"
                          />
                        </div>
                        <div className="p-2.5 text-xs space-y-1">
                          {fb.customerName && <p className="font-bold text-neutral-900">{fb.customerName}</p>}
                          {fb.productName && <p className="text-[11px] text-neutral-500">{fb.productName}</p>}
                          {fb.caption && <p className="text-[11px] text-neutral-700 whitespace-pre-line">{fb.caption}</p>}
                          <p className="text-[10px] text-neutral-400">{fb.createdAt}</p>
                        </div>
                      </div>
                      <div className="p-2 border-t border-neutral-200 bg-white">
                        <button
                          type="button"
                          onClick={() => handleDeleteFeedback(fb.id)}
                          className="w-full py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>{language === 'ar' ? 'حذف' : 'Delete'}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: STORE SETTINGS & AUTOMATIC OWNER NOTIFICATIONS */}
        {activeTab === 'settings' && (
          <div className="max-w-3xl mx-auto bg-white border border-neutral-300 p-6 sm:p-8 shadow-xs animate-fadeIn text-start">
            
            <div className="pb-4 border-b border-neutral-200 mb-6">
              <h2 className="text-lg font-black uppercase tracking-tight text-neutral-900 font-brand">
                {language === 'ar' ? 'إعدادات المتجر والإشعارات التلقائية' : 'Storefront & Auto-Notification Settings'}
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                {language === 'ar'
                  ? 'بمجرد تأكيد العميل لأي طلب على الموقع، يقوم السيرفر تلقائياً بإرسال كامل تفاصيل الطلب لصاحب المحل عبر القنوات المفعّلة أدناه.'
                  : 'Whenever a customer confirms an order on the website, the server automatically sends full order details to the store owner via the enabled channels below.'
                }
              </p>
            </div>

            {firebaseUser ? (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-3 text-xs mb-5 flex items-center gap-2 font-bold">
                <Cloud className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>
                  {language === 'ar'
                    ? `الحفظ السحابي مفعّل (${firebaseUser.email || ''}) — توكن تيليجرام والـ Chat ID وكافة الإعدادات محفوظة على السحابة ولن تُمسح عند الخروج.`
                    : `Cloud Sync Active (${firebaseUser.email || ''}) — Telegram Bot Token, Chat ID & settings are permanently backed up.`}
                </span>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-300 text-amber-950 px-4 py-3 text-xs mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <span>
                    {language === 'ar'
                      ? 'لحفظ توكن بوت تيليجرام والـ Chat ID للأبد على كل الأجهزة وعدم مسحهم بعد الخروج، اضغطي "تفعيل الحفظ السحابي" ثم احفظي التغييرات.'
                      : 'Enable Google Cloud Sync so your Telegram Bot Token & Chat ID persist permanently across restarts.'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleConnectCloud}
                  disabled={isCloudConnecting}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shrink-0 cursor-pointer disabled:opacity-50"
                >
                  {isCloudConnecting
                    ? (language === 'ar' ? 'جاري الربط...' : 'Connecting...')
                    : (language === 'ar' ? 'تفعيل الحفظ السحابي (Google)' : 'Enable Cloud Sync (Google)')}
                </button>
              </div>
            )}

            <form onSubmit={handleSaveSettings} className="space-y-6">
              
              {/* Automatic Owner Notifications Section */}
              <div className="bg-[#FAF7F2] border border-neutral-300 p-4 sm:p-5 space-y-5">
                <div className="flex items-center justify-between border-b border-neutral-300 pb-3">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-emerald-700" />
                    <h3 className="font-extrabold text-xs uppercase tracking-wider text-neutral-900">
                      {language === 'ar' ? 'قنوات إرسال الطلب التلقائي لصاحب المحل' : 'Automatic Order Dispatch Channels (Server-Side)'}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={handleTestNotification}
                    disabled={isTestingNotify}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold uppercase tracking-wider cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3 h-3" />
                    <span>{isTestingNotify ? (language === 'ar' ? 'جاري الاختبار...' : 'Sending...') : (language === 'ar' ? 'اختبار إرسال إشعار' : 'Send Test Alert')}</span>
                  </button>
                </div>

                {testNotifyResult && (
                  <div className={`p-3 border text-xs space-y-1 ${testNotifyResult.failed.length > 0 ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-emerald-50 border-emerald-300 text-emerald-900'}`}>
                    <p className="font-bold">
                      {language === 'ar' ? 'القنوات التي استلمت الإشعار:' : 'Delivered via:'}{' '}
                      <span className="font-mono">{testNotifyResult.sent.join(', ')}</span>
                    </p>
                    {testNotifyResult.failed.map((f, idx) => (
                      <p key={idx} className="text-red-700 font-mono text-[11px]">
                        {f.channel}: {f.error}
                      </p>
                    ))}
                  </div>
                )}

                {/* 1. Telegram Bot */}
                <div className="bg-white border-2 border-sky-700/80 p-4 sm:p-5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-200 pb-2.5">
                    <div>
                      <h4 className="font-extrabold text-xs uppercase text-neutral-900">
                        {language === 'ar' ? '📲 إشعارات تيليجرام الفورية (Telegram Bot — مجاني 100%)' : '📲 Telegram Instant Order Bot (100% Free)'}
                      </h4>
                      <p className="text-[11px] text-neutral-600 mt-0.5">
                        {language === 'ar'
                          ? 'أسرع طريقة لوصول كل أوردر بتفاصيله على موبايلك فوراً:'
                          : 'Fastest instant order alert directly to your phone:'}
                      </p>
                    </div>
                    <a
                      href="https://t.me/BotFather"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-700 hover:bg-sky-800 text-white text-[11px] font-bold shrink-0 self-start"
                    >
                      <span>{language === 'ar' ? 'فتح BotFather على تيليجرام ↗' : 'Open @BotFather ↗'}</span>
                    </a>
                  </div>

                  <div className="bg-sky-50/70 border border-sky-200 p-3 text-[11px] text-sky-950 space-y-1">
                    <p className="font-bold">
                      {language === 'ar' ? 'الخطوات في دقيقة واحدة:' : 'Quick 1-minute setup:'}
                    </p>
                    <ol className="list-decimal ps-4 space-y-0.5">
                      <li>
                        {language === 'ar'
                          ? 'اضغطي "فتح BotFather" بالأعلى واضغطي Start، ثم ابعتي له الأمر: /newbot'
                          : 'Open @BotFather above, tap Start, and send: /newbot'}
                      </li>
                      <li>
                        {language === 'ar'
                          ? 'اكتبي اسم للبوت (مثلاً: She Store)، ثم يوزرنيم ينتهي بـ bot (مثلاً: shestore_orders_bot).'
                          : 'Enter a bot name (e.g. She Store), then a username ending with "bot" (e.g. shestore_orders_bot).'}
                      </li>
                      <li>
                        {language === 'ar'
                          ? 'هيبعتلك رسالة فيها كود طويل (HTTP API Token) ← انسخيه والصقيه في خانة Bot Token بالأسفل.'
                          : 'Copy the HTTP API Token BotFather sends and paste it into Bot Token below.'}
                      </li>
                      <li>
                        {language === 'ar'
                          ? 'افتحي لينك البوت الجديد بتاعك واضغطي Start جواه، ثم اضغطي "جلب Chat ID تلقائياً" وبعدين حفظ الإعدادات!'
                          : 'Open your new bot link, tap Start inside it, then click "Auto-Detect Chat ID" below and Save!'}
                      </li>
                    </ol>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-neutral-700 mb-1">Bot Token</label>
                      <input
                        type="text"
                        value={telegramBotToken}
                        onChange={(e) => setTelegramBotToken(e.target.value)}
                        placeholder="123456789:ABCdef..."
                        className="w-full bg-white border border-neutral-300 px-3 py-2 text-xs font-mono focus:outline-none focus:border-black"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-neutral-700 mb-1">Chat ID</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={telegramChatId}
                          onChange={(e) => setTelegramChatId(e.target.value)}
                          placeholder="e.g. 987654321"
                          className="flex-1 bg-white border border-neutral-300 px-3 py-2 text-xs font-mono focus:outline-none focus:border-black"
                        />
                        <button
                          type="button"
                          onClick={handleDetectTelegramChatId}
                          disabled={isDetectingTg}
                          className="px-3 py-2 bg-sky-700 hover:bg-sky-800 text-white text-[11px] font-bold shrink-0 cursor-pointer disabled:opacity-50"
                        >
                          {isDetectingTg
                            ? (language === 'ar' ? 'جاري الجلب...' : 'Detecting...')
                            : (language === 'ar' ? 'جلب Chat ID تلقائياً' : 'Auto-Detect')}
                        </button>
                      </div>
                    </div>
                  </div>

                  {tgDetectMsg && (
                    <div
                      className={`p-3 text-xs border space-y-2 ${
                        tgDetectMsg.ok
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                          : 'bg-amber-50 border-amber-300 text-amber-950'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <span>{tgDetectMsg.text}</span>
                        {tgDetectMsg.botUrl && (
                          <a
                            href={tgDetectMsg.botUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 bg-sky-700 text-white text-[11px] font-bold shrink-0 self-start"
                          >
                            {language === 'ar' ? 'فتح البوت على تيليجرام ↗' : 'Open Bot ↗'}
                          </a>
                        )}
                      </div>

                      {tgDetectMsg.chats && tgDetectMsg.chats.length > 0 && (
                        <div className="pt-2 border-t border-emerald-200/80 space-y-1.5">
                          <p className="text-[11px] font-bold">
                            {language === 'ar'
                              ? 'الحسابات المتاحة لاستقبال الطلبات (يمكن إدخال أكثر من ID مفصولين بفاصلة):'
                              : 'Detected accounts (you can also enter multiple IDs separated by commas):'}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {tgDetectMsg.chats.map((c) => {
                              const currentIds = telegramChatId.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
                              const isSelectedOnly = currentIds.length === 1 && currentIds[0] === c.id;
                              return (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => setTelegramChatId(c.id)}
                                  className={`px-2.5 py-1.5 text-[11px] font-bold border cursor-pointer transition-colors ${
                                    isSelectedOnly
                                      ? 'bg-emerald-700 text-white border-emerald-800'
                                      : 'bg-white text-neutral-800 border-emerald-300 hover:bg-emerald-100'
                                  }`}
                                >
                                  {c.name} {c.username ? `(@${c.username})` : ''} — <span className="font-mono">{c.id}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 2. Email via Resend */}
                <div className="bg-white border border-neutral-200 p-4 space-y-3">
                  <div>
                    <h4 className="font-bold text-xs text-neutral-900">
                      {language === 'ar' ? '2. إشعار عبر البريد الإلكتروني (Resend Email)' : '2. Owner Email Notification (Resend)'}
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                        {language === 'ar' ? 'إيميل صاحب المحل' : 'Owner Email'}
                      </label>
                      <input
                        type="email"
                        value={ownerEmail}
                        onChange={(e) => setOwnerEmail(e.target.value)}
                        placeholder="owner@shestore.com"
                        className="w-full bg-white border border-neutral-300 px-3 py-2 text-xs font-mono focus:outline-none focus:border-black"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-neutral-700 mb-1">Resend API Key</label>
                      <input
                        type="text"
                        value={resendApiKey}
                        onChange={(e) => setResendApiKey(e.target.value)}
                        placeholder="re_..."
                        className="w-full bg-white border border-neutral-300 px-3 py-2 text-xs font-mono focus:outline-none focus:border-black"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Webhook URL */}
                <div className="bg-white border border-neutral-200 p-4 space-y-2">
                  <label className="block font-bold text-xs text-neutral-900">
                    {language === 'ar' ? '3. رابط Webhook مخصص (Make / Zapier / Discord / Slack)' : '3. Custom Webhook URL (Make / Zapier / Discord / Slack)'}
                  </label>
                  <input
                    type="url"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://hooks.zapier.com/... or https://discord.com/api/webhooks/..."
                    className="w-full bg-white border border-neutral-300 px-3 py-2 text-xs font-mono focus:outline-none focus:border-black"
                  />
                </div>
              </div>

              {/* Support Phone & Instagram */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                    {language === 'ar' ? 'رقم واتساب خدمة العملاء' : 'Customer Support WhatsApp'}
                  </label>
                  <input
                    type="text"
                    value={adminPhone}
                    onChange={(e) => setAdminPhone(e.target.value)}
                    placeholder="e.g. 201115010812"
                    className="w-full bg-white border border-neutral-300 px-3.5 py-2 text-xs font-mono focus:outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                    {language === 'ar' ? 'حساب الإنستجرام' : 'Instagram Handle'}
                  </label>
                  <input
                    type="text"
                    value={instaHandle}
                    onChange={(e) => setInstaHandle(e.target.value)}
                    placeholder="e.g. @she.store._eg"
                    className="w-full bg-white border border-neutral-300 px-3.5 py-2 text-xs focus:outline-none focus:border-black"
                  />
                </div>
              </div>

              {/* Admin Portal Password */}
              <div className="pt-3 border-t border-neutral-200">
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                  {language === 'ar' ? 'كلمة مرور لوحة التحكم' : 'Admin Dashboard Password'}
                </label>
                <input
                  type="text"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full bg-white border border-neutral-300 px-3.5 py-2 text-xs font-mono focus:outline-none focus:border-black"
                />
                <p className="text-[11px] text-neutral-400 mt-1">
                  {language === 'ar' ? 'كلمة المرور المطلوبة لدخول لوحة التحكم هذه.' : 'Password required to access this dashboard.'}
                </p>
              </div>

              {settingsSaved && (
                <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>{language === 'ar' ? 'تم حفظ وتحديث الإعدادات بنجاح!' : 'Settings updated successfully!'}</span>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  className="bg-black text-white hover:bg-neutral-800 px-6 py-3 text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer flex items-center gap-2"
                >
                  <Save className="w-4 h-4 text-amber-300" />
                  <span>{language === 'ar' ? 'حفظ كافة التغييرات' : 'Save All Changes'}</span>
                </button>
              </div>

            </form>

          </div>
        )}

      </main>

      {/* Product Add / Edit Modal */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-fadeIn text-left">
          <div className="bg-white border border-neutral-400 w-full max-w-2xl max-h-[92vh] overflow-y-auto p-5 sm:p-7 shadow-2xl relative no-scrollbar">
            
            <div className="flex items-center justify-between pb-4 border-b border-neutral-200 mb-4">
              <div>
                <h3 className="font-extrabold text-base uppercase font-brand text-black">
                  {editingProduct ? (language === 'ar' ? 'تعديل بيانات القطعة' : 'Edit Catalog Piece') : t.addNewPiece}
                </h3>
                <p className="text-[11px] text-neutral-500">
                  {language === 'ar' ? 'أضيفي صور من جهازك واكتبي التصنيف بحرية' : 'Upload photos from device and type custom categories freely'}
                </p>
              </div>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-black cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
              
              {/* Product Title */}
              <div>
                <label className="block font-bold uppercase text-neutral-700 mb-1">{t.productTitle} *</label>
                <input
                  type="text"
                  required
                  value={language === 'ar' ? prodNameAr || prodName : prodName}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (language === 'ar') {
                      setProdNameAr(val);
                      if (!prodName) setProdName(val);
                    } else {
                      setProdName(val);
                      if (!prodNameAr) setProdNameAr(val);
                    }
                  }}
                  placeholder={language === 'ar' ? 'مثال: سوت تريكو ريبد واسع' : 'e.g. OVERSIZED TRENCH COAT'}
                  className="w-full border border-neutral-300 p-2.5 uppercase font-bold focus:outline-none focus:border-black"
                />
              </div>

              {/* Price & Original Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold uppercase text-neutral-700 mb-1">{t.priceEgp} *</label>
                  <input
                    type="number"
                    required
                    value={prodPrice}
                    onChange={(e) => setProdPrice(Number(e.target.value))}
                    className="w-full border border-neutral-300 p-2.5 font-bold focus:outline-none focus:border-black"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-neutral-700 mb-1">{t.originalPriceOptional}</label>
                  <input
                    type="number"
                    value={prodOrigPrice || ''}
                    onChange={(e) => setProdOrigPrice(e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="Optional"
                    className="w-full border border-neutral-300 p-2.5 focus:outline-none focus:border-black"
                  />
                </div>
              </div>

              {/* CATEGORY: Custom typing by hand + quick suggestions */}
              <div className="p-3 bg-neutral-50 border border-neutral-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block font-bold uppercase text-neutral-800">
                    {t.categoryLabel} *
                  </label>
                  <span className="text-[10px] text-neutral-500 font-medium">
                    {language === 'ar' ? 'اكتبي أي تصنيف بايدك' : 'Type by hand'}
                  </span>
                </div>

                <input
                  type="text"
                  required
                  value={prodCategory}
                  onChange={(e) => setProdCategory(e.target.value)}
                  placeholder={t.categoryTypePlaceholder}
                  className="w-full border border-neutral-300 p-2.5 bg-white font-semibold focus:outline-none focus:border-black"
                />

                <div>
                  <p className="text-[10px] text-neutral-500 mb-1.5">
                    {t.categoryTypeHelp}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestedCategories.map((catName) => (
                      <button
                        key={catName}
                        type="button"
                        onClick={() => setProdCategory(catName)}
                        className={`text-[10px] px-2.5 py-1 border transition-colors cursor-pointer ${
                          prodCategory.toLowerCase() === catName.toLowerCase()
                            ? 'bg-black text-white border-black font-bold'
                            : 'bg-white text-neutral-700 border-neutral-300 hover:border-black'
                        }`}
                      >
                        {catName}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Badge Tag */}
              <div>
                <label className="block font-bold uppercase text-neutral-700 mb-1">{t.badgeTag}</label>
                <input
                  type="text"
                  value={language === 'ar' ? prodBadgeAr : prodBadge}
                  onChange={(e) => {
                    if (language === 'ar') setProdBadgeAr(e.target.value);
                    else setProdBadge(e.target.value);
                  }}
                  placeholder={language === 'ar' ? 'مثال: كولكشن جديد ✨' : 'e.g. NEW DROP ✨ or BESTSELLER'}
                  className="w-full border border-neutral-300 p-2.5 focus:outline-none focus:border-black"
                />
              </div>

              {/* Caption / Description */}
              <div>
                <label className="block font-bold uppercase text-neutral-700 mb-1">{t.captionDesc}</label>
                <textarea
                  rows={2}
                  value={language === 'ar' ? prodDescAr || prodDesc : prodDesc}
                  onChange={(e) => {
                    if (language === 'ar') setProdDescAr(e.target.value);
                    else setProdDesc(e.target.value);
                  }}
                  placeholder={language === 'ar' ? 'مثال: تريكو ناعم وستايل أنيق ومحتشم 🤎✨' : 'e.g. Soft knit, classy look 🤎✨'}
                  className="w-full border border-neutral-300 p-2.5 focus:outline-none focus:border-black"
                />
              </div>

              {/* Fabric Specs */}
              <div>
                <label className="block font-bold uppercase text-neutral-700 mb-1">{t.fabricSpecs}</label>
                <input
                  type="text"
                  value={language === 'ar' ? prodFabricAr || prodFabric : prodFabric}
                  onChange={(e) => {
                    if (language === 'ar') setProdFabricAr(e.target.value);
                    else setProdFabric(e.target.value);
                  }}
                  placeholder={language === 'ar' ? 'مثال: تريكو مضلع عالي الكثافة فاخر • معالج ضد التوبير' : 'e.g. 100% Heavyweight Cotton • Anti-pilling'}
                  className="w-full border border-neutral-300 p-2.5 focus:outline-none focus:border-black"
                />
              </div>

              {/* Sizes */}
              <div>
                <label className="block font-bold uppercase text-neutral-700 mb-1">{t.sizesComma}</label>
                <input
                  type="text"
                  value={prodSizesStr}
                  onChange={(e) => setProdSizesStr(e.target.value)}
                  placeholder={language === 'ar' ? 'مقاس موحد (٥٥ - ٩٠ كجم)، أوفر سايز (٩٠ - ١١٥ كجم)' : 'Free Size (55 - 90 KG), Oversized (90 - 115 KG)'}
                  className="w-full border border-neutral-300 p-2.5 focus:outline-none focus:border-black"
                />
              </div>

              {/* Inventory Tracking Toggle */}
              <div className="p-3 bg-neutral-50 border border-neutral-200 flex items-center justify-between gap-3">
                <div>
                  <span className="font-bold text-neutral-900 block text-xs">
                    {language === 'ar' ? 'تتبع كمية المخزون لهذا الموديل' : 'Track Inventory Stock for This Product'}
                  </span>
                  <span className="text-[10px] text-neutral-500">
                    {language === 'ar'
                      ? 'ينقص تلقائياً مع كل أوردر ويمنع الطلب عند نفاد الكمية'
                      : 'Auto-deducts on orders and blocks checkout when sold out'}
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={prodTrackStock}
                  onChange={(e) => setProdTrackStock(e.target.checked)}
                  className="w-4 h-4 accent-black cursor-pointer"
                />
              </div>

              {/* ----------------- PHOTO & VARIANTS SECTION ----------------- */}
              <div className="pt-3 border-t border-neutral-300 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-extrabold uppercase tracking-wide text-neutral-900 text-xs">
                      {language === 'ar' ? 'صور وألوان الموديل' : 'Colors & Photos'}
                    </h4>
                    <p className="text-[10px] text-neutral-500">
                      {language === 'ar' ? 'اختاري صور من جهازك أو من مكتبة صور المتجر' : 'Select photos from your device or store photo library'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddVariant}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 border border-neutral-300 text-[10px] font-bold uppercase cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{language === 'ar' ? 'إضافة لون آخر' : 'Add Another Color'}</span>
                  </button>
                </div>

                {/* Color Variants Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  {variants.map((v, idx) => {
                    const vTitle = language === 'ar' && v.colorNameAr ? v.colorNameAr : (v.colorName || `Color ${idx + 1}`);
                    return (
                      <div
                        key={idx}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 border text-xs cursor-pointer transition-all ${
                          activeVariantIdx === idx
                            ? 'bg-black text-white border-black font-bold'
                            : 'bg-white text-neutral-700 border-neutral-300 hover:border-black'
                        }`}
                        onClick={() => setActiveVariantIdx(idx)}
                      >
                        <span
                          className="w-3 h-3 rounded-full border border-white/40 shrink-0 inline-block"
                          style={{ backgroundColor: v.hex || '#000000' }}
                        />
                        <span className="truncate max-w-[100px]">{vTitle}</span>
                        {variants.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveVariant(idx);
                            }}
                            className="hover:text-red-400 p-0.5 ml-1"
                            title="Remove color"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Active Variant Configuration */}
                <div className="p-3.5 bg-neutral-50 border border-neutral-300 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-neutral-700 text-[11px] mb-1">
                        {language === 'ar' ? 'اسم اللون' : 'Color Name'}
                      </label>
                      <input
                        type="text"
                        value={language === 'ar' ? currentVariant?.colorNameAr || currentVariant?.colorName || '' : currentVariant?.colorName || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setVariants((prev) => {
                            const next = [...prev];
                            if (next[activeVariantIdx]) {
                              if (language === 'ar') {
                                next[activeVariantIdx].colorNameAr = val;
                                if (!next[activeVariantIdx].colorName) next[activeVariantIdx].colorName = val;
                              } else {
                                next[activeVariantIdx].colorName = val;
                                if (!next[activeVariantIdx].colorNameAr) next[activeVariantIdx].colorNameAr = val;
                              }
                            }
                            return next;
                          });
                        }}
                        placeholder={language === 'ar' ? 'مثال: أسود كلاسيك' : 'e.g. Classic Black'}
                        className="w-full bg-white border border-neutral-300 p-2 text-xs font-semibold focus:outline-none focus:border-black"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-neutral-700 text-[11px] mb-1">
                        {language === 'ar' ? 'كود اللون / Hex' : 'Color Hex'}
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={currentVariant?.hex || '#121212'}
                          onChange={(e) => {
                            const val = e.target.value;
                            setVariants((prev) => {
                              const next = [...prev];
                              if (next[activeVariantIdx]) next[activeVariantIdx].hex = val;
                              return next;
                            });
                          }}
                          className="w-8 h-8 cursor-pointer border border-neutral-300 p-0.5 bg-white"
                        />
                        <input
                          type="text"
                          value={currentVariant?.hex || '#121212'}
                          onChange={(e) => {
                            const val = e.target.value;
                            setVariants((prev) => {
                              const next = [...prev];
                              if (next[activeVariantIdx]) next[activeVariantIdx].hex = val;
                              return next;
                            });
                          }}
                          className="flex-1 bg-white border border-neutral-300 p-2 font-mono text-xs focus:outline-none focus:border-black uppercase"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Active Variant Stock Quantities per Size */}
                  {prodTrackStock && (
                    <div className="bg-white border border-neutral-200 p-3 space-y-2">
                      <label className="block font-bold text-neutral-800 text-[11px]">
                        {language === 'ar'
                          ? `الكمية المتوفرة بالمخزون للون (${currentVariant?.colorNameAr || currentVariant?.colorName}):`
                          : `Stock Quantity for (${currentVariant?.colorName}):`}
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {prodSizesStr
                          .split(/[,،]/)
                          .map((s) => s.trim())
                          .filter(Boolean)
                          .map((szKey) => {
                            const stockKey = editingProduct
                              ? resolveCanonicalSizeKey(editingProduct, szKey)
                              : szKey;
                            const curVal =
                              currentVariant?.sizeStock?.[stockKey] ??
                              currentVariant?.sizeStock?.[szKey] ??
                              DEFAULT_STOCK_PER_SIZE;
                            return (
                              <div key={szKey} className="flex items-center justify-between gap-2 bg-neutral-50 border border-neutral-200 px-2.5 py-1.5">
                                <span className="text-[11px] font-semibold text-neutral-700 truncate">{szKey}</span>
                                <input
                                  type="number"
                                  min={0}
                                  value={curVal}
                                  onChange={(e) => {
                                    const nextQty = Math.max(0, Number(e.target.value) || 0);
                                    setVariants((prev) => {
                                      const next = [...prev];
                                      const target = next[activeVariantIdx];
                                      if (target) {
                                        const nextSizeStock = { ...(target.sizeStock || {}), [stockKey]: nextQty };
                                        next[activeVariantIdx] = {
                                          ...target,
                                          sizeStock: nextSizeStock,
                                          stock: Object.values(nextSizeStock).reduce((a, b) => a + b, 0),
                                        };
                                      }
                                      return next;
                                    });
                                  }}
                                  className="w-16 bg-white border border-neutral-300 px-2 py-1 text-center font-bold text-xs focus:outline-none focus:border-black"
                                />
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {/* PHOTO PICKER TABS: Upload / Library / URL */}
                  <div>
                    <label className="block font-bold text-neutral-700 text-[11px] mb-1.5 uppercase">
                      {t.productImageLabel} ({language === 'ar' && currentVariant?.colorNameAr ? currentVariant.colorNameAr : currentVariant?.colorName})
                    </label>

                    <div className="flex items-center gap-2 mb-2 border-b border-neutral-200 pb-2">
                      <button
                        type="button"
                        onClick={() => setPhotoTab('upload')}
                        className={`px-3 py-1 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                          photoTab === 'upload'
                            ? 'bg-black text-white shadow-xs'
                            : 'bg-white text-neutral-600 hover:text-black border border-neutral-300'
                        }`}
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{t.uploadFromDevice}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPhotoTab('library')}
                        className={`px-3 py-1 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                          photoTab === 'library'
                            ? 'bg-black text-white shadow-xs'
                            : 'bg-white text-neutral-600 hover:text-black border border-neutral-300'
                        }`}
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>{t.chooseFromLibrary}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPhotoTab('url')}
                        className={`px-2 py-1 text-xs font-medium transition-all cursor-pointer flex items-center gap-1 ${
                          photoTab === 'url'
                            ? 'bg-black text-white'
                            : 'bg-white text-neutral-500 hover:text-black border border-neutral-200'
                        }`}
                      >
                        <LinkIcon className="w-3 h-3" />
                        <span>URL</span>
                      </button>
                    </div>

                    {/* Active Preview */}
                    <div className="flex items-start gap-3 bg-white p-2.5 border border-neutral-300 mb-2">
                      <div className="relative w-20 h-24 bg-neutral-100 border border-neutral-200 overflow-hidden shrink-0">
                        {currentVariant?.image ? (
                          <img
                            src={currentVariant.image}
                            alt={currentVariant.colorName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-neutral-400">
                            <ImageIcon className="w-6 h-6" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 text-xs">
                        <div className="flex items-center gap-1.5 text-emerald-700 font-bold mb-1">
                          <Check className="w-4 h-4 text-emerald-600" />
                          <span>{t.photoSelected}</span>
                        </div>
                        <p className="text-[11px] text-neutral-500 line-clamp-1 font-mono">
                          {currentVariant?.image?.startsWith('data:') ? (language === 'ar' ? 'صورة مرفوعة من جهازك' : 'Image uploaded from device') : currentVariant?.image}
                        </p>
                        <p className="text-[10px] text-neutral-400 mt-1">
                          {language === 'ar' ? 'يمكنك استبدال هذه الصورة باختيار خيار آخر أدناه' : 'Replace this photo anytime by choosing from below'}
                        </p>
                      </div>
                    </div>

                    {/* TAB CONTENT: Upload */}
                    {photoTab === 'upload' && (
                      <div className="p-4 bg-white border-2 border-dashed border-neutral-300 hover:border-black transition-colors text-center cursor-pointer">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleFileUpload}
                          className="hidden"
                          id="device-photo-upload"
                        />
                        <label htmlFor="device-photo-upload" className="cursor-pointer block">
                          <Upload className="w-7 h-7 mx-auto text-neutral-400 mb-1.5" />
                          <span className="font-bold text-xs text-neutral-900 block uppercase tracking-wider">
                            {language === 'ar' ? 'اضغطي لاختيار صورة من جهازك / الكاميرا' : 'Click to choose photo from your device / camera'}
                          </span>
                          <span className="text-[10px] text-neutral-400 mt-0.5 block">
                            JPG, PNG, WebP — Auto-compressed for instant loading
                          </span>
                        </label>
                      </div>
                    )}

                    {/* TAB CONTENT: Library Gallery */}
                    {photoTab === 'library' && (
                      <div className="space-y-2">
                        <p className="text-[11px] text-neutral-500">
                          {language === 'ar' ? 'اضغطي على أي صورة لاختيارها فوراً:' : 'Click any photo to select it instantly:'}
                        </p>

                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-48 overflow-y-auto p-1 bg-white border border-neutral-200 no-scrollbar">
                          {/* User uploaded photos first */}
                          {userUploadedPhotos.map((imgUrl, i) => (
                            <button
                              key={`user-${i}`}
                              type="button"
                              onClick={() => handleSelectLibraryPhoto(imgUrl)}
                              className={`relative aspect-[3/4] overflow-hidden border cursor-pointer group ${
                                currentVariant?.image === imgUrl
                                  ? 'ring-2 ring-emerald-600 border-emerald-600 scale-95'
                                  : 'border-neutral-200 hover:border-black'
                              }`}
                              title="Uploaded photo"
                            >
                              <img src={imgUrl} alt="Uploaded" className="w-full h-full object-cover" />
                              {currentVariant?.image === imgUrl && (
                                <div className="absolute inset-0 bg-emerald-600/30 flex items-center justify-center">
                                  <Check className="w-5 h-5 text-white bg-emerald-600 rounded-full p-0.5" />
                                </div>
                              )}
                              <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[8px] px-0.5 truncate text-center">
                                {language === 'ar' ? 'مرفوعة' : 'Uploaded'}
                              </span>
                            </button>
                          ))}

                          {/* Curated Store Photos */}
                          {STORE_PHOTO_LIBRARY.map((item, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => handleSelectLibraryPhoto(item.url)}
                              className={`relative aspect-[3/4] overflow-hidden border cursor-pointer group ${
                                currentVariant?.image === item.url
                                  ? 'ring-2 ring-emerald-600 border-emerald-600 scale-95'
                                  : 'border-neutral-200 hover:border-black'
                              }`}
                              title={language === 'ar' ? item.labelAr : item.label}
                            >
                              <img src={item.url} alt={item.label} className="w-full h-full object-cover" />
                              {currentVariant?.image === item.url && (
                                <div className="absolute inset-0 bg-emerald-600/30 flex items-center justify-center">
                                  <Check className="w-5 h-5 text-white bg-emerald-600 rounded-full p-0.5" />
                                </div>
                              )}
                              <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[8px] px-0.5 truncate text-center">
                                {language === 'ar' ? item.labelAr : item.label}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* TAB CONTENT: URL */}
                    {photoTab === 'url' && (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={urlInput}
                          onChange={(e) => setUrlInput(e.target.value)}
                          placeholder="https://example.com/photo.jpg"
                          className="flex-1 bg-white border border-neutral-300 p-2 text-xs font-mono focus:outline-none focus:border-black"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (urlInput.trim()) {
                              handleSelectLibraryPhoto(urlInput.trim());
                              setUrlInput('');
                            }
                          }}
                          className="px-3 py-2 bg-black text-white text-xs font-bold uppercase cursor-pointer"
                        >
                          {language === 'ar' ? 'تطبيق' : 'Apply'}
                        </button>
                      </div>
                    )}

                  </div>

                </div>
              </div>

              {/* Submit / Cancel Buttons */}
              <div className="pt-4 border-t border-neutral-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2 border border-neutral-300 hover:bg-neutral-100 font-bold uppercase cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-black text-white hover:bg-neutral-800 font-bold uppercase cursor-pointer shadow-xs"
                >
                  {t.savePiece}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* In-App Delete Confirmation Modal (works reliably inside iframes) */}
      {pendingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
          onClick={() => !isDeletingItem && setPendingDelete(null)}
        >
          <div
            className="bg-[#FAF7F2] w-full max-w-sm border border-neutral-400 p-5 shadow-2xl space-y-4 text-start"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 text-red-700">
                <Trash2 className="w-4 h-4 shrink-0" />
                <h4 className="font-extrabold text-sm uppercase">
                  {language === 'ar' ? 'تأكيد الحذف' : 'Confirm Deletion'}
                </h4>
              </div>
              <button
                type="button"
                disabled={isDeletingItem}
                onClick={() => setPendingDelete(null)}
                className="p-1 hover:bg-black/5 cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-800 leading-relaxed">{pendingDelete.message}</p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-300">
              <button
                type="button"
                disabled={isDeletingItem}
                onClick={() => setPendingDelete(null)}
                className="px-4 py-2 bg-white hover:bg-neutral-100 text-neutral-800 border border-neutral-300 text-xs font-bold cursor-pointer"
              >
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={isDeletingItem}
                onClick={executePendingDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {isDeletingItem
                  ? (language === 'ar' ? 'جاري الحذف...' : 'Deleting...')
                  : (language === 'ar' ? 'نعم، احذف' : 'Yes, Delete')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
