export interface Variant {
  colorName: string;
  colorNameAr?: string;
  hex: string;
  image: string;
  stock?: number;
  sizeStock?: Record<string, number>;
}

export interface Product {
  id: number;
  name: string;
  nameAr?: string;
  category: string;
  badge: string;
  badgeAr?: string;
  desc: string;
  descAr?: string;
  fabric: string;
  fabricAr?: string;
  price: number;
  originalPrice?: number;
  sizes: string[];
  sizesAr?: string[];
  variants: Variant[];
  isNewDrop?: boolean;
  trackStock?: boolean;
}

export interface CartItem {
  id: string; // unique item id based on productId-variantIdx-size
  productId: number;
  variantIndex?: number;
  name: string;
  nameAr?: string;
  color: string;
  colorAr?: string;
  size: string;
  sizeAr?: string;
  price: number;
  quantity: number;
  image: string;
}

export interface OrderCustomerInfo {
  name: string;
  phone: string;
  governorate: string;
  address: string;
  notes: string;
}

export interface PlacedOrder {
  orderNumber: string;
  customer: OrderCustomerInfo;
  items: CartItem[];
  subtotal?: number;
  shippingCost?: number;
  deliveryTime?: string;
  total: number;
  date: string;
  status?: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  ownerNotified?: boolean;
  notificationChannels?: string[];
  stockDeducted?: boolean;
}

export interface StoreSettings {
  adminPhone: string;
  instaHandle: string;
  adminPassword?: string;
  telegramBotToken: string;
  telegramChatId: string;
  callmebotPhone: string;
  callmebotApiKey: string;
  textmebotApiKey?: string;
  ultramsgInstanceId?: string;
  ultramsgToken?: string;
  metaWhatsappPhoneId?: string;
  metaWhatsappToken?: string;
  webhookUrl: string;
  ownerEmail: string;
  resendApiKey: string;
}

export interface FeedbackScreenshot {
  id: string;
  image: string;
  customerName?: string;
  productName?: string;
  caption?: string;
  createdAt: string;
}
