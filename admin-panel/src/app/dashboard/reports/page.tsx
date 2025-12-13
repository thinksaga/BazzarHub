'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';

interface FinanceStats {
  totalPaid: number;
  pendingAmount: number;
  totalTransactions: number;
}

interface Payout {
  id: string;
  vendor_id: string;
  net_payout: number;
  status: string;
  created_at: string;
  payout_type: string;
  vendor?: {
    account_holder_name: string;
    user?: {
      email: string;
    }
  }
}

export default function FinancialReportsPage() {
  const { token } = useAuth();
  const [stats, setStats] = useState<FinanceStats | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  
  // GST Report State
  const [gstVendorId, setGstVendorId] = useState('');
  const [gstMonth, setGstMonth] = useState(new Date().getMonth() + 1);
  const [gstYear, setGstYear] = useState(new Date().getFullYear());
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, payoutsRes] = await Promise.all([
          fetch('http://localhost:5004/api/admin/finance/stats', {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch('http://localhost:5004/api/admin/finance/payouts', {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        ]);

        if (statsRes.ok) {
          setStats(await statsRes.json());
        }
        if (payoutsRes.ok) {
          setPayouts(await payoutsRes.json());
        }
      } catch (error) {
        console.error('Failed to fetch financial data', error);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchData();
    }
  }, [token]);

  const generateReport = async (type: 'gstr1' | 'gstr3b') => {
    if (!gstVendorId) {
      alert('Please enter a Vendor ID');
      return;
    }
    
    setReportLoading(true);
    try {
      const res = await fetch(`http://localhost:5004/api/admin/gst/${type}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          vendorId: gstVendorId,
          month: gstMonth,
          year: gstYear
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        console.log('Report generated:', data);
        alert(`${type.toUpperCase()} Report Generated Successfully! Check console for data.`);
        // In a real app, we would trigger a file download here
      } else {
        alert('Failed to generate report');
      }
    } catch (error) {
      console.error('Error generating report', error);
      alert('Error generating report');
    } finally {
      setReportLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading financial reports...</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Financial Reports</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 mb-8">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">Total Payouts</dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">
              ₹{stats?.totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </dd>
          </div>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">Pending Amount</dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">
              ₹{stats?.pendingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </dd>
          </div>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">Total Transactions</dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">
              {stats?.totalTransactions}
            </dd>
          </div>
        </div>
      </div>

      {/* Payouts Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-8">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Recent Transactions</h3>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Vendor
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {payouts.map((payout) => (
              <tr key={payout.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(payout.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div>
                    <div className="font-medium text-gray-900">{payout.vendor?.account_holder_name || 'Unknown Vendor'}</div>
                    <div className="text-xs text-gray-400">{payout.vendor?.user?.email || payout.vendor_id}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                  {payout.payout_type}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  ₹{payout.net_payout.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    payout.status === 'completed' ? 'bg-green-100 text-green-800' : 
                    payout.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                    'bg-red-100 text-red-800'
                  }`}>
                    {payout.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* GST Reports Section */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg p-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">GST Reports Generation</h3>
        <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
          <div className="sm:col-span-2">
            <label htmlFor="vendor_id" className="block text-sm font-medium text-gray-700">Vendor ID</label>
            <input 
              type="text" 
              id="vendor_id" 
              value={gstVendorId}
              onChange={(e) => setGstVendorId(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" 
              placeholder="Enter Vendor ID" 
            />
          </div>
          <div className="sm:col-span-1">
            <label htmlFor="month" className="block text-sm font-medium text-gray-700">Month</label>
            <select 
              id="month" 
              value={gstMonth}
              onChange={(e) => setGstMonth(Number(e.target.value))}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            >
              {[...Array(12)].map((_, i) => (
                <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-1">
            <label htmlFor="year" className="block text-sm font-medium text-gray-700">Year</label>
            <input 
              type="number" 
              id="year" 
              value={gstYear}
              onChange={(e) => setGstYear(Number(e.target.value))}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" 
            />
          </div>
          <div className="sm:col-span-2 flex items-end space-x-3">
            <button 
              onClick={() => generateReport('gstr1')}
              disabled={reportLoading}
              className="bg-indigo-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {reportLoading ? '...' : 'GSTR-1'}
            </button>
            <button 
              onClick={() => generateReport('gstr3b')}
              disabled={reportLoading}
              className="bg-green-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
            >
              {reportLoading ? '...' : 'GSTR-3B'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
