import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { WASocket } from '@whiskeysockets/baileys';
import type { PlacedOrder, StoreSettings, FeedbackScreenshot, Product, CartItem } from './src/types.ts';
import { PRODUCTS as DEFAULT_PRODUCTS } from './src/data/products.ts';
import {
  LOW_STOCK_THRESHOLD,
  ensureProductInventory,
  findVariantIndexForItem,
  getVariantSizeStock,
  normalizeVariantInventory,
  resolveCanonicalSizeKey,
} from './src/utils/inventory.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const FEEDBACKS_FILE = path.join(DATA_DIR, 'feedbacks.json');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const FEEDBACK_UPLOADS_DIR = path.join(DATA_DIR, 'feedback_uploads');
const WA_AUTH_DIR = path.join(DATA_DIR, 'wa_auth');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(FEEDBACK_UPLOADS_DIR, { recursive: true });
fs.mkdirSync(WA_AUTH_DIR, { recursive: true });

process.on('unhandledRejection', (reason) => {
  console.error('[Server] Unhandled Rejection:', reason);
});

const DEFAULT_ORDERS: PlacedOrder[] = [
  {
    orderNumber: 'SHE-492108',
    customer: {
      name: 'Nouran El-Shazly',
      phone: '01098765432',
      governorate: 'Cairo (القاهرة)',
      address: 'Villa 14, Street 9, Maadi, Cairo',
      notes: 'Please call before arrival (after 2 PM)',
    },
    items: [
      {
        id: '1-0-Free Size (55 - 90 KG)',
        productId: 1,
        name: 'OVERSIZED BOMBER LEATHER JACKET',
        nameAr: 'جاكيت جلد بومبر واسع كلاسيك',
        color: 'Classic Black',
        colorAr: 'أسود كلاسيك',
        size: 'Free Size (55 - 90 KG)',
        price: 1300,
        quantity: 1,
        image: '/assets/aistudio/WhatsApp_Image_2026-11-12_at_5.52.27_PM_57062f15.jpeg',
      },
    ],
    subtotal: 1300,
    shippingCost: 45,
    deliveryTime: '24 - 48 Hours',
    total: 1345,
    date: 'Nov 12, 2026, 04:30 PM',
    status: 'pending',
    ownerNotified: true,
    notificationChannels: ['dashboard'],
  },
  {
    orderNumber: 'SHE-381042',
    customer: {
      name: 'Mariam Adel',
      phone: '01123456789',
      governorate: 'Giza (الجيزة)',
      address: '4th Touristic District, 6th of October City',
      notes: 'Deliver to building security if not answered',
    },
    items: [
      {
        id: '2-0-Free Size (55 - 90 KG)',
        productId: 2,
        name: 'OVERSIZED RIBBED KNIT SUIT',
        nameAr: 'سوت تريكو ريبد واسع عالي الكثافة',
        color: 'Olive Green',
        colorAr: 'زيتي زيتوني',
        size: 'Free Size (55 - 90 KG)',
        price: 1050,
        quantity: 1,
        image: '/assets/aistudio/WhatsApp_Image_2026-11-12_at_5.48.24_PM__2__e2d6586c.jpeg',
      },
    ],
    subtotal: 1050,
    shippingCost: 45,
    deliveryTime: '24 - 48 Hours',
    total: 1095,
    date: 'Nov 12, 2026, 02:15 PM',
    status: 'confirmed',
    ownerNotified: true,
    notificationChannels: ['dashboard'],
  },
];

function normalizeArabicDigits(input: string): string {
  return input
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

function extractValidPhoneDigits(raw?: string): string {
  const ascii = normalizeArabicDigits(raw || '');
  const digits = ascii.replace(/[^0-9]/g, '').replace(/^00/, '');
  if (!digits || digits.length < 10) return '';
  if (digits.length === 10 && digits.startsWith('1')) return `20${digits}`;
  return digits.startsWith('0') ? `2${digits}` : digits;
}

function getDefaultSettings(): StoreSettings {
  const defaultPhone = extractValidPhoneDigits(process.env.STORE_WHATSAPP_PHONE) || '201115010812';
  const defaultCallmebotPhone = extractValidPhoneDigits(process.env.CALLMEBOT_PHONE) || defaultPhone;
  return {
    adminPhone: defaultPhone,
    instaHandle: process.env.STORE_INSTA_HANDLE || '@she.store._eg',
    adminPassword: process.env.ADMIN_PASSWORD || 'shestore2026',
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
    telegramChatId: process.env.TELEGRAM_CHAT_ID || '',
    callmebotPhone: defaultCallmebotPhone,
    callmebotApiKey: process.env.CALLMEBOT_API_KEY || '',
    textmebotApiKey: process.env.TEXTMEBOT_API_KEY || '',
    ultramsgInstanceId: process.env.ULTRAMSG_INSTANCE_ID || '',
    ultramsgToken: process.env.ULTRAMSG_TOKEN || '',
    metaWhatsappPhoneId: process.env.META_WHATSAPP_PHONE_ID || '',
    metaWhatsappToken: process.env.META_WHATSAPP_TOKEN || '',
    webhookUrl: process.env.ORDER_WEBHOOK_URL || '',
    ownerEmail: process.env.OWNER_EMAIL || '',
    resendApiKey: process.env.RESEND_API_KEY || '',
  };
}

function readOrders(): PlacedOrder[] {
  try {
    if (fs.existsSync(ORDERS_FILE)) {
      const raw = fs.readFileSync(ORDERS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error('Failed to read orders file:', err);
  }
  writeOrders(DEFAULT_ORDERS);
  return DEFAULT_ORDERS;
}

function writeOrders(orders: PlacedOrder[]): void {
  try {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write orders file:', err);
  }
}

function readSettings(): StoreSettings {
  const defaults = getDefaultSettings();
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return { ...defaults, ...parsed };
    }
  } catch (err) {
    console.error('Failed to read settings file:', err);
  }
  return defaults;
}

function writeSettings(settings: StoreSettings): void {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write settings file:', err);
  }
}

