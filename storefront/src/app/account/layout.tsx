'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { isAuthenticated, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return null; 
  }

  const navItems = [
    { name: 'My Orders', href: '/account/orders' },
    { name: 'My Profile', href: '/account/profile' },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar */}
        <aside className="w-full md:w-64 flex-shrink-0">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-6">My Account</h2>
            <nav className="space-y-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block px-4 py-2 rounded-md transition-colors ${
                    pathname === item.href
                      ? 'bg-indigo-50 text-indigo-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  {item.name}
                </Link>
              ))}
              <button
                onClick={() => {
                  logout();
                  router.push('/');
                }}
                className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 rounded-md transition-colors mt-4"
              >
                Logout
              </button>
            </nav>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
