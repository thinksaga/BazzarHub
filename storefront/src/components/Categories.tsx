'use client';

const categories = [
  { id: 1, name: 'Electronics', icon: '📱' },
  { id: 2, name: 'Fashion', icon: '👔' },
  { id: 3, name: 'Home', icon: '🏠' },
  { id: 4, name: 'Food', icon: '🍔' },
  { id: 5, name: 'Beauty', icon: '💄' },
  { id: 6, name: 'Sports', icon: '⚽' },
];

export default function Categories() {
  return (
    <div className="bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Categories</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {categories.map((category) => (
            <button
              key={category.id}
              className="bg-white p-6 rounded-lg border border-gray-200 hover:border-orange-500 hover:shadow-md transition-all text-center"
            >
              <div className="text-4xl mb-2">{category.icon}</div>
              <p className="text-sm font-medium text-gray-700">{category.name}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
