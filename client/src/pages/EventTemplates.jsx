import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Edit, Trash2, FileText, AlertCircle } from 'lucide-react';
import TemplateFormDialog from '@/components/templates/TemplateFormDialog';

export default function EventTemplates() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [user, setUser] = React.useState(null);

  React.useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['event-templates'],
    queryFn: () => base44.entities.EventTemplate.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.EventTemplate.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['event-templates']);
    }
  });

  const handleEdit = (template) => {
    setEditingTemplate(template);
    setShowForm(true);
  };

  const handleClose = () => {
    setShowForm(false);
    setEditingTemplate(null);
  };

  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="bg-white/80 backdrop-blur-sm border-orange-100 max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-amber-600 mx-auto" />
            <h2 className="text-lg font-semibold text-gray-900">Admin Access Only</h2>
            <p className="text-sm text-gray-600">Event templates can only be managed by administrators.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-[#C84B31] mb-2">Event Templates</h1>
          <p className="text-gray-600">Create and manage event workflow templates</p>
        </div>
        <Button
          onClick={() => setShowForm(true)}
          className="bg-gradient-to-r from-[#C84B31] to-[#E8B55F] hover:opacity-90 text-white shadow-md"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Template
        </Button>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {isLoading || !user ? (
            <p className="text-center py-12 text-gray-500 col-span-2">Loading templates...</p>
          ) : templates.length === 0 ? (
          <Card className="bg-white/80 backdrop-blur-sm border-orange-100 col-span-2">
            <CardContent className="p-12 text-center">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-2">No templates yet</p>
              <p className="text-sm text-gray-400">Create your first event template to get started</p>
            </CardContent>
          </Card>
        ) : (
          templates.map((template) => (
            <Card key={template.id} className="bg-white/80 backdrop-blur-sm border-orange-100 hover:shadow-lg transition-all">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-xl text-gray-900">{template.template_name}</CardTitle>
                    <p className="text-sm text-gray-600 mt-1">{template.event_type}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => handleEdit(template)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => {
                        if (confirm('Delete this template?')) {
                          deleteMutation.mutate(template.id);
                        }
                      }}
                      className="text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {template.description && (
                  <p className="text-sm text-gray-600">{template.description}</p>
                )}
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">
                      {template.pre_event_tasks?.length || 0}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">Pre-Event</p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">
                      {template.event_day_tasks?.length || 0}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">Event Day</p>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg">
                    <p className="text-2xl font-bold text-purple-600">
                      {template.post_event_tasks?.length || 0}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">Post-Event</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {showForm && (
        <TemplateFormDialog
          template={editingTemplate}
          onClose={handleClose}
        />
      )}
    </div>
  );
}