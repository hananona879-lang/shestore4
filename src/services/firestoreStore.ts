import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { signInWithPopup, signOut } from 'firebase/auth';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../lib/firebase';
import type { FeedbackScreenshot, PlacedOrder, Product, StoreSettings } from '../types';

export const BOOTSTRAPPED_ADMIN_EMAIL = 'tawapeer@gmail.com';
const MAX_FIRESTORE_IMAGE_CHARS = 700_000;

export async function signInAdminWithGoogle() {
  const credential = await signInWithPopup(auth, googleProvider);
  return credential.user;
}

export async function signOutAdminFirebase() {
  await signOut(auth);
}

/**
 * Compresses an uploaded image File into a JPEG Data URL safely below
 * Firestore's 1MB document limit while keeping screenshots crisp and readable.
 */
export async function compressImageFileForCloud(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });

  if (!dataUrl.startsWith('data:image/')) {
    return dataUrl;
  }

  return new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const steps: Array<{ maxDim: number; quality: number }> = [
        { maxDim: 1100, quality: 0.82 },
        { maxDim: 900, quality: 0.72 },
        { maxDim: 750, quality: 0.6 },
        { maxDim: 600, quality: 0.5 },
      ];

      let bestResult = dataUrl;

      for (const step of steps) {
        let width = img.width || step.maxDim;
        let height = img.height || step.maxDim;

        if (width > height && width > step.maxDim) {
          height = Math.round((height * step.maxDim) / width);
          width = step.maxDim;
        } else if (height >= width && height > step.maxDim) {
          width = Math.round((width * step.maxDim) / height);
          height = step.maxDim;
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) break;

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const candidate = canvas.toDataURL('image/jpeg', step.quality);
        bestResult = candidate;
        if (candidate.length <= MAX_FIRESTORE_IMAGE_CHARS) {
          resolve(candidate);
          return;
        }
      }

      resolve(bestResult);
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// ============================================================================
// Feedback Screenshots (Firestore 'feedbacks' collection)
// ============================================================================

export interface CloudFeedbackDoc extends FeedbackScreenshot {
  published: boolean;
  ownerId: string;
  createdAtMs: number;
}

