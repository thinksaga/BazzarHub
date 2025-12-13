import React from 'react';

export default function ProductDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-gray-200 h-96 rounded-lg flex items-center justify-center">
          <span className="text-gray-500">Product Image Placeholder</span>
        </div>
        <div>
          <h1 className="text-3xl font-bold mb-4">Product Title {params.id}</h1>
          <p className="text-2xl text-indigo-600 font-bold mb-4">₹999.00</p>
          <p className="text-gray-600 mb-6">
            This is a detailed description of the product. It highlights the key features and benefits.
          </p>
          <button className="bg-indigo-600 text-white px-8 py-3 rounded-lg hover:bg-indigo-700 transition-colors">
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}
