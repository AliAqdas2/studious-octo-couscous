import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Save, Phone, Mail, Calendar } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

export default function AutomationConfigCard() {
  const queryClient = useQueryClient();
  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['automation-config'],
    queryFn: () => base44.entities.AutomationConfig.filter({ key: 'default' })
  });
  const config = configs[0];

  const [form, setForm] = useState({
    enabled: true,
    business_hours_gate_enabled: true,
    use_rep_caller_id_enabled: false,
    rep_phone: '',
    rep_email: '',
    calendar_link: '',
    max_attempts: 3
  });

  // Only hydrate the form from the server ONCE per loaded config (by id).
  // Without this gate, every background refetch (e.g. after invalidation)
  // would overwrite the user's in-progress toggle changes — making it look
  // like the Automated Calling switch "re-enables itself".
  const hydratedConfigIdRef = useRef(null);
  useEffect(() => {
    if (config && hydratedConfigIdRef.current !== config.id) {
      hydratedConfigIdRef.current = config.id;
      setForm({
        enabled: config.enabled !== false,
        business_hours_gate_enabled: config.business_hours_gate_enabled !== false,
        use_rep_caller_id_enabled: config.use_rep_caller_id_enabled === true,
        rep_phone: config.rep_phone || '',
        rep_email: config.rep_email || '',
        calendar_link: config.calendar_link || '',
        max_attempts: config.max_attempts || 3
      });
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (config) {
        return base44.entities.AutomationConfig.update(config.id, form);
      }
      return base44.entities.AutomationConfig.create({ key: 'default', ...form });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-config'] });
      toast.success('Automation config saved');
    },
    onError: (e) => toast.error(`Failed to save: ${e.message}`)
  });

  // Toggle-only persistence. Saves a single field immediately (without
  // touching the rest of the form) so flipping the master switch is sticky
  // and never gets undone by a background refetch.
  const toggleMutation = useMutation({
    mutationFn: async ({ field, value }) => {
      if (config) {
        return base44.entities.AutomationConfig.update(config.id, { [field]: value });
      }
      return base44.entities.AutomationConfig.create({ key: 'default', ...form, [field]: value });
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['automation-config'] });
      const labelMap = {
        enabled: 'Automated calling',
        business_hours_gate_enabled: 'Business hours gate',
        use_rep_caller_id_enabled: "Rep phone as caller ID"
      };
      toast.success(`${labelMap[vars.field] || vars.field} ${vars.value ? 'enabled' : 'disabled'}`);
    },
    onError: (e, vars) => {
      // Roll back the local toggle if the server rejected the change
      setForm((prev) => ({ ...prev, [vars.field]: !vars.value }));
      toast.error(`Failed to save: ${e.message}`);
    }
  });

  const handleToggle = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    toggleMutation.mutate({ field, value });
  };

  if (isLoading) {
    return <div className="text-sm text-gray-500">Loading config…</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Automation Config</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={`flex items-center justify-between p-3 rounded-lg border ${form.enabled ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
          <div>
            <Label className="font-semibold">Automated Calling</Label>
            <p className="text-xs text-gray-600 mt-0.5">
              {form.enabled
                ? 'Enabled — every new lead will trigger an automated call.'
                : 'Disabled — no calls will be placed or queued.'}
            </p>
          </div>
          <Switch
            checked={form.enabled}
            disabled={toggleMutation.isPending}
            onCheckedChange={(checked) => handleToggle('enabled', checked)}
          />
        </div>
        <div className={`flex items-center justify-between p-3 rounded-lg border ${form.business_hours_gate_enabled ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
          <div>
            <Label className="font-semibold">Business Hours Gate</Label>
            <p className="text-xs text-gray-600 mt-0.5">
              {form.business_hours_gate_enabled
                ? 'On — calls outside Mon–Fri 7:30 AM – 8:30 PM DC time are queued for the next working window.'
                : 'Off — calls go out immediately regardless of time of day.'}
            </p>
          </div>
          <Switch
            checked={form.business_hours_gate_enabled}
            disabled={toggleMutation.isPending}
            onCheckedChange={(checked) => handleToggle('business_hours_gate_enabled', checked)}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="flex items-center gap-2 mb-1">
              <Phone className="w-4 h-4" /> Rep Phone
            </Label>
            <Input
              placeholder="+15551234567 or (555) 123-4567"
              value={form.rep_phone}
              onChange={(e) => setForm({ ...form, rep_phone: e.target.value })}
            />
          </div>
          <div>
            <Label className="flex items-center gap-2 mb-1">
              <Mail className="w-4 h-4" /> Rep Email
            </Label>
            <Input
              type="email"
              placeholder="rep@mangiadc.com"
              value={form.rep_email}
              onChange={(e) => setForm({ ...form, rep_email: e.target.value })}
            />
          </div>
          <div>
            <Label className="mb-1 block">Max Attempts</Label>
            <Input
              type="number"
              min={1}
              value={form.max_attempts}
              onChange={(e) => setForm({ ...form, max_attempts: parseInt(e.target.value) || 1 })}
            />
          </div>
        </div>
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="bg-[#C84B31] hover:bg-[#A03A23]"
        >
          <Save className="w-4 h-4 mr-2" />
          {saveMutation.isPending ? 'Saving…' : 'Save Config'}
        </Button>
      </CardContent>
    </Card>
  );
}