'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

interface Attribute {
  key: string;
  value: string;
}

export default function CreateProductPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    inventory: '',
    category: '',
    images: '' // Comma separated URLs for now
  });

  const [attributes, setAttributes] = useState<Attribute[]>([]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const addAttribute = () => {
    setAttributes([...attributes, { key: '', value: '' }]);
  };

  const updateAttribute = (index: number, field: 'key' | 'value', value: string) => {
    const newAttributes = [...attributes];
    newAttributes[index][field] = value;
    setAttributes(newAttributes);
  };

  const removeAttribute = (index: number) => {
    setAttributes(attributes.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const attributesObj = attributes.reduce((acc, curr) => {
        if (curr.key.trim() && curr.value.trim()) {
          acc[curr.key.trim()] = curr.value.trim();
        }
        return acc;
      }, {} as Record<string, string>);

      const productData = {
        ...formData,
        price: parseFloat(formData.price),
        inventory: parseInt(formData.inventory),
        images: formData.images.split(',').map(url => url.trim()).filter(url => url.length > 0),
        attributes: attributesObj
      };

      const res = await fetch('http://localhost:5004/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(productData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create product');
      }

      router.push('/dashboard/products');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="md:flex md:items-center md:justify-between mb-8">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
            Add New Product
          </h2>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8 bg-white p-8 rounded-lg shadow">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded relative">
            {error}
          </div>
        )}

        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium leading-6 text-gray-900">Basic Information</h3>
            <p className="mt-1 text-sm text-gray-500">
              This information will be displayed publicly so be careful what you share.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
            <div className="sm:col-span-4">
              <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                Product Title
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  name="title"
                  id="title"
                  required
                  value={formData.title}
                  onChange={handleChange}
                  className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                />
              </div>
            </div>

            <div className="sm:col-span-6">
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                Description
              </label>
              <div className="mt-1">
                <textarea
                  id="description"
                  name="description"
                  rows={3}
                  required
                  value={formData.description}
                  onChange={handleChange}
                  className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border border-gray-300 rounded-md"
                />
              </div>
            </div>

            <div className="sm:col-span-3">
              <label htmlFor="category" className="block text-sm font-medium text-gray-700">
                Category
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  name="category"
                  id="category"
                  required
                  value={formData.category}
                  onChange={handleChange}
                  className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-gray-200">
          <div>
            <h3 className="text-lg font-medium leading-6 text-gray-900">Pricing & Inventory</h3>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
            <div className="sm:col-span-3">
              <label htmlFor="price" className="block text-sm font-medium text-gray-700">
                Price (INR)
              </label>
              <div className="mt-1">
                <input
                  type="number"
                  name="price"
                  id="price"
                  min="0"
                  step="0.01"
                  required
                  value={formData.price}
                  onChange={handleChange}
                  className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                />
              </div>
            </div>

            <div className="sm:col-span-3">
              <label htmlFor="inventory" className="block text-sm font-medium text-gray-700">
                Inventory Count
              </label>
              <div className="mt-1">
                <input
                  type="number"
                  name="inventory"
                  id="inventory"
                  min="0"
                  required
                  value={formData.inventory}
                  onChange={handleChange}
                  className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-gray-200">
          <div>
            <h3 className="text-lg font-medium leading-6 text-gray-900">Media</h3>
          </div>
          <div className="mt-6">
            <label htmlFor="images" className="block text-sm font-medium text-gray-700">
              Image URLs (comma separated)
            </label>
            <div className="mt-1">
              <input
                type="text"
                name="images"
                id="images"
                value={formData.images}
                onChange={handleChange}
                placeholder="https://example.com/image1.jpg, https://example.com/image2.jpg"
                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
              />
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Enter direct URLs to your product images.
            </p>
          </div>
        </div>

        <div className="pt-8 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium leading-6 text-gray-900">Attributes</h3>
            <button
              type="button"
              onClick={addAttribute}
              className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-full shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Add Attribute
            </button>
          </div>
          <div className="mt-6 space-y-4">
            {attributes.map((attr, index) => (
              <div key={index} className="flex items-center gap-4">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Name (e.g. Color)"
                    value={attr.key}
                    onChange={(e) => updateAttribute(index, 'key', e.target.value)}
                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  />
                </div>
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Value (e.g. Red)"
                    value={attr.value}
                    onChange={(e) => updateAttribute(index, 'value', e.target.value)}
                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeAttribute(index)}
                  className="text-red-600 hover:text-red-800"
                >
                  Remove
                </button>
              </div>
            ))}
            {attributes.length === 0 && (
              <p className="text-sm text-gray-500 italic">No attributes added yet.</p>
            )}
          </div>
        </div>

        <div className="pt-5">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => router.back()}
              className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Product'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
