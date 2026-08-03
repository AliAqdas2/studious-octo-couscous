import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, UserPlus } from 'lucide-react';

/**
 * Editor for managing additional contact rows.
 * Props:
 *  - contacts: array of { name, email, phone, role }
 *  - onChange: (newArray) => void
 */
export default function AdditionalContactsEditor({ contacts = [], onChange }) {
  const updateContact = (index, field, value) => {
    const next = contacts.map((c, i) => (i === index ? { ...c, [field]: value } : c));
    onChange(next);
  };

  const addContact = () => {
    onChange([...contacts, { name: '', email: '', phone: '', role: '' }]);
  };

  const removeContact = (index) => {
    onChange(contacts.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-[#C84B31]" />
          Key Contacts
        </Label>
        <Button type="button" variant="outline" size="sm" onClick={addContact} className="border-[#C84B31] text-[#C84B31] hover:bg-orange-50">
          <Plus className="w-4 h-4 mr-1.5" />
          Add Key Contact
        </Button>
      </div>

      {contacts.length === 0 && (
        <p className="text-xs text-gray-500 italic">No key contacts. Click the button above to add one.</p>
      )}

      {contacts.map((contact, index) => (
        <div key={index} className="border border-orange-200 bg-orange-50/30 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-600">Contact #{index + 1}</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeContact(index)}
              className="text-red-600 hover:bg-red-50 h-7 px-2"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              Remove
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Name</Label>
              <Input
                value={contact.name || ''}
                onChange={(e) => updateContact(index, 'name', e.target.value)}
                placeholder="Full name"
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Email</Label>
              <Input
                type="email"
                value={contact.email || ''}
                onChange={(e) => updateContact(index, 'email', e.target.value)}
                placeholder="email@example.com"
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Phone</Label>
              <Input
                value={contact.phone || ''}
                onChange={(e) => updateContact(index, 'phone', e.target.value)}
                placeholder="(555) 555-5555"
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Role <span className="text-gray-400 font-normal">(optional)</span></Label>
              <Input
                value={contact.role || ''}
                onChange={(e) => updateContact(index, 'role', e.target.value)}
                placeholder="e.g. Assistant, Decision Maker"
                className="h-9"
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}