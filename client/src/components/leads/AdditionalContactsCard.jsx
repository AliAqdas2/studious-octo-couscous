import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pencil, X } from 'lucide-react';
import AdditionalContactsList from './AdditionalContactsList';
import AdditionalContactsEditor from './AdditionalContactsEditor';

/**
 * View + edit card for a lead's additional contacts.
 * Props:
 *  - lead: lead object (uses lead.additional_contacts)
 *  - canEdit: boolean (only admins should be able to edit)
 *  - onSave: (contacts: array) => void  — called with the cleaned array when user clicks save
 *  - isSaving: boolean
 */
export default function AdditionalContactsCard({ lead, canEdit, onSave, isSaving }) {
  const initialContacts = Array.isArray(lead?.additional_contacts) ? lead.additional_contacts : [];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialContacts);

  // Sync draft when underlying lead data changes (e.g., after save) and we are not editing.
  useEffect(() => {
    if (!editing) setDraft(initialContacts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(initialContacts), editing]);

  const handleStartEdit = () => {
    setDraft(initialContacts);
    setEditing(true);
  };

  const handleCancel = () => {
    setDraft(initialContacts);
    setEditing(false);
  };

  const handleSave = () => {
    const cleaned = draft.filter(
      (c) => (c.name && c.name.trim()) || (c.email && c.email.trim()) || (c.phone && c.phone.trim()) || (c.role && c.role.trim())
    );
    onSave(cleaned);
    setEditing(false);
  };

  const count = initialContacts.length;

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-orange-100">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Key Contacts</span>
          <div className="flex items-center gap-3">
            <span className="text-xs font-normal text-gray-500">
              {count} contact{count === 1 ? '' : 's'}
            </span>
            {canEdit && !editing && (
              <Button size="sm" variant="outline" onClick={handleStartEdit} className="h-8">
                <Pencil className="w-3.5 h-3.5 mr-1.5" />
                {count === 0 ? 'Add' : 'Edit'}
              </Button>
            )}
            {canEdit && editing && (
              <Button size="sm" variant="ghost" onClick={handleCancel} className="h-8 text-gray-500">
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="space-y-4">
            <AdditionalContactsEditor contacts={draft} onChange={setDraft} />
            <div className="flex justify-end gap-2 pt-2 border-t border-orange-100">
              <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="bg-gradient-to-r from-[#C84B31] to-[#E8B55F] text-white"
              >
                {isSaving ? 'Saving...' : 'Save Contacts'}
              </Button>
            </div>
          </div>
        ) : (
          <AdditionalContactsList contacts={initialContacts} />
        )}
      </CardContent>
    </Card>
  );
}