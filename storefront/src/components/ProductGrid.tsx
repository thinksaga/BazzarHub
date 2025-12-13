'use client';

export default function ProductGrid() {
  const products = [
    {
      id: 1,
      name: 'Wireless Headphones',
      price: '₹2,499',
      rating: 4.5,
      seller: 'ElectroMart',
      image: '🎧',
    },
    {
      id: 2,
      name: 'Cotton T-Shirt',
      price: '₹399',
      rating: 4.2,
      seller: 'FashionHub',
      image: '👕',
    },
    {
      id: 3,
      name: 'Coffee Maker',
      price: '₹1,799',
      rating: 4.7,
      seller: 'HomeGoods',
      image: '☕',
    },
    {
      id: 4,
      name: 'Yoga Mat',
      price: '₹599',
      rating: 4.3,
      seller: 'FitnessPro',
      image: '🧘',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {products.map((product) => (
        <div
          key={product.id}
          className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow"
        >
          <div className="bg-gradient-to-br from-gray-100 to-gray-200 p-8 text-center text-5xl">
            {product.image}
          </div>
          <div className="p-4">
            <h3 className="font-semibold text-gray-900 text-sm line-clamp-2">
              {product.name}
            </h3>
            <p className="text-orange-500 font-bold text-lg mt-2">
              {product.price}
            </p>
            <div className="flex items-center justify-between mt-3">
              <span className="text-yellow-500 text-sm">★ {product.rating}</span>
              <span className="text-gray-500 text-xs">{product.seller}</span>
            </div>
            <button className="w-full mt-4 bg-orange-500 text-white py-2 rounded-lg hover:bg-orange-600 transition-colors text-sm font-medium">
              Add to Cart
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
