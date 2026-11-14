# SHE STORE EG — Official E-Commerce Web Application

A modern, high-performance luxury e-commerce web storefront built for **SHE STORE EG** (Egyptian women's fashion boutique).

---

## 🛠 Tech Stack

- **Framework:** React 19 (TypeScript)
- **Bundler:** Vite
- **Styling:** Tailwind CSS v4
- **Icons:** Lucide React
- **Animations:** Motion (Framer Motion)

---

## 🔒 Merchant Admin Dashboard

- **Access URL:** `https://your-domain.com/admin` (or `/#admin`)
- **Default Master Password:** `shestore2026`
- **Features:**
  - Real-time Order Management & Status Tracking
  - One-click customer WhatsApp chat
  - Catalog Management (Add new items, edit prices/captions/sizes, delete items)
  - Sales & Revenue Analytics (Cash on delivery volume)
  - Store Settings (Change Admin Password, update receiving WhatsApp phone, Instagram handle)

---

## 🚀 Getting Started (Quick Setup for Developers)

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Local Development Server
```bash
npm run dev
```
The application will run locally at `http://localhost:3000` (or `http://localhost:5173`).

### 3. Production Build
```bash
npm run build
```
The optimized production bundle will be generated in the `dist/` directory, ready to deploy to any static host (Vercel, Netlify, Cloudflare Pages, Firebase Hosting, AWS S3, etc.).

---

## 📁 Project Structure

```text
├── index.html                   # HTML entry point with metadata
├── package.json                 # Dependencies and build scripts
├── vite.config.ts               # Vite configuration
├── tsconfig.json                # TypeScript configuration
├── public/
│   └── assets/                  # Product imagery & brand logo
└── src/
    ├── main.tsx                 # Application mount point
    ├── App.tsx                  # Main layout, search, cart, and modals orchestration
    ├── types.ts                 # TypeScript types (Product, Variant, CartItem, Order)
    ├── index.css                # Global styles and Tailwind CSS v4 imports
    ├── data/
    │   └── products.ts          # Central source of truth for products, phone, Instagram
    └── components/
        ├── Header.tsx           # Centered logo, announcements, search & navigation
        ├── ProductCard.tsx      # Rive-style 2-column card with "CHOOSE OPTIONS" button
        ├── ProductModal.tsx     # Quick view modal with swatches, sizes, WhatsApp order
        ├── CartDrawer.tsx       # Slide-over shopping bag drawer
        ├── CheckoutModal.tsx    # Cash on Delivery checkout with governorate shipping
        ├── OrderSuccessModal.tsx# Order confirmation summary receipt
        ├── SizeGuideModal.tsx   # Weight & sizing guide modal
        ├── FeaturesStrip.tsx    # Value propositions & inspection guarantee
        ├── ReviewsSection.tsx   # Client testimonials
        ├── FaqSection.tsx       # Frequently asked questions
        └── Footer.tsx           # Brand footer with links and contact info
```

---

## ⚙️ How to Customize

### Adding or Updating Products
All product definitions, prices, captions, and color variants are centralized in:
👉 `src/data/products.ts`

Each product object contains:
```typescript
{
  id: 1,
  name: "OVERSIZED BOMBER LEATHER JACKET",
  category: "coats",
  badge: "NEW DROP • TRENDING 🔥",
  desc: "Leather jacket, timeless style 🖤✨\n\n1300 L.E",
  fabric: "Premium soft-grain leather...",
  price: 1300,
  originalPrice: 1550,
  sizes: ["Free Size (55 - 90 KG)", "Oversized (90 - 115 KG)"],
  variants: [
    {
      colorName: "Classic Black",
      hex: "#121212",
      image: "/assets/aistudio/..."
    }
  ]
}
```

### Changing WhatsApp Number & Instagram
Located at the top of `src/data/products.ts`:
```typescript
export const WHATSAPP_PHONE = "201115010812";
export const INSTAGRAM_HANDLE = "@she.store._eg";
export const INSTAGRAM_URL = "https://www.instagram.com/she.store._eg";
```

### Governorate Shipping Rates
To modify delivery fees or delivery timeframes per governorate, edit the list in:
👉 `src/components/CheckoutModal.tsx`

---

## 📦 Deployment Options

The project compiles to pure static HTML/CSS/JS in `dist/`. You can deploy it instantly on:
- **Vercel:** Import GitHub repo and deploy (zero configuration needed).
- **Netlify:** Connect repo or drag and drop `dist/` folder.
- **Cloudflare Pages / Firebase Hosting / GitHub Pages**.
