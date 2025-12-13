'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';

interface PayoutSummary {
  totalEarnings: number;
  pendingPayouts: number;
  payoutCount: number;
}

interface Payout {
  id: string;
  net_payout: number;
  gross_amount: number;
  commission_amount: number;
  status: string;
  created_at: string;
  transfer_id?: string;
}

export default function EarningsPage() {
  const { token } = useAuth();
  const [summary, setSummary] = useState<PayoutSummary | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      const fetchData = async () => {
        try {
          const [summaryRes, payoutsRes] = await Promise.all([
            fetch('http://localhost:5004/api/payouts/summary', {
              headers: { 'Authorization': `Bearer ${token}` }
            }),
            fetch('http://localhost:5004/api/payouts', {
              headers: { 'Authorization': `Bearer ${token}` }
            })
          ]);

          if (summaryRes.ok) {
            setSummary(await summaryRes.json());
          }
          if (payoutsRes.ok) {
            setPayouts(await payoutsRes.json());
          }
        } catch (error) {
          console.error('Failed to fetch earnings data', error);
        } finally {
          setLoading(false);
        }
      };

      fetchData();
    }
  }, [token]);

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="mt-2 text-gray-500">Loading earnings data...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Earnings & Payouts</h1>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 mb-8">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">Total Earnings</dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">
              ₹{summary?.totalEarnings.toFixed(2) || '0.00'}
            </dd>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">Pending Payouts</dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">
              ₹{summary?.pendingPayouts.toFixed(2) || '0.00'}
            </dd>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">Total Payouts</dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">
              {summary?.payoutCount || 0}
            </dd>
          </div>
        </div>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Payout History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Commission
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Net Payout
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reference ID
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {payouts.map((payout) => (
                <tr key={payout.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(payout.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ₹{payout.gross_amount.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                    -₹{payout.commission_amount.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                    ₹{payout.net_payout.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      payout.status === 'completed' ? 'bg-green-100 text-green-800' :
                      payout.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {payout.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {payout.transfer_id || '-'}
                  </td>
                </tr>
              ))}
              {payouts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                    No payout history found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
