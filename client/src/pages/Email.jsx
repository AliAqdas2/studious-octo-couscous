import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '../utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mail, Send, FileText, RefreshCw, ExternalLink, Plus } from 'lucide-react';
import { toast } from 'sonner';
import CreateDraftDialog from '@/components/email/CreateDraftDialog';
import EmailTemplateDialog from '@/components/email/EmailTemplateDialog';
import ExtractLeadPreviewModal from '@/components/email/ExtractLeadPreviewModal';
import EmailViewModal from '@/components/email/EmailViewModal';

export default function Email() {
  const navigate = useNavigate();
  const [selectedLead, setSelectedLead] = useState(null);
  const [showDraftDialog, setShowDraftDialog] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [syncedEmails, setSyncedEmails] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showTemplatePreview, setShowTemplatePreview] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState(null);

  // Handle URL parameters for opening draft dialog
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const leadId = urlParams.get('leadId');
    const openDraft = urlParams.get('openDraft');
    
    if (leadId && openDraft === 'true') {
      // Fetch the lead and open draft dialog
      base44.entities.Lead.filter({ id: leadId }).then(leads => {
        if (leads.length > 0) {
          setSelectedLead(leads[0]);
          setShowDraftDialog(true);
        }
      });
    }
  }, []);

  const { data: leads = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list('-created_date'),
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['email-templates'],
    queryFn: () => base44.entities.EmailTemplate.list(),
  });

  const syncEmailsMutation = useMutation({
    mutationFn: async (leadEmail) => {
      const response = await base44.functions.invoke('syncGmailEmails', { leadEmail });
      return response.data;
    },
    onSuccess: (data) => {
      setSyncedEmails(data.emails || []);
    },
    onError: () => {
      setSyncedEmails([]);
      toast.error('Failed to load emails. Make sure Gmail is connected.');
    }
  });

  const handleLeadSelect = (lead) => {
    setSelectedLead(lead);
    setSyncedEmails([]);
    setSelectedEmail(null);
    if (!lead?.email) {
      toast.error('This lead has no email address');
      return;
    }
    syncEmailsMutation.mutate(lead.email);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-[#C84B31] mb-2">Email Management</h1>
          <p className="text-gray-600">Create Gmail drafts and view email conversations</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setShowTemplateDialog(true)}
            variant="outline"
          >
            <FileText className="w-4 h-4 mr-2" />
            Manage Templates
          </Button>
          <Button
            onClick={() => setShowDraftDialog(true)}
            className="bg-gradient-to-r from-[#C84B31] to-[#E8B55F] hover:opacity-90 text-white"
          >
            <Send className="w-4 h-4 mr-2" />
            Create Draft
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Lead Selection */}
            <Card className="bg-white/80 backdrop-blur-sm border-orange-100 lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-[#C84B31]" />
                  Select Lead
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {leads.map(lead => (
                    <button
                      key={lead.id}
                      onClick={() => handleLeadSelect(lead)}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        selectedLead?.id === lead.id
                          ? 'bg-orange-50 border-[#C84B31]'
                          : 'bg-white border-gray-200 hover:bg-orange-50'
                      }`}
                    >
                      <p className="font-medium text-gray-900">{lead.name}</p>
                      <p className="text-sm text-gray-600">{lead.email}</p>
                      {lead.company && (
                        <p className="text-xs text-gray-500 mt-1">{lead.company}</p>
                      )}
                    </button>
                  ))}
                  {leads.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-8">No leads yet</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Email Thread */}
            <Card className="bg-white/80 backdrop-blur-sm border-orange-100 lg:col-span-2">
              <CardHeader>
                <CardTitle>
                  {selectedLead ? `Email Thread: ${selectedLead.name}` : 'Select a lead'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!selectedLead ? (
                  <div className="text-center py-12">
                    <Mail className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">Select a lead to view email history</p>
                  </div>
                ) : syncEmailsMutation.isPending || syncEmailsMutation.isLoading ? (
                  <div className="text-center py-12">
                    <RefreshCw className="w-8 h-8 text-[#C84B31] animate-spin mx-auto mb-4" />
                    <p className="text-gray-500">Loading emails...</p>
                  </div>
                ) : syncEmailsMutation.isError ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500 mb-4">Could not load emails for this lead.</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => syncEmailsMutation.mutate(selectedLead.email)}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Try again
                    </Button>
                  </div>
                ) : syncedEmails.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500 mb-4">No email history found</p>
                    <Button
                      onClick={() => setShowDraftDialog(true)}
                      size="sm"
                      className="bg-[#C84B31]"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Send First Email
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[600px] overflow-y-auto">
                    {syncedEmails.map(email => (
                      <div
                        key={email.id}
                        onClick={() => setSelectedEmail(email)}
                        className="p-4 border border-gray-200 rounded-lg hover:bg-orange-50 hover:border-[#C84B31]/40 transition-all cursor-pointer"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900">{email.subject}</h4>
                            <p className="text-sm text-gray-600 mt-1">
                              From: {email.from}
                            </p>
                            <p className="text-sm text-gray-600">
                              To: {email.to}
                            </p>
                          </div>
                          <a
                            href={`https://mail.google.com/mail/u/0/#all/${email.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                        <p className="text-sm text-gray-700 mt-2 line-clamp-2">{email.snippet}</p>
                        <p className="text-xs text-gray-500 mt-2">{email.date}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

      {/* Email Templates */}
      <Card className="bg-white/80 backdrop-blur-sm border-orange-100">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Email Templates</CardTitle>
            <Button
              size="sm"
              onClick={() => setShowTemplateDialog(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              New Template
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label>Select Template</Label>
                <Select
                  value={selectedTemplate?.id || ''}
                  onValueChange={(value) => {
                    const template = templates.find(t => t.id === value);
                    setSelectedTemplate(template);
                    setShowTemplatePreview(true);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a template to view..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.filter(t => t.is_active).map(template => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.template_name} ({template.category})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {templates.filter(t => t.is_active).length === 0 && (
              <p className="text-sm text-gray-500 text-center py-8">
                No templates yet. Create your first template to get started.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {showDraftDialog && (
        <CreateDraftDialog
          lead={selectedLead}
          templates={templates}
          onClose={() => setShowDraftDialog(false)}
        />
      )}

      {showTemplateDialog && (
        <EmailTemplateDialog onClose={() => setShowTemplateDialog(false)} />
      )}

      {selectedEmail && (
        <EmailViewModal
          email={selectedEmail}
          lead={selectedLead}
          onClose={() => setSelectedEmail(null)}
        />
      )}

      {showTemplatePreview && selectedTemplate && (
        <Dialog open={showTemplatePreview} onOpenChange={setShowTemplatePreview}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedTemplate.template_name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Badge>{selectedTemplate.category}</Badge>
                {selectedTemplate.send_automatically && (
                  <Badge variant="secondary" className="ml-2">Auto-Send</Badge>
                )}
              </div>
              
              <div>
                <Label className="text-sm font-semibold">Subject:</Label>
                <p className="mt-1 p-3 bg-orange-50 rounded-lg text-sm">{selectedTemplate.subject}</p>
              </div>
              
              <div>
                <Label className="text-sm font-semibold">Body:</Label>
                <p className="mt-1 p-3 bg-orange-50 rounded-lg text-sm whitespace-pre-wrap">{selectedTemplate.body}</p>
              </div>

              {selectedTemplate.conditions && Object.keys(selectedTemplate.conditions).length > 0 && (
                <div>
                  <Label className="text-sm font-semibold">Conditions:</Label>
                  <div className="mt-1 p-3 bg-gray-50 rounded-lg text-xs space-y-1">
                    {selectedTemplate.conditions.channel && (
                      <p><strong>Channel:</strong> {selectedTemplate.conditions.channel}</p>
                    )}
                    {selectedTemplate.conditions.event_types && (
                      <p><strong>Event Types:</strong> {selectedTemplate.conditions.event_types.join(', ')}</p>
                    )}
                    {selectedTemplate.conditions.min_headcount && (
                      <p><strong>Min Headcount:</strong> {selectedTemplate.conditions.min_headcount}</p>
                    )}
                    {selectedTemplate.conditions.max_headcount && (
                      <p><strong>Max Headcount:</strong> {selectedTemplate.conditions.max_headcount}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}