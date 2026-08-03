import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function ExtractLeadPreviewModal({ data, onClose }) {
  const queryClient = useQueryClient();
  
  const isDuplicate = data?.duplicate || false;
  const existingLead = data?.existingLead || null;
  const extractedData = data?.extractedData || data?.extracted || {};
  const emailMetadata = data?.emailMetadata || {};
  
  const [formData, setFormData] = useState(extractedData);

  const createLeadMutation = useMutation({
    mutationFn: async (data) => {
      console.log("📝 [MODAL] Creating lead with data:", data);
      const currentUser = await base44.auth.me();
      
      // Create lead
      const lead = await base44.entities.Lead.create(data);
      console.log("✅ [MODAL] Lead created successfully - ID:", lead.id);

      // Log activity - fail loudly if this fails (audit trail integrity)
      await base44.entities.ActivityLog.create({
        entity_type: 'Lead',
        entity_id: lead.id,
        action: 'Created from Gmail',
        details: {
          email_subject: emailMetadata.subject,
          email_date: emailMetadata.date,
          gmail_message_id: emailMetadata.id
        },
        user_id: currentUser.id,
        user_name: currentUser.full_name,
        timestamp: new Date().toISOString()
      });

      return lead;
    },
    onSuccess: () => {
      console.log("🎉 [MODAL] Lead creation success");
      queryClient.invalidateQueries(['leads']);
      toast.success('Lead created successfully');
      onClose();
    },
    onError: (error) => {
      console.error("❌ [MODAL] Lead creation error:", error);
      toast.error('Failed to create lead: ' + error.message);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    console.log("💾 [MODAL] Submit clicked - formData:", formData);
    
    // Validation
    if (!formData.name || !formData.email) {
      console.log("⚠️ [MODAL] Validation failed - missing name or email");
      toast.error('Name and Email are required');
      return;
    }

    console.log("✅ [MODAL] Validation passed - creating lead");
    createLeadMutation.mutate(formData);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isDuplicate ? <AlertCircle className="w-5 h-5 text-amber-600" /> : <CheckCircle className="w-5 h-5 text-green-600" />}
            {isDuplicate ? 'Duplicate Lead Detected' : 'Review Extracted Lead'}
          </DialogTitle>
        </DialogHeader>

        {isDuplicate && existingLead && (
          <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-semibold text-amber-900">Lead Already Exists</h4>
                <p className="text-sm text-amber-700 mt-1">
                  A lead with email <strong>{existingLead.email}</strong> already exists in stage <strong>{existingLead.stage}</strong>.
                </p>
                <p className="text-sm text-amber-700 mt-2">
                  You can still force create a new lead if needed.
                </p>
              </div>
            </div>
          </div>
        )}

        {emailMetadata.subject && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>From:</strong> {emailMetadata.subject}
            </p>
            {emailMetadata.date && (
              <p className="text-xs text-blue-600 mt-1">{emailMetadata.date}</p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Name *</Label>
              <Input
                required
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>
            <div>
              <Label>Email *</Label>
              <Input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Company</Label>
              <Input
                value={formData.company}
                onChange={(e) => setFormData({...formData, company: e.target.value})}
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Channel</Label>
              <Badge className={formData.channel === 'B2B' ? 'bg-blue-600' : 'bg-green-600'}>
                {formData.channel}
              </Badge>
            </div>
            <div>
              <Label>Inquiry Type</Label>
              <Badge variant="outline">{formData.inquiry_type}</Badge>
            </div>
            <div>
              <Label>Headcount</Label>
              <Input
                type="number"
                value={formData.headcount_estimate || ''}
                onChange={(e) => setFormData({...formData, headcount_estimate: e.target.value ? Number(e.target.value) : null})}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Event Type Interest</Label>
              <Input
                value={formData.event_type_interest}
                onChange={(e) => setFormData({...formData, event_type_interest: e.target.value})}
              />
            </div>
            <div>
              <Label>Preferred Date</Label>
              <Input
                type="date"
                value={formData.preferred_date}
                onChange={(e) => setFormData({...formData, preferred_date: e.target.value})}
              />
            </div>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              rows={4}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={createLeadMutation.isPending}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createLeadMutation.isPending}
              className="bg-gradient-to-r from-[#C84B31] to-[#E8B55F] text-white"
            >
              {createLeadMutation.isPending ? 'Adding to Leads...' : (isDuplicate ? 'Force Add to Leads' : 'Add to Leads')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}