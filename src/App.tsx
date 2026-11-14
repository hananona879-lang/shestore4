import React, { useState, useEffect, useMemo } from 'react';
import { Header, CategoryItem } from './components/Header';
import { Hero } from './components/Hero';
import { ProductCard } from './components/ProductCard';
import { ProductModal } from './components/ProductModal';
import { CartDrawer } from './components/CartDrawer';
import { CheckoutModal } from './components/CheckoutModal';
import { OrderSuccessModal } from './components/OrderSuccessModal';
import { SizeGuideModal } from './components/SizeGuideModal';
import { FeaturesStrip } from './components/FeaturesStrip';
import { ReviewsSection } from './components/ReviewsSection';
import { FaqSection } from './components/FaqSection';
import { Footer } from './components/Footer';
import { AdminLogin } from './components/admin/AdminLogin';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { smoothScrollToSection } from './utils/scroll';

import { Product, CartItem, PlacedOrder } from './types';
import { PRODUCTS, WHATSAPP_PHONE, CATEGORIES } from './data/products';
import { Check, MessageCircle } from 'lucide-react';
import { findVariantIndexForItem, getVariantSizeStock, resolveCanonicalSizeKey } from './utils/inventory';
import { fetchActiveProductsFromCloud, signOutAdminFirebase } from './services/firestoreStore';

