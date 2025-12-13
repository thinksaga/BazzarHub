'use client';

export default function Hero() {
  return (
    <div className="bg-gradient-to-r from-orange-500 to-red-500 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center text-white">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Welcome to BazaarHub
          </h1>
          <p className="text-xl mb-8 opacity-90">
            Shop from India's most trusted multivendor marketplace
          </p>
          <div className="flex justify-center gap-4">
            <button className="bg-white text-orange-500 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100">
              Shop Now
            </button>
            <button className="border border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:bg-opacity-10">
              Become a Seller
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
