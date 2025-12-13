'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

interface Product {
  title: string;
  images: string[];
}

interface OrderItem {
  id: string;
  quantity: number;
  price: number;
  product: Product;
  vendorId: string;
  status: string;
}

interface ShippingAddress {
  fullName: string;
  addressLine1: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  phone: string;
}

interface Order {
  id: string;
  totalAmount: number;
  status: string;
  createdAt: string;
  items: OrderItem[];
  shippingAddress: ShippingAddress;
}

export default function OrderDetailsPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { token, user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (token && params.id) {
      fetch(`http://localhost:5004/api/orders/${params.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
        .then((res) => {
          if (!res.ok) throw new Error('Failed to fetch order');
          return res.json();
        })
        .then((data) => {
          setOrder(data);
          setLoading(false);
        })
        .catch((err) => {
          console.error('Failed to fetch order', err);
          setLoading(false);
        });
    }
  }, [token, params.id]);

  const handleStatusChange = async (itemId: string, newStatus: string) => {
    setUpdating(itemId);
    try {
      const res = await fetch(`http://localhost:5004/api/orders/items/${itemId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!res.ok) throw new Error('Failed to update status');

      // Update local state
      if (order) {
        const updatedItems = order.items.map(item => 
          item.id === itemId ? { ...item, status: newStatus } : item
        );
        setOrder({ ...order, items: updatedItems });
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status');
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="mt-2 text-gray-500">Loading order details...</p>
      </div>
    );
  }

  if (!order) {
    return <div className="p-8 text-center text-red-600">Order not found</div>;
  }

  // Filter items to show only those belonging to this vendor
  const vendorItems = order.items.filter(item => item.vendorId === user?.id);

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Order #{order.id.substring(0, 8)}</h1>
          <p className="text-sm text-gray-500">
            Placed on {new Date(order.createdAt).toLocaleDateString()}
          </p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
          order.status === 'completed' ? 'bg-green-100 text-green-800' : 
          order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {order.status.toUpperCase()}
        </span>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-8">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Items Ordered</h3>
        </div>
        <ul className="divide-y divide-gray-200">
          {vendorItems.map((item) => (
            <li key={item.id} className="px-4 py-4 sm:px-6 flex items-center">
              <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border border-gray-200">
                {item.product.images && item.product.images[0] ? (
                  <img
                    src={item.product.images[0]}
                    alt={item.product.title}
                    className="h-full w-full object-cover object-center"
                  />
                ) : (
                  <div className="h-full w-full bg-gray-100 flex items-center justify-center text-xs text-gray-400">No Img</div>
                )}
              </div>
              <div className="ml-4 flex-1">
                <div className="flex justify-between">
                  <h4 className="text-sm font-medium text-gray-900">{item.product.title}</h4>
                  <p className="text-sm font-medium text-gray-900">₹{item.price}</p>
                </div>
                <div className="mt-1 flex justify-between items-center">
                  <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                  <div className="flex items-center">
                    <label htmlFor={`status-${item.id}`} className="sr-only">Status</label>
                    <select
                      id={`status-${item.id}`}
                      value={item.status}
                      onChange={(e) => handleStatusChange(item.id, e.target.value)}
                      disabled={updating === item.id}
                      className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                    >
                      <option value="pending">Pending</option>
                      <option value="processing">Processing</option>
                      <option value="shipped">Shipped</option>
                      <option value="delivered">Delivered</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>
              </div>
            </li>
          ))}
          {vendorItems.length === 0 && (
            <li className="px-4 py-4 text-center text-gray-500">
              No items found for your store in this order.
            </li>
          )}
        </ul>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Shipping Address</h3>
          </div>
          <div className="px-4 py-5 sm:px-6 text-sm text-gray-500">
            {order.shippingAddress ? (
              <>
                <p>{order.shippingAddress.fullName}</p>
                <p>{order.shippingAddress.addressLine1}</p>
                <p>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zipCode}</p>
                <p>{order.shippingAddress.country}</p>
              </>
            ) : (
              <p>No shipping address provided.</p>
            )}
          </div>
        </div>

        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Order Summary</h3>
          </div>
          <div className="px-4 py-5 sm:px-6">
            <div className="flex justify-between text-sm font-medium text-gray-900">
              <p>Total Amount</p>
              <p>₹{order.totalAmount}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <button
          type="button"
          onClick={() => router.back()}
          className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Back to Orders
        </button>
      </div>
    </div>
  );
}
