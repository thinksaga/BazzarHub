export default function Dashboard() {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Admin Dashboard
        </h1>
        <p className="text-gray-600 mt-2">Platform management and monitoring</p>
        
        <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Placeholder cards */}
          {[
            { title: 'Total Vendors', value: '0', color: 'bg-blue-500' },
            { title: 'Total Orders', value: '0', color: 'bg-green-500' },
            { title: 'Total Revenue', value: '₹0', color: 'bg-purple-500' },
            { title: 'Pending KYC', value: '0', color: 'bg-orange-500' },
          ].map((card) => (
            <div key={card.title} className="bg-white rounded-lg shadow p-6">
              <div className={`${card.color} text-white w-12 h-12 rounded-lg flex items-center justify-center mb-4`}>
                📈
              </div>
              <h3 className="text-gray-600 text-sm font-medium">{card.title}</h3>
              <p className="text-2xl font-bold text-gray-900 mt-2">{card.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
