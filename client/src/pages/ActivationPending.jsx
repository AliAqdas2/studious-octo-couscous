import React from 'react';
import { ChefHat, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ActivationPending() {
  const handleLogout = () => {
    window.location.href = '/logout';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header with logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <ChefHat className="w-16 h-16 text-[#C84B31]" />
          </div>
          <h1 className="text-2xl font-bold text-[#C84B31]">Mangia DC</h1>
          <p className="text-sm text-gray-500 mt-1">CRM & Events</p>
        </div>

        {/* Main message card */}
        <div className="bg-white rounded-xl shadow-lg p-8 text-center space-y-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-3">We're getting things ready!</h2>
            <p className="text-gray-600 leading-relaxed">
              Thanks for joining Mangia DC. We are currently reviewing your account for activation. If you're still waiting after two business days, feel free to nudge us at{' '}
              <a href="mailto:info@mangiadc.com" className="text-[#C84B31] font-semibold hover:underline">
                info@mangiadc.com
              </a>
              {' '}or{' '}
              <a href="mailto:Admin2@mangiadc.com" className="text-[#C84B31] font-semibold hover:underline">
                Admin2@mangiadc.com
              </a>
              .
            </p>
          </div>

          {/* Contact options */}
          <div className="pt-4 border-t border-gray-200 space-y-3">
            <Button
              asChild
              className="w-full bg-gradient-to-r from-[#C84B31] to-[#E8B55F] hover:opacity-90 text-white"
            >
              <a href="mailto:info@mangiadc.com" className="flex items-center justify-center gap-2">
                <Mail className="w-4 h-4" />
                Email us at info@mangiadc.com
              </a>
            </Button>
            <Button
              variant="outline"
              onClick={handleLogout}
              className="w-full border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Logout
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}