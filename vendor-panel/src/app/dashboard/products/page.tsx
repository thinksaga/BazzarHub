'use client';

import { useEffect, useState } from 'react';

interface Product {
  id: string;
  title: string;
  price: number;
  inventory: number;
  category: string;
  isActive: boolean;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In a real app, we would pass the vendor ID or use a token
    fetch('http://localhost:5004/api/products')
      .then((res) => res.json())
      .then((data) => {
        // Filter for demo purposes if needed, or just show all
        setProducts(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch products', err);
        setLoading(false);
      });
  }, []);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Products</h1>
        <button className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">
          Add Product
        </button>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        {loading ? (
          <div className="p-4 text-center">Loading...</div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {products.map((product) => (
              <li key={product.id}>
                <div className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-indigo-600 truncate">
                      {product.title}
                    </p>
                    <div className="ml-2 flex-shrink-0 flex">
                      <p className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        product.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {product.isActive ? 'Active' : 'Inactive'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 sm:flex sm:justify-between">
                    <div className="sm:flex">
                      <p className="flex items-center text-sm text-gray-500">
                        Price: ₹{product.price}
                      </p>
                      <p className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0 sm:ml-6">
                        Stock: {product.inventory}
                      </p>
                    </div>
                    <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                      <p>
                        Category: {product.category}
                      </p>
                    </div>
                  </div>
                </div>
              </li>
            ))}
            {products.length === 0 && (
              <li className="px-4 py-4 sm:px-6 text-center text-gray-500">
                No products found.
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
