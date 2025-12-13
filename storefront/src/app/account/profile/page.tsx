'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';

export default function ProfilePage() {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h1 className="text-2xl font-bold mb-6">My Profile</h1>
      
      <div className="space-y-6 max-w-lg">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            First Name
          </label>
          <div className="p-3 bg-gray-50 rounded-md border border-gray-200 text-gray-900">
            {user.firstName}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Last Name
          </label>
          <div className="p-3 bg-gray-50 rounded-md border border-gray-200 text-gray-900">
            {user.lastName}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email Address
          </label>
          <div className="p-3 bg-gray-50 rounded-md border border-gray-200 text-gray-900">
            {user.email}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Role
          </label>
          <div className="p-3 bg-gray-50 rounded-md border border-gray-200 text-gray-900 capitalize">
            {user.role}
          </div>
        </div>
      </div>
    </div>
  );
}