export async function fetchPublishedFeedbacksFromCloud(): Promise<FeedbackScreenshot[]> {
  const path = 'feedbacks';
  try {
    const q = query(collection(db, path), where('published', '==', true));
    const snap = await getDocs(q);
    const items: Array<FeedbackScreenshot & { _ms: number }> = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data() as Partial<CloudFeedbackDoc>;
      if (data.id && data.image) {
        items.push({
          id: String(data.id),
          image: String(data.image),
          customerName: data.customerName ? String(data.customerName) : '',
          productName: data.productName ? String(data.productName) : '',
          caption: data.caption ? String(data.caption) : '',
          createdAt: data.createdAt ? String(data.createdAt) : '',
          _ms: typeof data.createdAtMs === 'number' ? data.createdAtMs : 0,
        });
      }
    });
    items.sort((a, b) => b._ms - a._ms);
    return items.map(({ _ms: _ignored, ...rest }) => rest);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function saveFeedbackToCloud(
  feedback: FeedbackScreenshot,
  ownerId: string
): Promise<void> {
  const path = `feedbacks/${feedback.id}`;
  try {
    const payload: CloudFeedbackDoc = {
      id: feedback.id,
      image: feedback.image.slice(0, 800000),
      customerName: (feedback.customerName || '').slice(0, 120),
      productName: (feedback.productName || '').slice(0, 160),
      caption: (feedback.caption || '').slice(0, 500),
      published: true,
      ownerId,
      createdAt: (feedback.createdAt || new Date().toLocaleDateString('en-US')).slice(0, 64),
      createdAtMs: Date.now(),
    };
    await setDoc(doc(db, 'feedbacks', feedback.id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteFeedbackFromCloud(id: string): Promise<void> {
  const path = `feedbacks/${id}`;
  try {
    await deleteDoc(doc(db, 'feedbacks', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ============================================================================
// Products & Inventory (Firestore 'products' collection)
// ============================================================================

function sanitizeProductForFirestore(product: Product): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    id: Number(product.id),
    active: true,
    name: String(product.name || 'Product').slice(0, 200),
    category: String(product.category || 'suits').slice(0, 100),
    price: Number(product.price || 0),
    sizes: (Array.isArray(product.sizes) && product.sizes.length > 0
      ? product.sizes
      : ['Free Size (55 - 90 KG)']
    ).slice(0, 20),
    variants: (Array.isArray(product.variants) ? product.variants : []).slice(0, 25).map((v) => {
      const cleanVariant: Record<string, unknown> = {
        colorName: String(v.colorName || 'Default'),
        hex: String(v.hex || '#121212'),
        image: String(v.image || ''),
      };
      if (v.colorNameAr !== undefined) cleanVariant.colorNameAr = String(v.colorNameAr);
      if (typeof v.stock === 'number' && Number.isFinite(v.stock)) cleanVariant.stock = v.stock;
      if (v.sizeStock && typeof v.sizeStock === 'object') cleanVariant.sizeStock = v.sizeStock;
      return cleanVariant;
    }),
    updatedAt: Date.now(),
  };

  if (product.nameAr) payload.nameAr = String(product.nameAr).slice(0, 200);
  if (product.badge !== undefined) payload.badge = String(product.badge).slice(0, 120);
  if (product.badgeAr !== undefined) payload.badgeAr = String(product.badgeAr).slice(0, 120);
  if (product.desc !== undefined) payload.desc = String(product.desc).slice(0, 2000);
  if (product.descAr !== undefined) payload.descAr = String(product.descAr).slice(0, 2000);
  if (product.fabric !== undefined) payload.fabric = String(product.fabric).slice(0, 400);
  if (product.fabricAr !== undefined) payload.fabricAr = String(product.fabricAr).slice(0, 400);
  if (typeof product.originalPrice === 'number' && Number.isFinite(product.originalPrice)) {
    payload.originalPrice = product.originalPrice;
  }
  if (Array.isArray(product.sizesAr)) payload.sizesAr = product.sizesAr.slice(0, 20);
  if (typeof product.isNewDrop === 'boolean') payload.isNewDrop = product.isNewDrop;
  if (typeof product.trackStock === 'boolean') payload.trackStock = product.trackStock;

  return payload;
}

export async function fetchActiveProductsFromCloud(): Promise<Product[]> {
  const path = 'products';
  try {
    const q = query(collection(db, path), where('active', '==', true));
    const snap = await getDocs(q);
    const items: Product[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data() as Product & { active?: boolean };
      if (typeof data.id === 'number' && Array.isArray(data.variants)) {
        items.push(data);
      }
    });
    items.sort((a, b) => a.id - b.id);
    return items;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function syncProductsToCloud(products: Product[]): Promise<void> {
  const path = 'products';
  try {
    const existingSnap = await getDocs(query(collection(db, path), where('active', '==', true)));
    const nextIds = new Set(products.map((p) => String(p.id)));
    const batch = writeBatch(db);

    existingSnap.forEach((docSnap) => {
      if (!nextIds.has(docSnap.id)) {
        batch.delete(docSnap.ref);
      }
    });

    for (const prod of products) {
      batch.set(doc(db, path, String(prod.id)), sanitizeProductForFirestore(prod));
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// ============================================================================
// Orders Backup (Firestore 'orders' collection, admin-only PII)
// ============================================================================

export async function fetchOrdersFromCloud(ownerId: string): Promise<PlacedOrder[]> {
  const path = 'orders';
  try {
    const q = query(collection(db, path), where('ownerId', '==', ownerId));
    const snap = await getDocs(q);
    const items: PlacedOrder[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data() as PlacedOrder;
      if (data.orderNumber) items.push(data);
    });
    return items;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function syncOrderToCloud(order: PlacedOrder, ownerId: string): Promise<void> {
  const path = `orders/${order.orderNumber}`;
  try {
    const payload: Record<string, unknown> = {
      orderNumber: order.orderNumber,
      customer: order.customer,
      items: order.items,
      total: Number(order.total || 0),
      date: String(order.date || '').slice(0, 64),
      status: order.status || 'pending',
      ownerId,
      updatedAt: Date.now(),
    };
    if (typeof order.subtotal === 'number') payload.subtotal = order.subtotal;
    if (typeof order.shippingCost === 'number') payload.shippingCost = order.shippingCost;
    if (order.deliveryTime) payload.deliveryTime = String(order.deliveryTime).slice(0, 120);
    if (typeof order.ownerNotified === 'boolean') payload.ownerNotified = order.ownerNotified;
    if (Array.isArray(order.notificationChannels)) {
      payload.notificationChannels = order.notificationChannels.slice(0, 10);
    }
    if (typeof order.stockDeducted === 'boolean') payload.stockDeducted = order.stockDeducted;

    await setDoc(doc(db, 'orders', order.orderNumber), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteOrderFromCloud(orderNumber: string): Promise<void> {
  const path = `orders/${orderNumber}`;
  try {
    await deleteDoc(doc(db, 'orders', orderNumber));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ============================================================================
// Store Settings & Telegram Credentials (Firestore 'settings/store', Admin-Only)
// ============================================================================

export async function fetchSettingsFromCloud(): Promise<StoreSettings | null> {
  const path = 'settings/store';
  try {
    const snap = await getDoc(doc(db, 'settings', 'store'));
    if (!snap.exists()) return null;
    const data = snap.data() as Partial<StoreSettings>;
    return {
      adminPhone: String(data.adminPhone || '201115010812'),
      instaHandle: String(data.instaHandle || '@she.store._eg'),
      adminPassword: data.adminPassword ? String(data.adminPassword) : 'shestore2026',
      telegramBotToken: String(data.telegramBotToken || ''),
      telegramChatId: String(data.telegramChatId || ''),
      callmebotPhone: String(data.callmebotPhone || '201115010812'),
      callmebotApiKey: String(data.callmebotApiKey || ''),
      textmebotApiKey: String(data.textmebotApiKey || ''),
      ultramsgInstanceId: String(data.ultramsgInstanceId || ''),
      ultramsgToken: String(data.ultramsgToken || ''),
      metaWhatsappPhoneId: String(data.metaWhatsappPhoneId || ''),
      metaWhatsappToken: String(data.metaWhatsappToken || ''),
      webhookUrl: String(data.webhookUrl || ''),
      ownerEmail: String(data.ownerEmail || ''),
      resendApiKey: String(data.resendApiKey || ''),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveSettingsToCloud(
  settings: StoreSettings,
  ownerId: string
): Promise<void> {
  const path = 'settings/store';
  try {
    const ref = doc(db, 'settings', 'store');
    let persistedOwnerId = ownerId;
    try {
      const existingSnap = await getDoc(ref);
      if (existingSnap.exists()) {
        const existingOwner = existingSnap.data()?.ownerId;
        if (typeof existingOwner === 'string' && existingOwner.trim()) {
          persistedOwnerId = existingOwner.trim();
        }
      }
    } catch {
      // proceed with caller uid
    }

    const payload = {
      adminPhone: String(settings.adminPhone || '201115010812').slice(0, 40),
      instaHandle: String(settings.instaHandle || '@she.store._eg').slice(0, 80),
      adminPassword: String(settings.adminPassword || 'shestore2026').slice(0, 120),
      telegramBotToken: String(settings.telegramBotToken || '').trim().slice(0, 200),
      telegramChatId: String(settings.telegramChatId || '').trim().slice(0, 300),
      callmebotPhone: String(settings.callmebotPhone || '201115010812').slice(0, 40),
      callmebotApiKey: String(settings.callmebotApiKey || '').trim().slice(0, 200),
      textmebotApiKey: String(settings.textmebotApiKey || '').trim().slice(0, 200),
      ultramsgInstanceId: String(settings.ultramsgInstanceId || '').trim().slice(0, 120),
      ultramsgToken: String(settings.ultramsgToken || '').trim().slice(0, 200),
      metaWhatsappPhoneId: String(settings.metaWhatsappPhoneId || '').trim().slice(0, 120),
      metaWhatsappToken: String(settings.metaWhatsappToken || '').trim().slice(0, 400),
      webhookUrl: String(settings.webhookUrl || '').trim().slice(0, 500),
      ownerEmail: String(settings.ownerEmail || '').trim().slice(0, 160),
      resendApiKey: String(settings.resendApiKey || '').trim().slice(0, 200),
      ownerId: persistedOwnerId,
      updatedAt: Date.now(),
    };
    await setDoc(ref, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
