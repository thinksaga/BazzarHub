'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

interface OrderItem {
  id: string;
  quantity: number;
  price: number;
  product: {
    title: string;
    images: string[];
  };
}

interface Order {
  id: string;
  totalAmount: number;
  status: string;
  createdAt: string;
  items: OrderItem[];
}

export default function OrderHistoryPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const { token, isAuthenticated } = useAuth();

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await fetch('http://localhost:5004/api/orders', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          setOrders(data);
        }
      } catch (error) {
        console.error('Failed to fetch orders', error);
      } finally {
        setLoading(false);
      }
    };

    if (isAuthenticated && token) {
      fetchOrders();
    }
  }, [isAuthenticated, token]);

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Please Login</h1>
        <Link href="/login" className="text-indigo-600 hover:underline">
          Go to Login Page
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Order History</h1>

      {orders.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500 text-lg mb-4">You haven't placed any orders yet.</p>
          <Link href="/" className="text-indigo-600 font-medium hover:underline">
            Start Shopping
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => (
            <div key={order.id} className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-500">Order Placed</p>
                  <p className="font-medium text-gray-900">{new Date(order.createdAt).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Amount</p>
                  <p className="font-medium text-gray-900">₹{Number(order.totalAmount).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Order #</p>
                  <p className="font-medium text-gray-900">{order.id.slice(0, 8)}</p>
                </div>
                <div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                    order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {order.status.toUpperCase()}
                  </span>
                </div>
              </div>
              <div className="px-6 py-4">
                <ul className="divide-y divide-gray-200">
                  {order.items.map((item) => (
                    <li key={item.id} className="py-4 flex items-center">
                      <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border border-gray-200">
                        {item.product.images && item.product.images[0] ? (
                          <img
                            src={item.product.images[0]}
                            alt={item.product.title}
                            className="h-full w-full object-cover object-center"
                          />
                        ) : (
                          <div className="h-full w-full bg-gray-200 flex items-center justify-center text-gray-500">
                            📦
                          </div>
                        )}
                      </div>
                      <div className="ml-4 flex-1">
                        <h4 className="text-sm font-medium text-gray-900">{item.product.title}</h4>
                        <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                        <p className="text-sm font-medium text-gray-900">₹{Number(item.price).toFixed(2)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
