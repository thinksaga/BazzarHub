'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  images: string[];
  vendorId: string;
  category: string;
  stock: number;
}

export default function ProductDetailsPage() {
  const { id } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { addToCart } = useCart();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    fetch(`http://localhost:5004/api/products/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch product');
        return res.json();
      })
      .then((data) => {
        setProduct(data);
        if (data.images && data.images.length > 0) {
          setSelectedImage(data.images[0]);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError('Failed to load product details');
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center text-red-500">
          {error || 'Product not found'}
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Image Gallery */}
          <div className="space-y-4">
            <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border border-gray-200 flex items-center justify-center">
              {selectedImage ? (
                <img 
                  src={selectedImage} 
                  alt={product.title} 
                  className="w-full h-full object-contain"
                />
              ) : (
                <span className="text-6xl">📦</span>
              )}
            </div>
            {product.images && product.images.length > 1 && (
              <div className="flex space-x-4 overflow-x-auto pb-2">
                {product.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImage(img)}
                    className={`w-20 h-20 flex-shrink-0 rounded-md border-2 overflow-hidden ${
                      selectedImage === img ? 'border-indigo-600' : 'border-transparent'
                    }`}
                  >
                    <img src={img} alt={`View ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">{product.title}</h1>
            <div className="text-2xl font-bold text-indigo-600 mb-6">₹{product.price}</div>
            
            <div className="prose prose-sm text-gray-500 mb-8">
              <p>{product.description}</p>
            </div>

            <div className="border-t border-b border-gray-200 py-6 mb-8">
              <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                <span>Category:</span>
                <span className="font-medium text-gray-900 capitalize">{product.category}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>Availability:</span>
                <span className={`font-medium ${product.stock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {product.stock > 0 ? 'In Stock' : 'Out of Stock'}
                </span>
              </div>
            </div>

            <button
              onClick={() => addToCart(product.id)}
              disabled={product.stock <= 0}
              className={`w-full py-4 px-8 rounded-lg text-lg font-semibold text-white transition-colors ${
                product.stock > 0 
                  ? 'bg-indigo-600 hover:bg-indigo-700 shadow-lg hover:shadow-xl' 
                  : 'bg-gray-400 cursor-not-allowed'
              }`}
            >
              {product.stock > 0 ? 'Add to Cart' : 'Out of Stock'}
            </button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
