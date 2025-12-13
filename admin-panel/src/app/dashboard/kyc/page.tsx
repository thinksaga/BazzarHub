'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';

interface VendorAccount {
  id: string;
  vendor_id: string;
  account_number: string;
  ifsc_code: string;
  account_holder_name: string;
  status: string;
  pan_number: string;
  gstin: string;
  created_at: string;
  user: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
}

export default function KYCRequestsPage() {
  const { token } = useAuth();
  const [vendors, setVendors] = useState<VendorAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchPendingVendors = async () => {
    try {
      // Fetch pending and under_review vendors
      // Since the API might not support OR queries easily, we might need to fetch all or filter client side if volume is low
      // For now, let's try fetching all and filtering
      const res = await fetch('http://localhost:5004/api/vendors', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      
      if (Array.isArray(data)) {
        const pending = data.filter((v: VendorAccount) => 
          v.status === 'pending' || v.status === 'under_review'
        );
        setVendors(pending);
      }
    } catch (error) {
      console.error('Failed to fetch vendors', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchPendingVendors();
    }
  }, [token]);

  const handleStatusUpdate = async (id: string, status: 'verified' | 'rejected') => {
    if (!confirm(`Are you sure you want to mark this vendor as ${status}?`)) return;
    
    setProcessing(id);
    try {
      const res = await fetch(`http://localhost:5004/api/vendors/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });

      if (res.ok) {
        // Remove from list
        setVendors(vendors.filter(v => v.id !== id));
      } else {
        alert('Failed to update status');
      }
    } catch (error) {
      console.error('Error updating status', error);
      alert('Error updating status');
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-400">Loading KYC requests...</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white mb-6">KYC Verification Requests</h1>

      <div className="bg-gray-800 shadow overflow-hidden sm:rounded-lg">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-gray-900">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Vendor Details
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Business Info
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Bank Details
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-gray-800 divide-y divide-gray-700">
            {vendors.map((vendor) => (
              <tr key={vendor.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-white">
                    {vendor.user?.firstName} {vendor.user?.lastName}
                  </div>
                  <div className="text-sm text-gray-400">{vendor.user?.email}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Applied: {new Date(vendor.created_at).toLocaleDateString()}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-300">Name: {vendor.account_holder_name}</div>
                  <div className="text-sm text-gray-300">GSTIN: {vendor.gstin}</div>
                  <div className="text-sm text-gray-300">PAN: {vendor.pan_number}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-300">Acc: {vendor.account_number}</div>
                  <div className="text-sm text-gray-300">IFSC: {vendor.ifsc_code}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    vendor.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {vendor.status.toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                  <button
                    onClick={() => handleStatusUpdate(vendor.id, 'verified')}
                    disabled={processing === vendor.id}
                    className="text-green-400 hover:text-green-300 disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleStatusUpdate(vendor.id, 'rejected')}
                    disabled={processing === vendor.id}
                    className="text-red-400 hover:text-red-300 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </td>
              </tr>
            ))}
            {vendors.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 text-center">
                  No pending KYC requests found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
