import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Mail, Trash2, Edit, FileText, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import EmailTemplateDialog from '@/components/email/EmailTemplateDialog';
import { ALL_STAGES } from '@/components/leads/pipelineConfig';

const CHANNEL_BADGE = {
  B2B: 'bg-blue-100 text-blue-800',
  B2C: 'bg-purple-100 text-purple-800',
  Both: 'bg-gray-100 text-gray-700',
};

const CUSTOMER_TYPE_BADGE = {
  "Doesn't matter": 'bg-gray-100 text-gray-600',
  New: 'bg-green-100 text-green-700',
  Old: 'bg-amber-100 text-amber-700',
  Referred: 'bg-teal-100 text-teal-700',
};

export default function PipelineEmailAutomations() {
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [expandedStages, setExpandedStages] = useState({});
  const [user, setUser] = useState(null);

  React.useEffect(() => { base44.auth.me().then(setUser).catch(() => {}); }, []);

  const queryClient = useQueryClient();

  const { data: emailTemplates = [], isLoading } = useQuery({
    queryKey: ['email-templates'],
    queryFn: () => base44.entities.EmailTemplate.list(),
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id) => base44.entities.EmailTemplate.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      toast.success('Template deleted');
    },
  });

  const toggleTemplateMutation = useMutation({
    mutationFn: ({ id, is_active }) => base44.entities.EmailTemplate.update(id, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
    },
  });

  const openNew = () => { setEditingTemplate(null); setTemplateDialogOpen(true); };
  const openEdit = (t) => { setEditingTemplate(t); setTemplateDialogOpen(true); };
  const closeDialog = () => { setTemplateDialogOpen(false); setEditingTemplate(null); };

  const toggleStage = (stage) => setExpandedStages(prev => ({ ...prev, [stage]: !prev[stage] }));

  if (user && user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-amber-600 mx-auto" />
            <h2 className="text-lg font-semibold">Admin Access Only</h2>
            <p className="text-sm text-gray-600">Email templates can only be managed by administrators.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Group templates by pipeline_stage, preserving ALL_STAGES order
  const templatesByStage = {};
  emailTemplates.forEach(t => {
    const stage = t.pipeline_stage || '(No Stage Assigned)';
    if (!templatesByStage[stage]) templatesByStage[stage] = [];
    templatesByStage[stage].push(t);
  });

  // Stages with templates, in the canonical order + unassigned at end
  const stagesWithTemplates = [
    ...ALL_STAGES.filter(s => templatesByStage[s]),
    ...(templatesByStage['(No Stage Assigned)'] ? ['(No Stage Assigned)'] : [])
  ];

  const unassignedCount = (templatesByStage['(No Stage Assigned)'] || []).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-bold text-[#C84B31] mb-2">Stage Email Templates</h1>
          <p className="text-gray-600">Create email templates tied to specific pipeline stages. Templates auto-fill the email draft on the Lead Details page.</p>
        </div>
        <Button onClick={openNew} className="bg-[#C84B31] hover:bg-[#A03A23] shrink-0">
          <Plus className="w-4 h-4 mr-2" />
          New Template
        </Button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-orange-100">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-[#C84B31]">{emailTemplates.length}</p>
            <p className="text-sm text-gray-600">Total Templates</p>
          </CardContent>
        </Card>
        <Card className="border-orange-100">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-700">{emailTemplates.filter(t => t.is_active).length}</p>
            <p className="text-sm text-gray-600">Active</p>
          </CardContent>
        </Card>
        <Card className="border-orange-100">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-slate-700">{stagesWithTemplates.length}</p>
            <p className="text-sm text-gray-600">Stages Covered</p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : emailTemplates.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No email templates yet</h3>
            <p className="text-gray-500 mb-6">Create templates linked to pipeline stages. They'll auto-fill the email draft when viewing a lead.</p>
            <Button onClick={openNew} className="bg-[#C84B31] hover:bg-[#A03A23]">
              <Plus className="w-4 h-4 mr-2" />New Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {stagesWithTemplates.map((stage) => {
            const templates = templatesByStage[stage] || [];
            const isExpanded = expandedStages[stage] !== false; // default open
            const activeCount = templates.filter(t => t.is_active).length;

            return (
              <Card key={stage} className="border-orange-100 overflow-hidden">
                <button
                  onClick={() => toggleStage(stage)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-orange-50/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                    <div>
                      <span className="font-semibold text-gray-900">{stage}</span>
                      {stage === '(No Stage Assigned)' && (
                        <span className="ml-2 text-xs text-amber-600 font-medium">⚠ assign a stage</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{templates.length} template{templates.length !== 1 ? 's' : ''}</Badge>
                    {activeCount > 0 && (
                      <Badge className="bg-green-100 text-green-700 border-green-200">{activeCount} active</Badge>
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-orange-100 divide-y divide-orange-50">
                    {templates.map((template) => (
                      <div key={template.id} className={`px-5 py-4 ${!template.is_active ? 'opacity-50' : ''}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="font-medium text-gray-900">{template.template_name}</span>
                              <Badge className={CHANNEL_BADGE[template.channel] || CHANNEL_BADGE.Both}>
                                {template.channel || 'Both'}
                              </Badge>
                              <Badge className={CUSTOMER_TYPE_BADGE[template.customer_type] || CUSTOMER_TYPE_BADGE["Doesn't matter"]}>
                                {template.customer_type || "Doesn't matter"}
                              </Badge>
                              {template.send_automatically && (
                                <Badge variant="outline" className="text-xs border-blue-300 text-blue-600">Auto-draft</Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 font-medium">{template.subject}</p>
                            <p className="text-sm text-gray-400 mt-1 line-clamp-2 whitespace-pre-wrap">{template.body}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Switch
                              checked={template.is_active !== false}
                              onCheckedChange={(checked) => toggleTemplateMutation.mutate({ id: template.id, is_active: checked })}
                            />
                            <Button variant="ghost" size="icon" onClick={() => openEdit(template)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => { if (confirm('Delete this template?')) deleteTemplateMutation.mutate(template.id); }}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {templateDialogOpen && (
        <EmailTemplateDialog template={editingTemplate} onClose={closeDialog} />
      )}
    </div>
  );
}