function readFeedbacks(): FeedbackScreenshot[] {
  try {
    if (fs.existsSync(FEEDBACKS_FILE)) {
      const raw = fs.readFileSync(FEEDBACKS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error('Failed to read feedbacks file:', err);
  }
  return [];
}

function writeFeedbacks(feedbacks: FeedbackScreenshot[]): void {
  try {
    fs.writeFileSync(FEEDBACKS_FILE, JSON.stringify(feedbacks, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write feedbacks file:', err);
  }
}

function readProducts(): Product[] {
  try {
    if (fs.existsSync(PRODUCTS_FILE)) {
      const raw = fs.readFileSync(PRODUCTS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((p) => (p.trackStock === false ? p : ensureProductInventory(p)));
      }
    }
  } catch (err) {
    console.error('Failed to read products file:', err);
  }
  const seeded = DEFAULT_PRODUCTS.map((p) => ensureProductInventory(p));
  writeProducts(seeded);
  return seeded;
}

function writeProducts(products: Product[]): void {
  try {
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write products file:', err);
  }
}

function applyInventoryForOrder(
  items: CartItem[],
  direction: 'deduct' | 'restore'
): { ok: true; products: Product[]; lowStockAlerts: string[] } | { ok: false; error: string } {
  const products: Product[] = readProducts().map((p) => ({
    ...p,
    variants: p.variants.map((v) => ({
      ...v,
      sizeStock: v.sizeStock ? { ...v.sizeStock } : undefined,
    })),
  }));

  if (direction === 'deduct') {
    // Check aggregate requested quantity per (productId, variantIdx, canonicalSize)
    const demandMap = new Map<string, { product: Product; variantIdx: number; sizeKey: string; qty: number; label: string }>();
    for (const item of items) {
      const prod = products.find((p) => p.id === Number(item.productId));
      if (!prod || prod.trackStock === false) continue;
      const vIdx = findVariantIndexForItem(prod, item);
      const sizeKey = resolveCanonicalSizeKey(prod, item.sizeAr || item.size);
      const key = `${prod.id}::${vIdx}::${sizeKey}`;
      const requested = Math.max(1, Number(item.quantity || 1));
      const existing = demandMap.get(key);
      if (existing) {
        existing.qty += requested;
      } else {
        const title = prod.nameAr || prod.name;
        const color = prod.variants[vIdx]?.colorNameAr || prod.variants[vIdx]?.colorName || item.color;
        demandMap.set(key, {
          product: prod,
          variantIdx: vIdx,
          sizeKey,
          qty: requested,
          label: `${title} (${color} - ${sizeKey})`,
        });
      }
    }

    for (const entry of demandMap.values()) {
      const avail = getVariantSizeStock(entry.product, entry.variantIdx, entry.sizeKey);
      if (avail !== null && entry.qty > avail) {
        return {
          ok: false,
          error:
            avail <= 0
              ? `عفواً، نفذت الكمية حالياً من: ${entry.label}`
              : `عفواً، المتوفر حالياً من ${entry.label} هو ${avail} قطعة فقط`,
        };
      }
    }
  }

  const lowStockAlerts: string[] = [];
  const alertedKeys = new Set<string>();

  for (const item of items) {
    const prodIdx = products.findIndex((p) => p.id === Number(item.productId));
    if (prodIdx === -1) continue;
    const prod = products[prodIdx];
    if (prod.trackStock === false) continue;

    const vIdx = findVariantIndexForItem(prod, item);
    const variant = prod.variants[vIdx];
    if (!variant) continue;

    const qty = Math.max(1, Number(item.quantity || 1));
    const delta = direction === 'deduct' ? -qty : qty;
    const sizeKey = resolveCanonicalSizeKey(prod, item.sizeAr || item.size);

    if (variant.sizeStock && typeof variant.sizeStock === 'object') {
      const current = typeof variant.sizeStock[sizeKey] === 'number' ? variant.sizeStock[sizeKey] : (typeof variant.stock === 'number' ? variant.stock : 0);
      const nextVal = Math.max(0, current + delta);
      variant.sizeStock[sizeKey] = nextVal;
      const normalized = normalizeVariantInventory(variant, prod.sizes);
      prod.variants[vIdx] = normalized;

      if (direction === 'deduct' && nextVal <= LOW_STOCK_THRESHOLD) {
        const alertKey = `${prod.id}-${vIdx}-${sizeKey}`;
        if (!alertedKeys.has(alertKey)) {
          alertedKeys.add(alertKey);
          const pName = prod.nameAr || prod.name;
          const vColor = variant.colorNameAr || variant.colorName;
          lowStockAlerts.push(
            nextVal === 0
              ? `🔴 *نفذت الكمية:* ${pName} (${vColor} / ${sizeKey})`
              : `⚠️ *مخزون منخفض:* ${pName} (${vColor} / ${sizeKey}) — متبقي ${nextVal} فقط`
          );
        }
      }
    } else if (typeof variant.stock === 'number') {
      const nextVal = Math.max(0, variant.stock + delta);
      variant.stock = nextVal;
      if (direction === 'deduct' && nextVal <= LOW_STOCK_THRESHOLD) {
        const alertKey = `${prod.id}-${vIdx}`;
        if (!alertedKeys.has(alertKey)) {
          alertedKeys.add(alertKey);
          const pName = prod.nameAr || prod.name;
          const vColor = variant.colorNameAr || variant.colorName;
          lowStockAlerts.push(
            nextVal === 0
              ? `🔴 *نفذت الكمية:* ${pName} (${vColor})`
              : `⚠️ *مخزون منخفض:* ${pName} (${vColor}) — متبقي ${nextVal} فقط`
          );
        }
      }
    }
  }

  writeProducts(products);
  return { ok: true, products, lowStockAlerts };
}

function normalizeEgyptPhone(rawPhone: string): string {
  return extractValidPhoneDigits(rawPhone) || '201115010812';
}

// =========================================================================
// Direct WhatsApp Web Session Manager (QR Code & Phone Pairing Code)
// =========================================================================
type WaStatus = 'disconnected' | 'connecting' | 'qr' | 'connected';

interface WaState {
  status: WaStatus;
  qrDataUrl: string | null;
  pairingCode: string | null;
  connectedPhone: string | null;
  connectedName: string | null;
  lastError: string | null;
}

let waSock: WASocket | null = null;
let waReconnectTimer: ReturnType<typeof setTimeout> | null = null;
let waStarting = false;
let waPairingMode = false;
let waQrReadyResolvers: Array<() => void> = [];

const waState: WaState = {
  status: 'disconnected',
  qrDataUrl: null,
  pairingCode: null,
  connectedPhone: null,
  connectedName: null,
  lastError: null,
};

function notifyQrReady() {
  const pending = waQrReadyResolvers;
  waQrReadyResolvers = [];
  pending.forEach((resolve) => resolve());
}

function waitForQrReady(timeoutMs = 10000): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(false);
      }
    }, timeoutMs);

    waQrReadyResolvers.push(() => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(true);
      }
    });
  });
}

function hasRegisteredCreds(): boolean {
  try {
    const credsPath = path.join(WA_AUTH_DIR, 'creds.json');
    if (!fs.existsSync(credsPath)) return false;
    const raw = fs.readFileSync(credsPath, 'utf-8');
    const parsed = JSON.parse(raw);
    return Boolean(parsed?.registered === true && parsed?.me?.id);
  } catch {
    return false;
  }
}

