import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/context/AuthContext';
import { CartProvider } from '@/context/CartContext';
import './globals.css';
import Script from 'next/script';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'BazaarHub - India\'s Multivendor Marketplace',
  description: 'Shop from thousands of sellers with secure payments and fast delivery',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'BazaarHub',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <CartProvider>
            <div id="app">
              {children}
            </div>
          </CartProvider>
        </AuthProvider>
        <Script src="https://checkout.razorpay.com/v1/checkout.js" />
      </body>
    </html>
  );
}
