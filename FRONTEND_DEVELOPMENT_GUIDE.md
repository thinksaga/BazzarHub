# Frontend Development Guide

## Overview

This document outlines the setup and development of the three frontend applications for BazaarHub:

1. **Storefront** (Port 3001) - Customer-facing marketplace
2. **Vendor Panel** (Port 3002) - Seller dashboard
3. **Admin Panel** (Port 3003) - Platform management

## Architecture

### Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **HTTP Client**: Axios
- **Icons**: Lucide React
- **Charts**: Recharts (Vendor Panel & Admin Panel)
- **Forms**: React Hook Form (recommended)

### Project Structure

```
storefront/
├── src/
│   ├── app/
│   │   ├── layout.tsx         # Root layout with metadata
│   │   ├── globals.css        # Global styles
│   │   ├── page.tsx           # Home page
│   │   ├── shop/              # Product listing
│   │   ├── product/[id]/      # Product detail
│   │   ├── cart/              # Shopping cart
│   │   ├── checkout/          # Checkout flow
│   │   └── account/           # User account pages
│   ├── components/
│   │   ├── Navbar.tsx
│   │   ├── Footer.tsx
│   │   ├── ProductGrid.tsx
│   │   ├── ProductCard.tsx
│   │   ├── Cart/
│   │   ├── Checkout/
│   │   └── ...
│   ├── lib/
│   │   ├── api.ts            # API client setup
│   │   ├── utils.ts          # Utility functions
│   │   └── validators.ts     # Form validators
│   ├── stores/
│   │   ├── cart.ts           # Cart state
│   │   ├── auth.ts           # Authentication state
│   │   └── ui.ts             # UI state
│   ├── hooks/
│   │   ├── useAuth.ts        # Auth hook
│   │   ├── useCart.ts        # Cart hook
│   │   └── ...
│   └── types/
│       └── index.ts          # TypeScript types
├── public/
│   ├── manifest.json         # PWA manifest
│   └── service-worker.js     # Service worker
├── next.config.js
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
└── package.json

vendor-panel/          # Similar structure
admin-panel/           # Similar structure
```

## Setup Instructions

### 1. Install Dependencies

```bash
cd storefront
npm install
cd ../vendor-panel
npm install
cd ../admin-panel
npm install
cd ..
```

### 2. Environment Variables

Create `.env.local` in each frontend directory:

**storefront/.env.local**
```
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_APP_NAME=BazaarHub
NEXT_PUBLIC_ENABLE_PWA=true
```

**vendor-panel/.env.local**
```
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_APP_NAME=BazaarHub Vendor
NEXT_PUBLIC_SELLER_DASHBOARD=true
```

**admin-panel/.env.local**
```
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_APP_NAME=BazaarHub Admin
NEXT_PUBLIC_ADMIN_DASHBOARD=true
```

### 3. Development Mode

```bash
# Terminal 1: Storefront
cd storefront && npm run dev

# Terminal 2: Vendor Panel
cd vendor-panel && npm run dev

# Terminal 3: Admin Panel
cd admin-panel && npm run dev
```

Access at:
- Storefront: http://localhost:3001
- Vendor Panel: http://localhost:3002
- Admin Panel: http://localhost:3003

### 4. Production Build

```bash
npm run build
npm start
```

## API Integration

### API Client Setup

File: `src/lib/api.ts`

```typescript
import { ApiClient } from '@bazaarhub/api-client';

const apiClient = new ApiClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',
  timeout: 30000,
});

// Set token after login
export const setAuthToken = (token: string) => {
  apiClient.setToken(token);
  localStorage.setItem('authToken', token);
};

export default apiClient;
```

### Using API Client

```typescript
// GET
const products = await apiClient.get('/products');

// POST
const response = await apiClient.post('/vendor/register', {
  email: 'vendor@example.com',
  password: 'secure-password',
});

// File Upload
const formData = new FormData();
formData.append('document', file);
const result = await apiClient.postFormData('/kyc/upload', formData);
```

## State Management with Zustand

### Cart Store Example

File: `src/stores/cart.ts`

```typescript
import { create } from 'zustand';

interface CartItem {
  id: string;
  quantity: number;
  price: number;
}

interface CartStore {
  items: CartItem[];
  total: number;
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  clear: () => void;
}

export const useCartStore = create<CartStore>((set) => ({
  items: [],
  total: 0,
  addItem: (item) => set((state) => ({
    items: [...state.items, item],
    total: state.total + (item.price * item.quantity),
  })),
  removeItem: (id) => set((state) => ({
    items: state.items.filter(item => item.id !== id),
  })),
  clear: () => set({ items: [], total: 0 }),
}));
```