function clearWaAuthDir() {
  try {
    if (fs.existsSync(WA_AUTH_DIR)) {
      fs.rmSync(WA_AUTH_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(WA_AUTH_DIR, { recursive: true });
  } catch (err) {
    console.error('[WhatsApp] Error clearing auth dir:', err);
  }
}

async function startWhatsAppSocket(forceNew = false): Promise<void> {
  if (waStarting) return;
  waStarting = true;

  if (waReconnectTimer) {
    clearTimeout(waReconnectTimer);
    waReconnectTimer = null;
  }

  try {
    if (forceNew && waSock) {
      try {
        waSock.end(undefined);
      } catch {
        // ignore
      }
      waSock = null;
    }

    waState.status = 'connecting';
    waState.lastError = null;
    waState.qrDataUrl = null;

    const [baileys, pinoMod, qrMod] = await Promise.all([
      import('@whiskeysockets/baileys'),
      import('pino'),
      import('qrcode'),
    ]);
    const {
      default: makeWASocket,
      useMultiFileAuthState,
      makeCacheableSignalKeyStore,
      Browsers,
      DisconnectReason,
      fetchLatestBaileysVersion,
      jidNormalizedUser,
    } = baileys;
    const pino = pinoMod.default;
    const QRCode = qrMod.default;

    const { state, saveCreds } = await useMultiFileAuthState(WA_AUTH_DIR);
    let versionTuple: [number, number, number] | undefined;
    try {
      const latest = await fetchLatestBaileysVersion();
      versionTuple = latest.version;
    } catch {
      versionTuple = undefined;
    }

    const waLogger = pino({ level: 'warn' });
    const sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, waLogger),
      },
      version: versionTuple,
      logger: waLogger,
      printQRInTerminal: false,
      browser: Browsers.macOS('Chrome'),
      syncFullHistory: false,
      markOnlineOnConnect: false,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 25000,
      keepAliveIntervalMs: 25000,
      qrTimeout: 60000,
      getMessage: async () => undefined,
    });

    waSock = sock;

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        notifyQrReady();
        if (!waPairingMode) {
          try {
            waState.qrDataUrl = await QRCode.toDataURL(qr, { width: 280, margin: 2 });
            waState.status = 'qr';
            waState.lastError = null;
          } catch (err) {
            console.error('[WhatsApp] QR generation error:', err);
          }
        }
      }

      if (connection === 'open') {
        notifyQrReady();
        waPairingMode = false;
        waState.status = 'connected';
        waState.qrDataUrl = null;
        waState.pairingCode = null;
        waState.lastError = null;
        const rawId = sock.user?.id ? jidNormalizedUser(sock.user.id) : '';
        waState.connectedPhone = rawId ? rawId.split('@')[0] : null;
        waState.connectedName = sock.user?.name || 'WhatsApp Connected';
        console.log(`[WhatsApp] Connected directly as ${waState.connectedPhone} (${waState.connectedName})`);
      }

      if (connection === 'close') {
        notifyQrReady();
        const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)?.output?.statusCode;
        const errMessage = (lastDisconnect?.error as Error | undefined)?.message || 'Connection closed';
        const isLoggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401;
        const isRestartRequired = statusCode === DisconnectReason.restartRequired || statusCode === 515;
        const isRegistered = hasRegisteredCreds();

        waSock = null;
        waState.status = 'disconnected';
        waState.qrDataUrl = null;
        waState.connectedPhone = null;
        waState.connectedName = null;

        if (isLoggedOut) {
          console.log('[WhatsApp] Logged out — clearing session');
          waPairingMode = false;
          waState.pairingCode = null;
          clearWaAuthDir();
          waState.lastError = 'تم تسجيل الخروج من واتساب. أعيدي الربط مرة أخرى.';
        } else if (isRestartRequired || isRegistered) {
          waPairingMode = false;
          waState.status = 'connecting';
          waState.lastError = null;
          waReconnectTimer = setTimeout(() => {
            startWhatsAppSocket(false).catch(() => {});
          }, isRestartRequired ? 400 : 3000);
        } else {
          waPairingMode = false;
          waState.pairingCode = null;
          clearWaAuthDir();
          waState.lastError =
            statusCode === 408
              ? 'انتهت مهلة كود الربط (60 ثانية) — اضغطي لاستخراج كود جديد أو امسحي QR Code.'
              : errMessage;
        }
      }
    });
  } catch (err) {
    notifyQrReady();
    waState.status = 'disconnected';
    waState.lastError = String((err as Error)?.message || err);
    console.error('[WhatsApp] Failed to start socket:', err);
  } finally {
    waStarting = false;
  }
}

async function sendDirectWhatsAppMessage(targetPhone: string, text: string): Promise<void> {
  if (!waSock || waState.status !== 'connected') {
    throw new Error(`WhatsApp direct session is not connected yet (status=${waState.status})`);
  }
  const normalized = normalizeEgyptPhone(targetPhone);
  const targetJid = `${normalized}@s.whatsapp.net`;
  const t0 = Date.now();
  const result = await waSock.sendMessage(targetJid, { text, linkPreview: null });
  console.log(`[WhatsApp] Message sent in ${Date.now() - t0}ms to ${targetJid} (id=${result?.key?.id})`);
}

function initWhatsAppOnStartup() {
  if (hasRegisteredCreds()) {
    startWhatsAppSocket(false).catch((err) => {
      console.error('[WhatsApp] Auto-resume failed:', err);
    });
  } else {
    clearWaAuthDir();
  }
}

