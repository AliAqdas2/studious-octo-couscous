import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function TemplateFormDialog({ template, onClose }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState(template || {
    template_name: '',
    event_type: '',
    description: '',
    pre_event_tasks: [],
    event_day_tasks: [],
    post_event_tasks: []
  });

  const mutation = useMutation({
    mutationFn: (data) => template
      ? base44.entities.EventTemplate.update(template.id, data)
      : base44.entities.EventTemplate.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['event-templates']);
      onClose();
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  const addTask = (category) => {
    setFormData({
      ...formData,
      [category]: [
        ...(formData[category] || []),
        {
          title: '',
          description: '',
          responsible_role: 'Ops',
          days_before_event: category === 'pre_event_tasks' ? 7 : null,
          days_after_event: category === 'post_event_tasks' ? 1 : null,
          order: (formData[category]?.length || 0) + 1
        }
      ]
    });
  };

  const removeTask = (category, index) => {
    setFormData({
      ...formData,
      [category]: formData[category].filter((_, i) => i !== index)
    });
  };

  const updateTask = (category, index, field, value) => {
    const tasks = [...formData[category]];
    tasks[index] = { ...tasks[index], [field]: value };
    setFormData({ ...formData, [category]: tasks });
  };

  const roles = ['Admin', 'Sales', 'Ops', 'Chef', 'Event Host', 'Finance'];

  const renderTaskList = (category, label) => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">{label}</h3>
        <Button
          type="button"
          size="sm"
          onClick={() => addTask(category)}
          variant="outline"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Task
        </Button>
      </div>

      {formData[category]?.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-8">No tasks yet</p>
      ) : (
        <div className="space-y-3">
          {formData[category]?.map((task, index) => (
            <div key={index} className="p-4 border border-gray-200 rounded-lg space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Task title"
                  value={task.title}
                  onChange={(e) => updateTask(category, index, 'title', e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => removeTask(category, index)}
                  className="text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              <Textarea
                placeholder="Description (optional)"
                value={task.description}
                onChange={(e) => updateTask(category, index, 'description', e.target.value)}
                rows={2}
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Responsible Role</Label>
                  <select
                    value={task.responsible_role}
                    onChange={(e) => updateTask(category, index, 'responsible_role', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    {roles.map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>
                {category === 'pre_event_tasks' && (
                  <div>
                    <Label className="text-xs">Days Before Event</Label>
                    <Input
                      type="number"
                      value={task.days_before_event}
                      onChange={(e) => updateTask(category, index, 'days_before_event', Number(e.target.value))}
                    />
                  </div>
                )}
                {category === 'post_event_tasks' && (
                  <div>
                    <Label className="text-xs">Days After Event</Label>
                    <Input
                      type="number"
                      value={task.days_after_event}
                      onChange={(e) => updateTask(category, index, 'days_after_event', Number(e.target.value))}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-[#C84B31]">
            {template ? 'Edit Template' : 'New Event Template'}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Template Name *</Label>
              <Input
                required
                value={formData.template_name}
                onChange={(e) => setFormData({...formData, template_name: e.target.value})}
              />
            </div>
            <div>
              <Label>Event Type *</Label>
              <Input
                required
                value={formData.event_type}
                onChange={(e) => setFormData({...formData, event_type: e.target.value})}
                placeholder="e.g., Corporate Team Building"
              />
            </div>
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              rows={2}
            />
          </div>

          <Tabs defaultValue="pre" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pre">Pre-Event</TabsTrigger>
              <TabsTrigger value="during">Event Day</TabsTrigger>
              <TabsTrigger value="post">Post-Event</TabsTrigger>
            </TabsList>
            <TabsContent value="pre" className="mt-4">
              {renderTaskList('pre_event_tasks', 'Pre-Event Tasks')}
            </TabsContent>
            <TabsContent value="during" className="mt-4">
              {renderTaskList('event_day_tasks', 'Event Day Tasks')}
            </TabsContent>
            <TabsContent value="post" className="mt-4">
              {renderTaskList('post_event_tasks', 'Post-Event Tasks')}
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={mutation.isLoading}
              className="bg-gradient-to-r from-[#C84B31] to-[#E8B55F] text-white"
            >
              {mutation.isLoading ? 'Saving...' : template ? 'Update Template' : 'Create Template'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}