'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ShoppingCart, Search, User, Heart, LogOut } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';

export default function Navbar() {
  const [searchQuery, setSearchQuery] = useState('');
  const { items } = useCart();
  const { user, logout, isAuthenticated } = useAuth();

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // TODO: Implement search functionality
  };

  const cartItemCount = items.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <nav className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg" />
            <span className="text-xl font-bold text-gray-900">BazaarHub</span>
          </Link>

          {/* Search Bar */}
          <div className="flex-1 max-w-xl mx-8">
            <form onSubmit={handleSearch} className="relative">
              <input
                type="text"
                placeholder="Search products, brands..."
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:border-orange-500"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-orange-500"
              >
                <Search size={20} />
              </button>
            </form>
          </div>

          {/* Right Actions */}
          <div className="flex items-center space-x-6">
            <button className="text-gray-600 hover:text-orange-500">
              <Heart size={24} />
            </button>
            <Link href="/cart" className="text-gray-600 hover:text-orange-500 relative">
              <ShoppingCart size={24} />
              {cartItemCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {cartItemCount}
                </span>
              )}
            </Link>
            
            {isAuthenticated ? (
              <div className="flex items-center space-x-4">
                <span className="text-sm font-medium text-gray-700">Hi, {user?.firstName}</span>
                <button 
                  onClick={logout}
                  className="text-gray-600 hover:text-orange-500"
                  title="Logout"
                >
                  <LogOut size={24} />
                </button>
              </div>
            ) : (
              <Link href="/login" className="text-gray-600 hover:text-orange-500">
                <User size={24} />
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
