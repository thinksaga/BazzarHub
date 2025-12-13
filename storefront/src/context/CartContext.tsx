'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  product: {
    id: string;
    title: string;
    price: number;
    images: string[];
  };
}

interface CartContextType {
  items: CartItem[];
  addToCart: (productId: string, quantity?: number) => Promise<void>;
  removeFromCart: (itemId: string) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  loading: boolean;
}

const CartContext = createContext<CartContextType>({
  items: [],
  addToCart: async () => {},
  removeFromCart: async () => {},
  updateQuantity: async () => {},
  loading: false,
});

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const { token, isAuthenticated } = useAuth();

  useEffect(() => {
    const fetchCart = async () => {
      try {
        setLoading(true);
        const res = await fetch('http://localhost:5004/api/cart', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setItems(data.items || []);
        }
      } catch (error) {
        console.error('Failed to fetch cart', error);
      } finally {
        setLoading(false);
      }
    };

    if (isAuthenticated && token) {
      fetchCart();
    } else {
      setItems([]);
    }
  }, [isAuthenticated, token]);

  const addToCart = async (productId: string, quantity: number = 1) => {
    if (!isAuthenticated) {
      alert('Please login to add items to cart');
      return;
    }

    try {
      const res = await fetch('http://localhost:5004/api/cart/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ productId, quantity }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        alert('Added to cart!');
      }
    } catch (error) {
      console.error('Failed to add to cart', error);
    }
  };

  const removeFromCart = async (itemId: string) => {
    try {
      const res = await fetch(`http://localhost:5004/api/cart/items/${itemId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch (error) {
      console.error('Failed to remove from cart', error);
    }
  };

  const updateQuantity = async (itemId: string, quantity: number) => {
    try {
      const res = await fetch(`http://localhost:5004/api/cart/items/${itemId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ quantity }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch (error) {
      console.error('Failed to update quantity', error);
    }
  };

  return (
    <CartContext.Provider value={{ items, addToCart, removeFromCart, updateQuantity, loading }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