function buildOwnerOrderText(order: PlacedOrder, lowStockAlerts: string[] = []): string {
  const cleanCustomerWa = extractValidPhoneDigits(order.customer.phone);
  const lines: string[] = [
    `🛍️ *طلب جديد من موقع SHE STORE EG* ✨`,
    `رقم الطلب: *#${order.orderNumber}*`,
    `التاريخ: ${order.date}`,
    `────────────────────`,
    `👤 *بيانات العميل والتوصيل:*`,
    `• الاسم: ${order.customer.name}`,
    `• الموبايل: ${order.customer.phone}`,
    ...(cleanCustomerWa ? [`• واتساب العميل: https://wa.me/${cleanCustomerWa}`] : []),
    `• المحافظة: ${order.customer.governorate}`,
    `• العنوان: ${order.customer.address}`,
  ];

  if (order.customer.notes) {
    lines.push(`• ملاحظات العميل: ${order.customer.notes}`);
  }
  if (order.deliveryTime) {
    lines.push(`• مدة التوصيل المتوقعة: ${order.deliveryTime}`);
  }

  lines.push(`────────────────────`);
  lines.push(`👗 *القطع المطلوبة (${order.items.reduce((s, i) => s + Number(i.quantity || 1), 0)} قطعة):*`);

  order.items.forEach((item, index) => {
    const title = item.nameAr || item.name;
    const color = item.colorAr || item.color;
    const size = item.sizeAr || item.size;
    const qty = Number(item.quantity || 1);
    const lineTotal = Number(item.price || 0) * qty;
    lines.push(
      `${index + 1}. *${title}*`,
      `   • اللون: ${color} | المقاس: ${size}`,
      `   • الكمية: ${qty} × ${item.price} ج.م = *${lineTotal} ج.م*`
    );
  });

  lines.push(`────────────────────`);
  if (typeof order.subtotal === 'number') {
    lines.push(`💵 إجمالي المنتجات: ${order.subtotal} ج.م`);
  }
  if (typeof order.shippingCost === 'number') {
    lines.push(`🚚 مصاريف الشحن: ${order.shippingCost} ج.م`);
  }
  lines.push(`💰 *الإجمالي المستحق عند الاستلام: ${order.total} ج.م*`);
  lines.push(`✨ الدفع كاش عند الاستلام مع المعاينة قبل الدفع`);

  if (lowStockAlerts.length > 0) {
    lines.push(`────────────────────`);
    lines.push(`📦 *تنبيهات المخزون بعد الطلب:*`);
    lowStockAlerts.forEach((alert) => lines.push(alert));
  }

  return lines.join('\n');
}

