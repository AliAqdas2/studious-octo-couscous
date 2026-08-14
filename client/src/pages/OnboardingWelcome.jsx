import React from 'react';
import { ChefHat, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { onboardingStrings } from '@/components/onboarding/strings';

export default function OnboardingWelcome() {
  const handleLogout = () => {
    window.location.href = '/logout';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <ChefHat className="w-16 h-16 text-[#C84B31]" />
          </div>
          <h1 className="text-2xl font-bold text-[#C84B31]">Mangia DC</h1>
          <p className="text-sm text-gray-500 mt-1">Onboarding</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8 text-center space-y-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-3">
              Welcome — you&apos;re in!
            </h2>
            <p className="text-gray-600 leading-relaxed">
              {onboardingStrings.onboardingWelcomeBody}
            </p>
          </div>

          <div className="pt-4 border-t border-gray-200 space-y-3">
            <Button
              asChild
              className="w-full bg-gradient-to-r from-[#C84B31] to-[#E8B55F] hover:opacity-90 text-white"
            >
              <a
                href="mailto:info@mangiadc.com"
                className="flex items-center justify-center gap-2"
              >
                <Mail className="w-4 h-4" />
                {onboardingStrings.onboardingWelcomeContact}
              </a>
            </Button>
            <Button
              variant="outline"
              onClick={handleLogout}
              className="w-full border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              {onboardingStrings.onboardingWelcomeLogout}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
