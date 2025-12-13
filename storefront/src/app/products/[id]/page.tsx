'use client';

import React, { useEffect, useState } from 'react';
import { useCart } from '@/context/CartContext';
import { ShoppingCart } from 'lucide-react';

interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  images: string[];
  vendor: {
    storeName: string;
  };
}

export default function ProductDetailPage({ params }: { params: { id: string } }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { addToCart } = useCart();

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await fetch(`http://localhost:5004/api/products/${params.id}`);
        if (!res.ok) throw new Error('Product not found');
        const data = await res.json();
        setProduct(data);
      } catch (err) {
        console.error(err);
        setError('Failed to load product');
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Product not found</h1>
        <p className="mt-2 text-gray-600">The product you are looking for does not exist.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Image Gallery */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="aspect-w-1 aspect-h-1 bg-gray-200">
            {product.images && product.images.length > 0 ? (
              <img
                src={product.images[0]}
                alt={product.title}
                className="w-full h-96 object-cover object-center"
              />
            ) : (
              <div className="w-full h-96 flex items-center justify-center text-gray-500">
                No Image Available
              </div>
            )}
          </div>
        </div>

        {/* Product Info */}
        <div className="flex flex-col">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{product.title}</h1>
          <p className="text-sm text-gray-500 mb-4">
            Sold by <span className="font-medium text-indigo-600">{product.vendor?.storeName || 'Unknown Vendor'}</span>
          </p>
          
          <div className="text-3xl font-bold text-indigo-600 mb-6">
            ₹{Number(product.price).toFixed(2)}
          </div>

          <div className="prose prose-sm text-gray-500 mb-8">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Description</h3>
            <p>{product.description}</p>
          </div>

          <div className="mt-auto">
            <button
              onClick={() => addToCart(product.id, 1)}
              className="w-full md:w-auto flex items-center justify-center px-8 py-4 border border-transparent rounded-md shadow-sm text-lg font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
            >
              <ShoppingCart className="mr-2 h-6 w-6" />
              Add to Cart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