function buildOwnerOrderHtml(order: PlacedOrder): string {
  const itemsRows = order.items
    .map(
      (item) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee;">${item.nameAr || item.name}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${item.colorAr || item.color}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${item.sizeAr || item.size}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${item.quantity}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">${item.price * item.quantity} ج.م</td>
      </tr>`
    )
    .join('');

  return `
    <div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #ddd;padding:20px;background:#faf7f2;">
      <h2 style="margin:0 0 8px;">🛍️ طلب جديد من موقع SHE STORE EG</h2>
      <p style="margin:0 0 16px;color:#555;">كود الطلب: <strong>#${order.orderNumber}</strong> — ${order.date}</p>
      <div style="background:#fff;padding:14px;border:1px solid #e5e5e5;margin-bottom:16px;">
        <h3 style="margin:0 0 8px;font-size:14px;">بيانات العميل والتوصيل</h3>
        <p style="margin:4px 0;"><strong>الاسم:</strong> ${order.customer.name}</p>
        <p style="margin:4px 0;"><strong>الموبايل:</strong> ${order.customer.phone}</p>
        <p style="margin:4px 0;"><strong>المحافظة:</strong> ${order.customer.governorate}</p>
        <p style="margin:4px 0;"><strong>العنوان:</strong> ${order.customer.address}</p>
        ${order.customer.notes ? `<p style="margin:4px 0;"><strong>ملاحظات:</strong> ${order.customer.notes}</p>` : ''}
      </div>
      <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e5e5e5;font-size:13px;">
        <thead>
          <tr style="background:#111;color:#fff;text-align:right;">
            <th style="padding:8px;">القطعة</th>
            <th style="padding:8px;">اللون</th>
            <th style="padding:8px;">المقاس</th>
            <th style="padding:8px;">الكمية</th>
            <th style="padding:8px;">السعر</th>
          </tr>
        </thead>
        <tbody>${itemsRows}</tbody>
      </table>
      <div style="margin-top:16px;padding:12px;background:#fff;border:1px solid #e5e5e5;">
        ${typeof order.subtotal === 'number' ? `<p style="margin:4px 0;">إجمالي المنتجات: <strong>${order.subtotal} ج.م</strong></p>` : ''}
        ${typeof order.shippingCost === 'number' ? `<p style="margin:4px 0;">الشحن: <strong>${order.shippingCost} ج.م</strong></p>` : ''}
        <p style="margin:6px 0 0;font-size:16px;">الإجمالي المستحق عند الاستلام: <strong>${order.total} ج.م</strong></p>
      </div>
    </div>
  `;
}

interface NotificationReport {
  sentChannels: string[];
  failedChannels: Array<{ channel: string; error: string }>;
}

async function dispatchOwnerNotifications(
  order: PlacedOrder,
  settings: StoreSettings,
  lowStockAlerts: string[] = []
): Promise<NotificationReport> {
  const sentChannels: string[] = ['dashboard'];
  const failedChannels: Array<{ channel: string; error: string }> = [];
  const messageText = buildOwnerOrderText(order, lowStockAlerts);

  const tasks: Array<Promise<void>> = [];

  // 0. Direct WhatsApp Web Link (Baileys QR / Pairing Code)
  if (waSock && waState.status === 'connected') {
    const target =
      extractValidPhoneDigits(settings.adminPhone) ||
      extractValidPhoneDigits(waState.connectedPhone || '') ||
      '201115010812';
    tasks.push(
      sendDirectWhatsAppMessage(target, messageText)
        .then(() => {
          sentChannels.push('whatsapp_direct');
        })
        .catch((err) => {
          failedChannels.push({ channel: 'whatsapp_direct', error: String(err?.message || err) });
        })
    );
  }

  // 1. Telegram Bot API (Instant push to owner/team phones; supports comma-separated Chat IDs)
  if (settings.telegramBotToken?.trim() && settings.telegramChatId?.trim()) {
    const botToken = settings.telegramBotToken.trim();
    const chatIds = Array.from(
      new Set(
        settings.telegramChatId
          .split(/[\s,]+/)
          .map((id) => id.trim())
          .filter(Boolean)
      )
    );
    if (chatIds.length > 0) {
      tasks.push(
        (async () => {
          const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
          const results = await Promise.all(
            chatIds.map(async (chatId) => {
              const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: chatId,
                  text: messageText,
                }),
              });
              if (!res.ok) {
                const errText = await res.text();
                return `(${chatId}) HTTP ${res.status}: ${errText}`;
              }
              return null;
            })
          );
          const errors = results.filter(Boolean) as string[];
          if (errors.length === chatIds.length) {
            throw new Error(errors.join(' | '));
          }
          sentChannels.push('telegram');
          if (errors.length > 0) {
            failedChannels.push({ channel: 'telegram_partial', error: errors.join(' | ') });
          }
        })().catch((err) => {
          failedChannels.push({ channel: 'telegram', error: String(err?.message || err) });
        })
      );
    }
  }

  // 2. WhatsApp Bot via CallMeBot
  const normalizedWaPhone = normalizeEgyptPhone(settings.callmebotPhone || settings.adminPhone || '201115010812');
  const callmebotKey = settings.callmebotApiKey?.trim();
  if (normalizedWaPhone && callmebotKey) {
    tasks.push(
      (async () => {
        const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(
          normalizedWaPhone
        )}&text=${encodeURIComponent(messageText)}&apikey=${encodeURIComponent(callmebotKey)}`;
        const res = await fetch(url);
        const bodyText = await res.text();
        if (!res.ok || /error|wrong|not\s+activated|invalid/i.test(bodyText)) {
          throw new Error(`HTTP ${res.status}: ${bodyText}`);
        }
        sentChannels.push('whatsapp_callmebot');
      })().catch((err) => {
        failedChannels.push({ channel: 'whatsapp_callmebot', error: String(err?.message || err) });
      })
    );
  }

  // 2b. WhatsApp via TextMeBot
  const textmebotKey = settings.textmebotApiKey?.trim();
  if (normalizedWaPhone && textmebotKey) {
    tasks.push(
      (async () => {
        const url = `https://api.textmebot.com/send.php?recipient=${encodeURIComponent(
          `+${normalizedWaPhone}`
        )}&apikey=${encodeURIComponent(textmebotKey)}&text=${encodeURIComponent(
          messageText
        )}`;
        const res = await fetch(url);
        const bodyText = await res.text();
        if (!res.ok || /error|invalid|failed/i.test(bodyText)) {
          throw new Error(`HTTP ${res.status}: ${bodyText}`);
        }
        sentChannels.push('whatsapp_textmebot');
      })().catch((err) => {
        failedChannels.push({ channel: 'whatsapp_textmebot', error: String(err?.message || err) });
      })
    );
  }

  // 2c. WhatsApp via UltraMsg
  const ultramsgInstance = settings.ultramsgInstanceId?.trim();
  const ultramsgSecret = settings.ultramsgToken?.trim();
  if (normalizedWaPhone && ultramsgInstance && ultramsgSecret) {
    tasks.push(
      (async () => {
        const url = `https://api.ultramsg.com/${encodeURIComponent(ultramsgInstance)}/messages/chat`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: ultramsgSecret,
            to: `+${normalizedWaPhone}`,
            body: messageText,
          }),
        });
        const bodyText = await res.text();
        if (!res.ok || /"error"/i.test(bodyText)) {
          throw new Error(`HTTP ${res.status}: ${bodyText}`);
        }
        sentChannels.push('whatsapp_ultramsg');
      })().catch((err) => {
        failedChannels.push({ channel: 'whatsapp_ultramsg', error: String(err?.message || err) });
      })
    );
  }

  // 2d. Official Meta WhatsApp Cloud API
  const metaPhoneId = settings.metaWhatsappPhoneId?.trim();
  const metaToken = settings.metaWhatsappToken?.trim();
  if (normalizedWaPhone && metaPhoneId && metaToken) {
    tasks.push(
      (async () => {
        const url = `https://graph.facebook.com/v21.0/${encodeURIComponent(metaPhoneId)}/messages`;
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${metaToken}`,
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: normalizedWaPhone,
            type: 'text',
            text: { body: messageText },
          }),
        });
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`HTTP ${res.status}: ${errText}`);
        }
        sentChannels.push('whatsapp_meta');
      })().catch((err) => {
        failedChannels.push({ channel: 'whatsapp_meta', error: String(err?.message || err) });
      })
    );
  }

  // 3. Generic Webhook (Discord, Slack, Make, Zapier, n8n, custom WhatsApp API)
  const webhookTarget = settings.webhookUrl?.trim();
  if (webhookTarget) {
    tasks.push(
      (async () => {
        const res = await fetch(webhookTarget, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: messageText,
            text: messageText,
            event: 'new_order',
            store: 'SHE STORE EG',
            order,
          }),
        });
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`HTTP ${res.status}: ${errText}`);
        }
        sentChannels.push('webhook');
      })().catch((err) => {
        failedChannels.push({ channel: 'webhook', error: String(err?.message || err) });
      })
    );
  }

  // 4. Email via Resend API
  const resendKey = settings.resendApiKey?.trim();
  const emailTo = settings.ownerEmail?.trim();
  if (resendKey && emailTo) {
    tasks.push(
      (async () => {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${resendKey}`,
          },
          body: JSON.stringify({
            from: 'SHE STORE Orders <onboarding@resend.dev>',
            to: [emailTo],
            subject: `🛍️ طلب جديد #${order.orderNumber} — ${order.customer.name} (${order.total} ج.م)`,
            html: buildOwnerOrderHtml(order),
            text: messageText,
          }),
        });
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`HTTP ${res.status}: ${errText}`);
        }
        sentChannels.push('email');
      })().catch((err) => {
        failedChannels.push({ channel: 'email', error: String(err?.message || err) });
      })
    );
  }

  await Promise.allSettled(tasks);

  if (failedChannels.length > 0) {
    console.warn(`[Order #${order.orderNumber}] Notification failures:`, failedChannels);
  }
  console.log(
    `[Order #${order.orderNumber}] Received & dispatched automatically via: ${sentChannels.join(', ')}`
  );

  return { sentChannels, failedChannels };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, whatsapp: waState.status });
  });

  // =========================================================================
  // Direct WhatsApp Connection API Routes (QR + 8-Digit Pairing Code)
  // =========================================================================
  app.get('/api/whatsapp/status', (_req, res) => {
    res.json({
      status: waState.status,
      qrDataUrl: waState.qrDataUrl,
      pairingCode: waState.pairingCode,
      connectedPhone: waState.connectedPhone,
      connectedName: waState.connectedName,
      lastError: waState.lastError,
    });
  });

  app.post('/api/whatsapp/connect', async (_req, res) => {
    try {
      waPairingMode = false;
      waState.pairingCode = null;
      await startWhatsAppSocket(true);
      // Give Baileys up to 2.5s to emit initial QR or connect
      for (let i = 0; i < 10; i++) {
        if (waState.qrDataUrl || waState.status === 'connected') break;
        await new Promise((r) => setTimeout(r, 250));
      }
      res.json({
        ok: true,
        status: waState.status,
        qrDataUrl: waState.qrDataUrl,
        connectedPhone: waState.connectedPhone,
        lastError: waState.lastError,
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error)?.message || err) });
    }
  });

  app.post('/api/whatsapp/pairing-code', async (req, res) => {
    try {
      const rawPhone = String(req.body?.phone || '201080134199');
      const normalized = extractValidPhoneDigits(rawPhone);
      if (!normalized || normalized.length < 11) {
        res.status(400).json({ ok: false, error: 'رقم الهاتف غير صحيح. اكتبي الرقم بالصيغة المصرية مثل 01080134199' });
        return;
      }

      waPairingMode = true;
      waState.qrDataUrl = null;
      waState.pairingCode = null;
      waState.lastError = null;
      clearWaAuthDir();

      const qrReadyPromise = waitForQrReady(10000);
      await startWhatsAppSocket(true);
      await qrReadyPromise;
      await new Promise((r) => setTimeout(r, 200));

      if (!waSock) {
        waPairingMode = false;
        res.status(500).json({ ok: false, error: 'تعذر تهيئة اتصال واتساب — حاولي مرة أخرى' });
        return;
      }

      const code = await waSock.requestPairingCode(normalized);
      const formattedCode = code.match(/.{1,4}/g)?.join('-') || code;
      waState.pairingCode = formattedCode;
      waState.qrDataUrl = null;
      res.json({ ok: true, pairingCode: formattedCode, rawCode: code, phone: normalized });
    } catch (err) {
      waPairingMode = false;
      const msg = String((err as Error)?.message || err);
      waState.lastError = msg;
      res.status(500).json({ ok: false, error: msg });
    }
  });

  app.post('/api/whatsapp/disconnect', async (_req, res) => {
    try {
      waPairingMode = false;
      if (waSock) {
        try {
          await waSock.logout();
        } catch {
          try {
            waSock.end(undefined);
          } catch {
            // ignore
          }
        }
        waSock = null;
      }
      clearWaAuthDir();
      waState.status = 'disconnected';
      waState.qrDataUrl = null;
      waState.pairingCode = null;
      waState.connectedPhone = null;
      waState.connectedName = null;
      waState.lastError = null;
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error)?.message || err) });
    }
  });

  // =========================================================================
  // Products & Inventory API
  // =========================================================================
  app.get('/api/products', (_req, res) => {
    res.json({ products: readProducts() });
  });

  app.put('/api/products', (req, res) => {
    try {
      const incoming = req.body?.products;
      if (!Array.isArray(incoming)) {
        res.status(400).json({ ok: false, error: 'products array is required' });
        return;
      }
      const normalized = incoming.map((p: Product) =>
        p.trackStock === false ? p : ensureProductInventory(p)
      );
      writeProducts(normalized);
      res.json({ ok: true, products: normalized });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error)?.message || err) });
    }
  });

  app.patch('/api/products/:id/stock', (req, res) => {
    try {
      const productId = Number(req.params.id);
      const { variantIndex, size, qty, delta, trackStock, sizeStock } = req.body || {};
      const products = readProducts();
      const idx = products.findIndex((p) => p.id === productId);
      if (idx === -1) {
        res.status(404).json({ ok: false, error: 'Product not found' });
        return;
      }

      const product = { ...products[idx], variants: [...products[idx].variants] };

      if (typeof trackStock === 'boolean') {
        product.trackStock = trackStock;
        if (trackStock) {
          const initialized = ensureProductInventory(product);
          product.variants = initialized.variants;
        }
      }

      if (typeof variantIndex === 'number' && product.variants[variantIndex]) {
        const variant = {
          ...product.variants[variantIndex],
          sizeStock: product.variants[variantIndex].sizeStock
            ? { ...product.variants[variantIndex].sizeStock }
            : {},
        };

        if (sizeStock && typeof sizeStock === 'object') {
          for (const [k, v] of Object.entries(sizeStock)) {
            if (typeof v === 'number' && Number.isFinite(v)) {
              variant.sizeStock[k] = Math.max(0, Math.floor(v));
            }
          }
        } else if (typeof size === 'string' && size.trim()) {
          const sizeKey = resolveCanonicalSizeKey(product, size);
          const current = typeof variant.sizeStock[sizeKey] === 'number' ? variant.sizeStock[sizeKey] : (variant.stock ?? 0);
          const next =
            typeof qty === 'number' && Number.isFinite(qty)
              ? Math.max(0, Math.floor(qty))
              : Math.max(0, current + Number(delta || 0));
          variant.sizeStock[sizeKey] = next;
        } else if (typeof qty === 'number' || typeof delta === 'number') {
          const targetVal = typeof qty === 'number' ? Math.max(0, Math.floor(qty)) : undefined;
          const sizes = product.sizes.length > 0 ? product.sizes : ['Free Size (55 - 90 KG)'];
          for (const s of sizes) {
            const cur = typeof variant.sizeStock[s] === 'number' ? variant.sizeStock[s] : 0;
            variant.sizeStock[s] = targetVal !== undefined ? targetVal : Math.max(0, cur + Number(delta || 0));
          }
        }

        product.variants[variantIndex] = normalizeVariantInventory(variant, product.sizes);
      }

      products[idx] = product;
      writeProducts(products);
      res.json({ ok: true, product, products });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error)?.message || err) });
    }
  });

  // =========================================================================
  // Orders API
  // =========================================================================
  app.get('/api/orders', (_req, res) => {
    const orders = readOrders();
    res.json({ orders });
  });

  app.post('/api/orders', async (req, res) => {
    try {
      const body = req.body || {};
      const customer = body.customer || {};
      const items = Array.isArray(body.items) ? body.items : [];

      if (
        !customer.name?.trim() ||
        !customer.phone?.trim() ||
        !customer.governorate?.trim() ||
        !customer.address?.trim() ||
        items.length === 0
      ) {
        res.status(400).json({ error: 'Missing required customer details or order items.' });
        return;
      }

      // Check and deduct stock atomically before recording order
      const stockResult = applyInventoryForOrder(items, 'deduct');
      if (stockResult.ok === false) {
        res.status(400).json({ error: stockResult.error, code: 'OUT_OF_STOCK' });
        return;
      }

      const subtotal = items.reduce(
        (sum: number, item: { price?: number; quantity?: number }) =>
          sum + Number(item.price || 0) * Number(item.quantity || 1),
        0
      );
      const shippingCost = Number(body.shippingCost || 0);
      const total = Number(body.total || subtotal + shippingCost);
      const orderNumber =
        typeof body.orderNumber === 'string' && body.orderNumber.trim()
          ? body.orderNumber.trim()
          : `SHE-${Math.floor(100000 + Math.random() * 900000)}`;

      const newOrder: PlacedOrder = {
        orderNumber,
        customer: {
          name: String(customer.name).trim(),
          phone: String(customer.phone).trim(),
          governorate: String(customer.governorate).trim(),
          address: String(customer.address).trim(),
          notes: String(customer.notes || '').trim(),
        },
        items,
        subtotal,
        shippingCost,
        deliveryTime: body.deliveryTime ? String(body.deliveryTime) : undefined,
        total,
        date:
          typeof body.date === 'string' && body.date.trim()
            ? body.date.trim()
            : new Date().toLocaleString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              }),
        status: 'pending',
        ownerNotified: true,
        notificationChannels: ['dashboard'],
        stockDeducted: true,
      };

      // Save order immediately so checkout never feels slow
      const existing = readOrders();
      writeOrders([newOrder, ...existing]);

      const settings = readSettings();
      const notifyPromise = dispatchOwnerNotifications(newOrder, settings, stockResult.lowStockAlerts).then((report) => {
        newOrder.notificationChannels = report.sentChannels;
        newOrder.ownerNotified = report.sentChannels.length > 0;
        const latest = readOrders();
        const patched = latest.map((o) =>
          o.orderNumber === newOrder.orderNumber
            ? { ...o, notificationChannels: report.sentChannels, ownerNotified: report.sentChannels.length > 0 }
            : o
        );
        writeOrders(patched);
        return report;
      });

      // Wait briefly (up to 1.2s; direct WhatsApp normally completes in ~20ms), then respond immediately
      const notificationReport = await Promise.race([
        notifyPromise,
        new Promise<{ sentChannels: string[]; failedChannels: Array<{ channel: string; error: string }> }>((resolve) =>
          setTimeout(() => resolve({ sentChannels: ['dashboard'], failedChannels: [] }), 1200)
        ),
      ]);

      res.status(201).json({
        ok: true,
        order: newOrder,
        products: stockResult.products,
        lowStockAlerts: stockResult.lowStockAlerts,
        notificationReport,
      });
    } catch (err) {
      console.error('Error creating order:', err);
      res.status(500).json({ error: 'Failed to place order.' });
    }
  });

  app.patch('/api/orders/:orderNumber', (req, res) => {
    const { orderNumber } = req.params;
    const { status } = req.body || {};
    const orders = readOrders();
    let found = false;
    let updatedProducts: Product[] | undefined;

    const updated = orders.map((o) => {
      if (o.orderNumber === orderNumber) {
        found = true;
        const prevStatus = o.status || 'pending';
        let nextStockDeducted = o.stockDeducted;

        // Restore stock when transitioning to cancelled
        if (status === 'cancelled' && prevStatus !== 'cancelled' && o.stockDeducted !== false) {
          const restored = applyInventoryForOrder(o.items, 'restore');
          if (restored.ok) {
            updatedProducts = restored.products;
            nextStockDeducted = false;
          }
        } else if (status && status !== 'cancelled' && prevStatus === 'cancelled' && o.stockDeducted === false) {
          // Re-deduct if reactivating a cancelled order
          const reDeducted = applyInventoryForOrder(o.items, 'deduct');
          if (reDeducted.ok) {
            updatedProducts = reDeducted.products;
            nextStockDeducted = true;
          }
        }

        return { ...o, status, stockDeducted: nextStockDeducted };
      }
      return o;
    });

    if (!found) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    writeOrders(updated);
    res.json({ ok: true, products: updatedProducts });
  });

  app.delete('/api/orders/:orderNumber', (req, res) => {
    const { orderNumber } = req.params;
    const orders = readOrders();
    const target = orders.find((o) => o.orderNumber === orderNumber);
    let updatedProducts: Product[] | undefined;

    if (
      target &&
      target.stockDeducted &&
      target.status !== 'cancelled' &&
      target.status !== 'shipped' &&
      target.status !== 'delivered'
    ) {
      const restored = applyInventoryForOrder(target.items, 'restore');
      if (restored.ok) updatedProducts = restored.products;
    }

    const updated = orders.filter((o) => o.orderNumber !== orderNumber);
    writeOrders(updated);
    res.json({ ok: true, products: updatedProducts });
  });

  // =========================================================================
  // Client Feedback Screenshots API
  // =========================================================================
  app.get('/api/feedbacks', (_req, res) => {
    res.json({ feedbacks: readFeedbacks() });
  });

  app.get('/api/feedbacks/image/:filename', (req, res) => {
    const safeName = path.basename(req.params.filename || '');
    if (!/^[a-zA-Z0-9_-]+\.(png|jpe?g|webp|gif)$/i.test(safeName)) {
      res.status(400).json({ error: 'Invalid filename' });
      return;
    }
    const fullPath = path.join(FEEDBACK_UPLOADS_DIR, safeName);
    if (!fs.existsSync(fullPath)) {
      res.status(404).json({ error: 'Image not found' });
      return;
    }
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.sendFile(fullPath);
  });

  app.post('/api/feedbacks', (req, res) => {
    try {
      const body = req.body || {};
      const rawImage = String(body.image || '').trim();
      if (!rawImage) {
        res.status(400).json({ error: 'Screenshot image is required' });
        return;
      }

      const id = `fb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      let finalImageUrl = rawImage;

      const dataUrlMatch = rawImage.match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,([A-Za-z0-9+/=\s]+)$/i);
      if (dataUrlMatch) {
        const extRaw = dataUrlMatch[1].toLowerCase();
        const ext = extRaw === 'jpeg' ? 'jpg' : extRaw;
        const base64Data = dataUrlMatch[2].replace(/\s+/g, '');
        const filename = `${id}.${ext}`;
        const filePath = path.join(FEEDBACK_UPLOADS_DIR, filename);
        fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
        finalImageUrl = `/api/feedbacks/image/${filename}`;
      }

      const newFeedback: FeedbackScreenshot = {
        id,
        image: finalImageUrl,
        customerName: body.customerName ? String(body.customerName).trim() : '',
        productName: body.productName ? String(body.productName).trim() : '',
        caption: body.caption ? String(body.caption).trim() : '',
        createdAt: new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
      };

      const existing = readFeedbacks();
      const updated = [newFeedback, ...existing];
      writeFeedbacks(updated);

      res.status(201).json({ ok: true, feedback: newFeedback, feedbacks: updated });
    } catch (err) {
      console.error('Failed to save feedback screenshot:', err);
      res.status(500).json({ error: 'Failed to save feedback screenshot' });
    }
  });

  app.delete('/api/feedbacks/:id', (req, res) => {
    const { id } = req.params;
    const existing = readFeedbacks();
    const target = existing.find((f) => f.id === id);
    if (target?.image?.startsWith('/api/feedbacks/image/')) {
      const safeName = path.basename(target.image);
      const filePath = path.join(FEEDBACK_UPLOADS_DIR, safeName);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch {
          // ignore
        }
      }
    }
    const updated = existing.filter((f) => f.id !== id);
    writeFeedbacks(updated);
    res.json({ ok: true, feedbacks: updated });
  });

  app.post('/api/admin/verify', (req, res) => {
    const { password } = req.body || {};
    const settings = readSettings();
    const expected = settings.adminPassword || 'shestore2026';
    if (password === expected) {
      res.json({ ok: true });
    } else {
      res.status(401).json({ ok: false, error: 'Incorrect password' });
    }
  });

  app.get('/api/settings', (_req, res) => {
    const settings = readSettings();
    res.json({ settings });
  });

  app.put('/api/settings', (req, res) => {
    const current = readSettings();
    const incoming = req.body?.settings || req.body || {};
    const merged: StoreSettings = {
      ...current,
      adminPhone: String(incoming.adminPhone ?? current.adminPhone),
      instaHandle: String(incoming.instaHandle ?? current.instaHandle),
      adminPassword: String(incoming.adminPassword ?? current.adminPassword),
      telegramBotToken: String(incoming.telegramBotToken ?? current.telegramBotToken),
      telegramChatId: String(incoming.telegramChatId ?? current.telegramChatId),
      callmebotPhone: String(incoming.callmebotPhone ?? current.callmebotPhone),
      callmebotApiKey: String(incoming.callmebotApiKey ?? current.callmebotApiKey),
      textmebotApiKey: String(incoming.textmebotApiKey ?? current.textmebotApiKey ?? ''),
      ultramsgInstanceId: String(incoming.ultramsgInstanceId ?? current.ultramsgInstanceId ?? ''),
      ultramsgToken: String(incoming.ultramsgToken ?? current.ultramsgToken ?? ''),
      metaWhatsappPhoneId: String(incoming.metaWhatsappPhoneId ?? current.metaWhatsappPhoneId ?? ''),
      metaWhatsappToken: String(incoming.metaWhatsappToken ?? current.metaWhatsappToken ?? ''),
      webhookUrl: String(incoming.webhookUrl ?? current.webhookUrl),
      ownerEmail: String(incoming.ownerEmail ?? current.ownerEmail),
      resendApiKey: String(incoming.resendApiKey ?? current.resendApiKey),
    };
    writeSettings(merged);
    res.json({ ok: true, settings: merged });
  });

  app.post('/api/settings/telegram-detect', async (req, res) => {
    try {
      const botToken = String(req.body?.botToken || '').trim();
      if (!botToken || !botToken.includes(':')) {
        res.status(400).json({ ok: false, error: 'اكتبي الـ Bot Token الصحيح المنسوخ من @BotFather' });
        return;
      }

      const meRes = await fetch(`https://api.telegram.org/bot${encodeURIComponent(botToken)}/getMe`);
      const meData = (await meRes.json()) as {
        ok?: boolean;
        result?: { username?: string; first_name?: string };
        description?: string;
      };

      if (!meRes.ok || !meData.ok || !meData.result?.username) {
        res.status(400).json({
          ok: false,
          error: 'الـ Bot Token غير صحيح أو منتهي الصلاحية — تأكدي من نسخه كاملاً من @BotFather',
        });
        return;
      }

      const botUsername = meData.result.username;
      const updatesRes = await fetch(
        `https://api.telegram.org/bot${encodeURIComponent(botToken)}/getUpdates?limit=50`
      );
      const updatesData = (await updatesRes.json()) as {
        ok?: boolean;
        result?: Array<{
          message?: { chat?: { id?: number | string; first_name?: string; last_name?: string; title?: string; username?: string; type?: string } };
          my_chat_member?: { chat?: { id?: number | string; first_name?: string; last_name?: string; title?: string; username?: string; type?: string } };
        }>;
      };

      const updates = Array.isArray(updatesData?.result) ? updatesData.result : [];
      const seen = new Set<string>();
      const chats: Array<{ id: string; name: string; username: string; type: string }> = [];
      for (let i = updates.length - 1; i >= 0; i--) {
        const chat = updates[i]?.message?.chat || updates[i]?.my_chat_member?.chat;
        if (chat?.id !== undefined) {
          const id = String(chat.id);
          if (!seen.has(id)) {
            seen.add(id);
            const fullName = [chat.first_name, chat.last_name].filter(Boolean).join(' ').trim();
            chats.push({
              id,
              name: chat.title || fullName || chat.username || id,
              username: chat.username || '',
              type: chat.type || 'private',
            });
          }
        }
      }

      if (chats.length > 0) {
        res.json({
          ok: true,
          botUsername,
          chatId: chats[0].id,
          chatName: chats[0].name,
          chats,
        });
        return;
      }

      res.json({
        ok: false,
        botUsername,
        error: `البوت جاهز (@${botUsername})، بس افتحيه على تيليجرام واضغطي Start (أو ابعتي أي رسالة مثل hi) ثم اضغطي "جلب الـ Chat ID" تاني!`,
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error)?.message || err) });
    }
  });

  app.post('/api/settings/test-notification', async (req, res) => {
    const current = readSettings();
    const incoming = req.body?.settings || {};
    const tempSettings: StoreSettings = { ...current, ...incoming };

    const sampleOrder: PlacedOrder = {
      orderNumber: `TEST-${Math.floor(1000 + Math.random() * 9000)}`,
      customer: {
        name: 'طلب تجريبي (Test Order)',
        phone: '01000000000',
        governorate: 'القاهرة (Cairo)',
        address: 'مدينة نصر، شارع عباس العقاد',
        notes: 'رسالة اختبار للتأكد من وصول إشعارات الطلبات تلقائياً',
      },
      items: [
        {
          id: 'test-item',
          productId: 1,
          name: 'OVERSIZED RIBBED KNIT SUIT',
          nameAr: 'سوت تريكو ريبد واسع',
          color: 'Olive Green',
          colorAr: 'زيتي زيتوني',
          size: 'Free Size (55 - 90 KG)',
          price: 1050,
          quantity: 1,
          image: '',
        },
      ],
      subtotal: 1050,
      shippingCost: 45,
      deliveryTime: '24 - 48 Hours',
      total: 1095,
      date: new Date().toLocaleString('en-US'),
      status: 'pending',
    };

    const report = await dispatchOwnerNotifications(sampleOrder, tempSettings);
    res.json({ ok: true, report });
  });

  const port = Number(process.env.PORT) || 3000;
  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const vitePromise = (async () => {
      const { createServer: createViteServer } = await import('vite');
      return createViteServer({
        server: {
          middlewareMode: true,
          hmr: false,
        },
        appType: 'spa',
      });
    })();

    app.use(async (req, res, next) => {
      try {
        const vite = await vitePromise;
        vite.middlewares(req, res, next);
      } catch (err) {
        next(err);
      }
    });
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`SHE STORE server running on http://0.0.0.0:${port}`);
    setImmediate(initWhatsAppOnStartup);
  });
}

startServer();
