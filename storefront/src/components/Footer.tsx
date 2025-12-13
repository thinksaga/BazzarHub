'use client';

import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div>
            <h3 className="text-white font-bold mb-4">BazaarHub</h3>
            <p className="text-sm">India's most trusted multivendor marketplace with secure payments and fast delivery.</p>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">Shop</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="#" className="hover:text-white">Electronics</Link></li>
              <li><Link href="#" className="hover:text-white">Fashion</Link></li>
              <li><Link href="#" className="hover:text-white">Home</Link></li>
              <li><Link href="#" className="hover:text-white">All Categories</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">Seller</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="#" className="hover:text-white">Start Selling</Link></li>
              <li><Link href="#" className="hover:text-white">Seller Dashboard</Link></li>
              <li><Link href="#" className="hover:text-white">Seller Support</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">Company</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="#" className="hover:text-white">About Us</Link></li>
              <li><Link href="#" className="hover:text-white">Privacy Policy</Link></li>
              <li><Link href="#" className="hover:text-white">Terms of Service</Link></li>
              <li><Link href="#" className="hover:text-white">Contact Us</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-700 pt-8">
          <p className="text-center text-sm">
            &copy; 2024 BazaarHub. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