### Using Store in Component

```typescript
'use client';

import { useCartStore } from '@/stores/cart';

export default function Cart() {
  const { items, total, addItem, removeItem } = useCartStore();

  return (
    <div>
      {/* Display cart items */}
    </div>
  );
}
```

## Features Implementation

### Storefront Priority

1. **Phase 1 (Week 1)**
   - Product listing & search
   - Product detail page
   - Cart management
   - Basic checkout

2. **Phase 2 (Week 2)**
   - User authentication
   - Order history
   - Account management
   - Reviews & ratings

3. **Phase 3 (Week 3)**
   - Payment integration
   - PWA setup
   - Performance optimization
   - SEO optimization

### Vendor Panel Priority

1. **Phase 1 (Week 1)**
   - Dashboard overview
   - Product management (CRUD)
   - Order management
   - Basic analytics

2. **Phase 2 (Week 2)**
   - Earnings tracking
   - Payout management
   - Customer support
   - Reporting

3. **Phase 3 (Week 3)**
   - Advanced analytics
   - Inventory management
   - Promotion tools
   - Integration settings

### Admin Panel Priority

1. **Phase 1 (Week 1)**
   - Dashboard overview
   - Vendor management
   - KYC approval interface
   - Order management

2. **Phase 2 (Week 2)**
   - Financial reporting
   - Compliance monitoring
   - User management
   - Category management

3. **Phase 3 (Week 3)**
   - Advanced analytics
   - System health monitoring
   - Audit logs viewer
   - Settings & configuration

## Common Components

### Authentication Pattern

```typescript
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';

export function withAuth<P extends object>(
  Component: React.ComponentType<P>
) {
  return function ProtectedComponent(props: P) {
    const router = useRouter();
    const { isAuthenticated } = useAuthStore();

    useEffect(() => {
      if (!isAuthenticated) {
        router.push('/login');
      }
    }, [isAuthenticated, router]);

    if (!isAuthenticated) return null;

    return <Component {...props} />;
  };
}
```

### Form Validation Pattern

```typescript
import { z } from 'zod';

const productSchema = z.object({
  name: z.string().min(3).max(255),
  price: z.number().positive(),
  description: z.string().min(10),
  category: z.string().min(1),
});

type Product = z.infer<typeof productSchema>;
```

## Performance Optimization

1. **Code Splitting**: Dynamic imports for large components
   ```typescript
   const ProductReviews = dynamic(() => import('./ProductReviews'), {
     loading: () => <div>Loading...</div>,
   });
   ```

2. **Image Optimization**: Use Next.js Image component
   ```typescript
   import Image from 'next/image';
   
   <Image
     src="/product.jpg"
     alt="Product"
     width={400}
     height={400}
     priority
   />
   ```

3. **Data Caching**: Implement SWR for data fetching
   ```typescript
   import useSWR from 'swr';
   
   const { data, error } = useSWR('/api/products', fetcher);
   ```

4. **Bundle Analysis**: Use `next/bundle-analyzer`
   ```bash
   npm install -D @next/bundle-analyzer
   ```

## Testing

### Unit Tests (Jest)

```bash
npm install -D jest @testing-library/react
```

### E2E Tests (Playwright)

```bash
npm install -D @playwright/test
```

## PWA Setup (Storefront Only)

Configured in `next.config.js`:
- Service worker registration
- Manifest generation
- Offline support
- Install prompts

## Deployment

### Docker Build

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN npm ci && npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3001
CMD ["npm", "start"]
```

### Environment-Specific Builds

```bash
# Development
npm run dev

# Staging
API_URL=https://staging-api.bazaarhub.com npm run build

# Production
API_URL=https://api.bazaarhub.com npm run build
```

## Troubleshooting

### Module Resolution Issues
- Check `tsconfig.json` paths configuration
- Ensure `baseUrl` is set correctly
- Use absolute imports: `import { Button } from '@/components/Button'`

### Build Errors
- Clear `.next` directory: `rm -rf .next`
- Reinstall dependencies: `rm -rf node_modules && npm install`
- Check TypeScript errors: `npm run type-check`

### API Connection Issues
- Verify backend is running on port 3000
- Check `NEXT_PUBLIC_API_URL` environment variable
- Review browser console for CORS errors

## Next Steps

1. ✅ Frontend scaffolding complete
2. ⏳ API integration and authentication
3. ⏳ Page implementations
4. ⏳ Testing suite
5. ⏳ Deployment preparation

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Zustand](https://github.com/pmndrs/zustand)
- [React Best Practices](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
