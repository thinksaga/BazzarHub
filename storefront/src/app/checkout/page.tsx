'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function CheckoutPage() {
  const { items, loading: cartLoading } = useCart();
  const { user, token } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [address, setAddress] = useState({
    street: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'India'
  });

  const total = items.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAddress({ ...address, [e.target.name]: e.target.value });
  };

  const handlePayment = async () => {
    if (!user || !token) {
      alert('Please login to continue');
      router.push('/login');
      return;
    }

    setLoading(true);
    try {
      // 1. Create Order in Backend
      const orderRes = await fetch('http://localhost:5004/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          items: items.map(item => ({
            productId: item.productId,
            quantity: item.quantity
          })),
          shippingAddress: address,
          billingAddress: address
        })
      });

      if (!orderRes.ok) throw new Error('Failed to create order');
      const orderData = await orderRes.json();

      // 2. Create Razorpay Order
      const paymentRes = await fetch('http://localhost:5004/api/payment/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: total,
          currency: 'INR',
          receipt: orderData.id
        })
      });

      if (!paymentRes.ok) throw new Error('Failed to initiate payment');
      const paymentData = await paymentRes.json();

      // 3. Open Razorpay Checkout
      const options = {
        key: paymentData.data.key_id,
        amount: paymentData.data.amount,
        currency: paymentData.data.currency,
        name: "BazaarHub",
        description: "Order Payment",
        order_id: paymentData.data.order_id,
        handler: async function (response: any) {
          // 4. Verify Payment
          const verifyRes = await fetch('http://localhost:5004/api/payment/verify', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              order_id: response.razorpay_order_id,
              payment_id: response.razorpay_payment_id,
              signature: response.razorpay_signature
            })
          });

          if (verifyRes.ok) {
            alert('Payment Successful!');
            router.push('/account/orders');
          } else {
            alert('Payment Verification Failed');
          }
        },
        prefill: {
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
        },
        theme: {
          color: "#F37254"
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();

    } catch (error) {
      console.error('Checkout failed', error);
      alert('Checkout failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (cartLoading) return <div>Loading...</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Checkout</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Shipping Address */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Shipping Address</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Street Address</label>
              <input
                type="text"
                name="street"
                value={address.street}
                onChange={handleAddressChange}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">City</label>
                <input
                  type="text"
                  name="city"
                  value={address.city}
                  onChange={handleAddressChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">State</label>
                <input
                  type="text"
                  name="state"
                  value={address.state}
                  onChange={handleAddressChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">ZIP Code</label>
                <input
                  type="text"
                  name="zipCode"
                  value={address.zipCode}
                  onChange={handleAddressChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Country</label>
                <input
                  type="text"
                  name="country"
                  value={address.country}
                  disabled
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 bg-gray-50"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Order Summary */}
        <div className="bg-white p-6 rounded-lg shadow-md h-fit">
          <h2 className="text-xl font-semibold mb-4">Order Summary</h2>
          <div className="flow-root">
            <ul className="divide-y divide-gray-200 mb-4">
              {items.map((item) => (
                <li key={item.id} className="py-4 flex justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.product.title}</p>
                    <p className="text-sm text-gray-500">Qty {item.quantity}</p>
                  </div>
                  <p className="text-sm font-medium text-gray-900">₹{(item.product.price * item.quantity).toFixed(2)}</p>
                </li>
              ))}
            </ul>
            <div className="border-t border-gray-200 pt-4">
              <div className="flex justify-between text-base font-medium text-gray-900">
                <p>Total</p>
                <p>₹{total.toFixed(2)}</p>
              </div>
            </div>
            <button
              onClick={handlePayment}
              disabled={loading}
              className="mt-6 w-full bg-indigo-600 border border-transparent rounded-md shadow-sm py-3 px-4 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Pay Now'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
