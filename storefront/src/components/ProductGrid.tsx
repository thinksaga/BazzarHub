'use client';

import { useEffect, useState } from 'react';
import { useCart } from '@/context/CartContext';

interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  images: string[];
  vendorId: string;
}

export default function ProductGrid() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { addToCart } = useCart();

  useEffect(() => {
    fetch('http://localhost:5004/api/products')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch products');
        return res.json();
      })
      .then((data) => {
        setProducts(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError('Failed to load products');
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="text-center py-10">Loading products...</div>;
  if (error) return <div className="text-center py-10 text-red-500">{error}</div>;
  if (products.length === 0) return <div className="text-center py-10">No products found.</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {products.map((product) => (
        <div
          key={product.id}
          className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow"
        >
          <div className="bg-gray-100 h-48 flex items-center justify-center text-4xl">
            {product.images && product.images[0] ? (
               <img src={product.images[0]} alt={product.title} className="w-full h-full object-cover" />
            ) : (
               '📦'
            )}
          </div>
          <div className="p-4">
            <h3 className="font-semibold text-gray-900 text-lg mb-1 line-clamp-1">
              {product.title}
            </h3>
            <p className="text-gray-500 text-sm mb-2 line-clamp-2">
              {product.description}
            </p>
            <div className="flex items-center justify-between">
              <span className="text-xl font-bold text-indigo-600">
                ₹{product.price}
              </span>
              <button 
                onClick={() => addToCart(product.id)}
                className="bg-indigo-600 text-white px-3 py-1 rounded-md text-sm hover:bg-indigo-700 transition-colors"
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