function StoreApp() {
  const { language, isRTL, t } = useLanguage();

  // Routing state for dedicated /admin link
  const [currentRoute, setCurrentRoute] = useState<'store' | 'admin'>(() => {
    const path = window.location.pathname;
    const search = window.location.search;
    const hash = window.location.hash;
    return path.startsWith('/admin') || search.includes('admin') || hash === '#admin' ? 'admin' : 'store';
  });

  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('shestore_admin_auth') === 'true';
  });

  // Listen for browser navigation changes
  useEffect(() => {
    const handleLocationChange = () => {
      const path = window.location.pathname;
      const search = window.location.search;
      const hash = window.location.hash;
      if (path.startsWith('/admin') || search.includes('admin') || hash === '#admin') {
        setCurrentRoute('admin');
      } else {
        setCurrentRoute('store');
      }
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  const navigateToAdmin = () => {
    window.history.pushState(null, '', '/admin');
    setCurrentRoute('admin');
  };

  const navigateToStore = () => {
    window.history.pushState(null, '', '/');
    setCurrentRoute('store');
  };

  // Products state (loads from server /api/products with localStorage fallback)
  const [productsList, setProductsList] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem('shestore_admin_products');
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return PRODUCTS;
  });

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      fetchActiveProductsFromCloud(),
      fetch('/api/products').then((res) => (res.ok ? res.json() : null)),
    ]).then(([cloudRes, serverRes]) => {
      if (!active) return;
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
        setProductsList(resolved);
        try {
          localStorage.setItem('shestore_admin_products', JSON.stringify(resolved));
        } catch {
          // ignore storage quota errors
        }
        // Keep fresh server container synced with cloud products for checkout stock validation
        if (cloudProducts && serverProducts) {
          const sameIds =
            cloudProducts.length === serverProducts.length &&
            cloudProducts.every((cp, idx) => cp.id === serverProducts[idx]?.id);
          if (!sameIds) {
            fetch('/api/products', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ products: cloudProducts }),
            }).catch(() => {});
          }
        }
      }
    });
    return () => {
      active = false;
    };
  }, [currentRoute]);

  // Compute dynamic categories based on what exists in productsList + defaults
  const dynamicCategories: CategoryItem[] = useMemo(() => {
    const map = new Map<string, CategoryItem>();
    
    // Add defaults
    CATEGORIES.filter((c) => c.id !== 'all').forEach((c) => {
      map.set(c.id.toLowerCase(), { id: c.id, label: c.label, labelAr: c.labelAr });
    });

    // Add any custom categories typed by hand in admin
    productsList.forEach((p) => {
      if (p.category) {
        const catKey = p.category.toLowerCase().trim();
        if (!map.has(catKey)) {
          map.set(catKey, {
            id: p.category,
            label: p.category,
            labelAr: p.category,
          });
        }
      }
    });

    return Array.from(map.values());
  }, [productsList]);

  // Active Category Filter
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Cart state persisted to localStorage
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('shestore_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Save cart changes
  useEffect(() => {
    try {
      localStorage.setItem('shestore_cart', JSON.stringify(cart));
    } catch (e) {
      console.error(e);
    }
  }, [cart]);

  // Search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);

  // Modals state
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);
  const [checkoutItems, setCheckoutItems] = useState<CartItem[]>([]);

  const [isSizeGuideOpen, setIsSizeGuideOpen] = useState<boolean>(false);
  const [placedOrder, setPlacedOrder] = useState<PlacedOrder | null>(null);
  const [isOrderSuccessOpen, setIsOrderSuccessOpen] = useState<boolean>(false);

  // Product Options Modal state
  const [modalProduct, setModalProduct] = useState<Product | null>(null);
  const [modalVariantIdx, setModalVariantIdx] = useState<number>(0);
  const [isOptionsModalOpen, setIsOptionsModalOpen] = useState<boolean>(false);

  const handleOpenOptions = (product: Product, variantIndex: number = 0) => {
    setModalProduct(product);
    setModalVariantIdx(variantIndex);
    setIsOptionsModalOpen(true);
  };

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  // Add to cart handler (enforces tracked inventory)
  const handleAddToCart = (
    product: Product,
    variantIndex: number,
    size: string,
    quantity: number
  ) => {
    const variant = product.variants[variantIndex] || product.variants[0];
    const canonicalSize = resolveCanonicalSizeKey(product, size);
    const availStock = getVariantSizeStock(product, variantIndex, size);
    const existingQtyInCart = cart.reduce((sum, item) => {
      if (item.productId !== product.id) return sum;
      const itemVariantIdx = findVariantIndexForItem(product, item);
      const itemSize = resolveCanonicalSizeKey(product, item.sizeAr || item.size);
      return itemVariantIdx === variantIndex && itemSize === canonicalSize
        ? sum + item.quantity
        : sum;
    }, 0);

    if (availStock !== null && existingQtyInCart + quantity > availStock) {
      const remaining = Math.max(0, availStock - existingQtyInCart);
      showToast(
        remaining <= 0
          ? (language === 'ar' ? 'نفذت الكمية المتاحة من هذا المقاس في سلتك' : 'Maximum available stock already in your bag')
          : (language === 'ar' ? `المتاح للإضافة حالياً ${remaining} قطعة فقط` : `Only ${remaining} left available to add`)
      );
      return;
    }

    const cartItemId = `${product.id}-${variantIndex}-${canonicalSize}`;

    setCart((prev) => {
      const existing = prev.find((item) => item.id === cartItemId);
      if (existing) {
        return prev.map((item) =>
          item.id === cartItemId
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      } else {
        return [
          ...prev,
          {
            id: cartItemId,
            productId: product.id,
            variantIndex,
            name: product.name,
            nameAr: product.nameAr,
            color: variant.colorName,
            colorAr: variant.colorNameAr,
            size,
            sizeAr: size,
            price: product.price,
            quantity,
            image: variant.image,
          },
        ];
      }
    });

    const toastItemName = language === 'ar' && product.nameAr ? product.nameAr : product.name;
    const toastColorName = language === 'ar' && variant.colorNameAr ? variant.colorNameAr : variant.colorName;
    showToast(`${t.addedToBagToast} (${toastItemName} - ${toastColorName})`);
  };

  // Instant Buy single item directly via Checkout
  const handleInstantBuy = (
    product: Product,
    variantIndex: number,
    size: string,
    quantity: number
  ) => {
    const variant = product.variants[variantIndex] || product.variants[0];
    const availStock = getVariantSizeStock(product, variantIndex, size);
    if (availStock !== null && availStock <= 0) {
      showToast(language === 'ar' ? 'نفذت الكمية من هذا المقاس' : 'This size is currently sold out');
      return;
    }
    const safeQty = availStock !== null ? Math.min(quantity, availStock) : quantity;

    const directItem: CartItem = {
      id: `direct-${product.id}-${variantIndex}-${size}`,
      productId: product.id,
      variantIndex,
      name: product.name,
      nameAr: product.nameAr,
      color: variant.colorName,
      colorAr: variant.colorNameAr,
      size,
      sizeAr: size,
      price: product.price,
      quantity: safeQty,
      image: variant.image,
    };

    setCheckoutItems([directItem]);
    setIsCheckoutOpen(true);
  };

  // Cart quantity updates
  const handleUpdateCartQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            if (delta > 0) {
              const matchedProd = productsList.find((p) => p.id === item.productId);
              if (matchedProd) {
                const vIdx = findVariantIndexForItem(matchedProd, item);
                const avail = getVariantSizeStock(matchedProd, vIdx, item.sizeAr || item.size);
                if (avail !== null && newQty > avail) {
                  return { ...item, quantity: avail };
                }
              }
            }
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const handleRemoveFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  // Checkout from Cart
  const handleCartCheckout = () => {
    if (cart.length === 0) return;
    setIsCartOpen(false);
    setCheckoutItems([...cart]);
    setIsCheckoutOpen(true);
  };

  const handleOrderSuccess = (order: PlacedOrder, updatedProducts?: Product[]) => {
    setIsCheckoutOpen(false);
    setPlacedOrder(order);
    setIsOrderSuccessOpen(true);
    if (cart.length > 0 && checkoutItems.length === cart.length) {
      setCart([]);
    }
    if (updatedProducts && updatedProducts.length > 0) {
      setProductsList(updatedProducts);
      try {
        localStorage.setItem('shestore_admin_products', JSON.stringify(updatedProducts));
      } catch {
        // ignore
      }
    }
  };

  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Filter products by selected category and search query
  const displayProducts = useMemo(() => {
    return productsList.filter((p) => {
      // 1. Category filter
      if (selectedCategory !== 'all') {
        const matchesCategory =
          p.category.toLowerCase() === selectedCategory.toLowerCase() ||
          (selectedCategory === 'coats' && (p.category.toLowerCase().includes('coat') || p.category.toLowerCase().includes('jacket'))) ||
          (selectedCategory === 'suits' && (p.category.toLowerCase().includes('suit') || p.category.toLowerCase().includes('set'))) ||
          (selectedCategory === 'hoodies' && p.category.toLowerCase().includes('hoodie')) ||
          (selectedCategory === 'blouses' && (p.category.toLowerCase().includes('blouse') || p.category.toLowerCase().includes('top')));
        
        if (!matchesCategory) return false;
      }

      // 2. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = p.name.toLowerCase().includes(q) || (p.nameAr && p.nameAr.toLowerCase().includes(q));
        const matchesDesc = p.desc.toLowerCase().includes(q) || (p.descAr && p.descAr.toLowerCase().includes(q));
        const matchesFabric = p.fabric.toLowerCase().includes(q) || (p.fabricAr && p.fabricAr.toLowerCase().includes(q));
        const matchesColor = p.variants.some((v) => 
          v.colorName.toLowerCase().includes(q) || (v.colorNameAr && v.colorNameAr.toLowerCase().includes(q))
        );
        const matchesCat = p.category.toLowerCase().includes(q);
        if (!matchesName && !matchesDesc && !matchesFabric && !matchesColor && !matchesCat) {
          return false;
        }
      }

      return true;
    });
  }, [productsList, selectedCategory, searchQuery]);

  // Dedicated Admin Route
  if (currentRoute === 'admin') {
    if (!isAdminAuthenticated) {
      return (
        <AdminLogin
          onLoginSuccess={() => setIsAdminAuthenticated(true)}
          onBackToStore={navigateToStore}
        />
      );
    }
    return (
      <AdminDashboard
        onNavigateStore={navigateToStore}
        onLogout={() => {
          localStorage.removeItem('shestore_admin_auth');
          signOutAdminFirebase().catch(() => {});
          setIsAdminAuthenticated(false);
        }}
        onProductsUpdated={(newProds) => setProductsList(newProds)}
      />
    );
  }

  return (
    <div className={`min-h-screen flex flex-col bg-[#FAF7F2] text-neutral-900 font-sans selection:bg-neutral-900 selection:text-white ${isRTL ? 'rtl' : 'ltr'}`}>
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-black text-white px-5 py-3 rounded-none shadow-2xl flex items-center gap-2.5 text-xs sm:text-sm font-bold animate-bounce">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
          <button 
            onClick={() => setIsCartOpen(true)}
            className="underline ml-2 text-amber-300 hover:text-white uppercase tracking-wider text-xs cursor-pointer"
          >
            {t.viewBag}
          </button>
        </div>
      )}

      {/* 1. Header with Slim Announcement Bar & Centered Logo */}
      <Header
        cartCount={totalCartCount}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenSizeGuide={() => setIsSizeGuideOpen(true)}
        onSelectCategory={(cat) => {
          setSelectedCategory(cat);
          smoothScrollToSection('product-section');
        }}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        isSearchOpen={isSearchOpen}
        setIsSearchOpen={setIsSearchOpen}
        categories={dynamicCategories}
        activeCategory={selectedCategory}
      />

      {/* Editorial Off-White & Black Hero Section */}
      <Hero
        onShopClick={() => smoothScrollToSection('product-section')}
        onOpenSizeGuide={() => setIsSizeGuideOpen(true)}
      />

      {/* 2. Category Filter Pills Bar (Allows filtering by ALL categories, including custom hand-typed ones) */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-6 pb-1 w-full">
        <div className="flex items-center justify-between gap-3 overflow-x-auto no-scrollbar pb-2">
          
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider border cursor-pointer whitespace-nowrap transition-all ${
                selectedCategory === 'all'
                  ? 'bg-black text-white border-black shadow-xs'
                  : 'bg-white text-neutral-700 border-neutral-300 hover:border-black'
              }`}
            >
              {t.allPieces} ({productsList.length})
            </button>

            {dynamicCategories.map((cat) => {
              const count = productsList.filter((p) => {
                return (
                  p.category.toLowerCase() === cat.id.toLowerCase() ||
                  (cat.id === 'coats' && (p.category.toLowerCase().includes('coat') || p.category.toLowerCase().includes('jacket'))) ||
                  (cat.id === 'suits' && (p.category.toLowerCase().includes('suit') || p.category.toLowerCase().includes('set'))) ||
                  (cat.id === 'hoodies' && p.category.toLowerCase().includes('hoodie')) ||
                  (cat.id === 'blouses' && (p.category.toLowerCase().includes('blouse') || p.category.toLowerCase().includes('top')))
                );
              }).length;

              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider border cursor-pointer whitespace-nowrap transition-all ${
                    selectedCategory.toLowerCase() === cat.id.toLowerCase()
                      ? 'bg-black text-white border-black shadow-xs'
                      : 'bg-white text-neutral-700 border-neutral-300 hover:border-black'
                  }`}
                >
                  <span>{language === 'ar' && cat.labelAr ? cat.labelAr : cat.label}</span>
                  {count > 0 && <span className="opacity-70 text-[10px] ml-1">({count})</span>}
                </button>
              );
            })}
          </div>

          {/* Quick Clear Filter if active */}
          {(selectedCategory !== 'all' || searchQuery) && (
            <button
              onClick={() => {
                setSelectedCategory('all');
                setSearchQuery('');
              }}
              className="text-xs text-neutral-500 hover:text-black font-bold uppercase underline whitespace-nowrap cursor-pointer shrink-0"
            >
              {language === 'ar' ? 'عرض الكل' : 'Reset Filter'}
            </button>
          )}

        </div>
      </div>

      {/* 3. Main Luxury Products - Side-by-side 2-column layout on phone & 4-column on desktop matching screenshot */}
      <main id="product-section" className="scroll-mt-28 flex-1 max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 w-full">
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5 lg:gap-6 items-start">
          {displayProducts.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              index={index}
              onOpenOptions={handleOpenOptions}
            />
          ))}
        </div>

        {displayProducts.length === 0 && (
          <div className="max-w-md mx-auto text-center py-16 px-4 bg-white border border-neutral-300">
            <p className="text-sm font-bold text-neutral-800 uppercase tracking-wider">
              {language === 'ar' ? 'لم يتم العثور على قطع تطابق بحثك' : 'No matching items found'}
            </p>
            <p className="text-xs text-neutral-500 mt-1">
              {language === 'ar' ? 'جربي اختيار تصنيف آخر أو مسح البحث لعرض كل الموديلات.' : 'Try clearing your search query or selecting another category.'}
            </p>
            <button
              onClick={() => {
                setSelectedCategory('all');
                setSearchQuery('');
              }}
              className="mt-4 bg-black text-white px-5 py-2 text-xs font-bold uppercase tracking-wider cursor-pointer"
            >
              {t.allPieces}
            </button>
          </div>
        )}
      </main>

      {/* 4. Brand Pillars & Guarantees */}
      <FeaturesStrip />

      {/* 5. Verified Client Reviews */}
      <ReviewsSection />

      {/* 6. Frequently Asked Questions */}
      <FaqSection />

      {/* 7. Official Footer */}
      <Footer
        onOpenSizeGuide={() => setIsSizeGuideOpen(true)}
        onSelectCategory={(cat) => {
          setSelectedCategory(cat);
          smoothScrollToSection('product-section');
        }}
        onNavigateAdmin={navigateToAdmin}
        categories={dynamicCategories}
      />

      {/* Slide-over Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cart}
        products={productsList}
        onUpdateQuantity={handleUpdateCartQuantity}
        onRemoveItem={handleRemoveFromCart}
        onCheckout={handleCartCheckout}
      />

      {/* Checkout Modal */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        items={checkoutItems}
        onOrderSuccess={handleOrderSuccess}
      />

      {/* Order Confirmed Receipt Modal */}
      <OrderSuccessModal
        isOpen={isOrderSuccessOpen}
        onClose={() => setIsOrderSuccessOpen(false)}
        order={placedOrder}
      />

      {/* Size Guide Modal */}
      <SizeGuideModal
        isOpen={isSizeGuideOpen}
        onClose={() => setIsSizeGuideOpen(false)}
      />

      {/* Product Options Modal (Opens when CHOOSE OPTIONS is clicked) */}
      <ProductModal
        isOpen={isOptionsModalOpen}
        onClose={() => setIsOptionsModalOpen(false)}
        product={modalProduct}
        initialVariantIndex={modalVariantIdx}
        cartItems={cart}
        onAddToCart={handleAddToCart}
        onInstantBuy={handleInstantBuy}
        onOpenSizeGuide={() => setIsSizeGuideOpen(true)}
      />

      {/* Floating WhatsApp Action Button */}
      <a
        href={`https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(
          language === 'ar'
            ? "مرحباً SHE STORE، أود الاستفسار بخصوص الطلب من المتجر الرسمي"
            : "Hello SHE STORE, I would like to inquire about ordering"
        )}`}
        target="_blank"
        rel="noreferrer"
        className={`fixed bottom-5 ${isRTL ? 'left-5' : 'right-5'} z-40 bg-emerald-700 hover:bg-emerald-800 text-white p-3.5 rounded-full shadow-2xl flex items-center justify-center transition-transform hover:scale-110 group`}
        title={t.whatsappSupport}
        aria-label={t.whatsappSupport}
      >
        <MessageCircle className="w-6 h-6" />
        <span className="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-xs transition-all duration-300 ease-in-out text-xs font-bold px-0 group-hover:px-2 uppercase tracking-wider">
          {t.whatsappSupport}
        </span>
      </a>

    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <StoreApp />
    </LanguageProvider>
  );
}
