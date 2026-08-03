import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { FolderOpen, AlertCircle } from 'lucide-react';

export default function Assets() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-[#C84B31] mb-2">Assets & Drive</h1>
        <p className="text-gray-600">Google Drive integration for event photos and documents</p>
      </div>

      {/* Google Drive Integration Notice */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-blue-600 shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold text-blue-900 mb-2">Google Drive Integration Required</h3>
              <p className="text-sm text-blue-800 mb-4">
                To use automatic folder creation and photo management features, you need to authorize the Google Drive API integration.
                This will allow the CRM to create event folders and upload documents.
              </p>
              <p className="text-sm text-blue-700">
                This feature will be configured by your administrator.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Placeholder */}
      <Card className="bg-white/80 backdrop-blur-sm border-orange-100">
        <CardContent className="p-12 text-center">
          <FolderOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Drive Features Coming Soon</h2>
          <p className="text-gray-500 mb-6">
            Once Google Drive integration is set up, you'll be able to:
          </p>
          <ul className="text-left max-w-md mx-auto space-y-2 text-gray-600">
            <li>• Auto-create event folders (Mangia DC / Year / Event Name)</li>
            <li>• Upload event photos and documents</li>
            <li>• Generate shareable links for clients</li>
            <li>• Manage BEOs, menus, and event materials</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}