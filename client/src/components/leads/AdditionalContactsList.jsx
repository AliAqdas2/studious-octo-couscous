import React from 'react';
import { Mail, Phone, User, Briefcase } from 'lucide-react';

/**
 * Read-only display of additional contacts.
 * Props:
 *  - contacts: array of { name, email, phone, role }
 */
export default function AdditionalContactsList({ contacts = [] }) {
  if (!contacts || contacts.length === 0) {
    return <p className="text-sm text-gray-400 italic">No key contacts.</p>;
  }

  return (
    <div className="space-y-3">
      {contacts.map((c, i) => (
        <div key={i} className="border border-orange-100 bg-orange-50/40 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-gray-500" />
              <p className="font-semibold text-gray-900">{c.name || <span className="italic text-gray-400">Unnamed</span>}</p>
            </div>
            {c.role && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-600 bg-white border border-gray-200 rounded-full px-2 py-0.5">
                <Briefcase className="w-3 h-3" />
                {c.role}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-700">
            {c.email && (
              <div className="flex items-center gap-2 min-w-0">
                <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <a href={`mailto:${c.email}`} className="truncate hover:text-[#C84B31]">{c.email}</a>
              </div>
            )}
            {c.phone && (
              <div className="flex items-center gap-2 min-w-0">
                <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <a href={`tel:${c.phone}`} className="truncate hover:text-[#C84B31]">{c.phone}</a>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}