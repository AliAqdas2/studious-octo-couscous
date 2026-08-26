import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { ClipboardList, CalendarPlus, Save } from 'lucide-react';
import { toast } from 'sonner';
import OpsPanelShell from '@/components/events/OpsPanelShell';
import { getPanelMilestoneLabel } from '@/lib/eventMilestones';
import {
  ROS_CALENDAR_SAVE_HINT,
  fromDatetimeLocalValue,
  sendRosCalendarInvite,
  toDatetimeLocalValue,
} from '@/lib/rosCalendarInvite';

function toDateInputValue(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    const s = String(value);
    return s.length >= 10 ? s.slice(0, 10) : '';
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toTimeInputValue(value) {
  if (!value) return '';
  const s = String(value).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (m) {
    return `${m[1].padStart(2, '0')}:${m[2]}`;
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(
      d.getMinutes()
    ).padStart(2, '0')}`;
  }
  return '';
}

const emptyCustom = () => ({
  embroideredAprons: {
    logoSentToEmbroiderist: false,
    customName: false,
  },
  engravedGlassware: { progress: false },
  cheeseboard: { progress: false },
  chocolateMold: { progress: false },
  chefHats: { progress: false, embroidered: false },
  berets: { progress: false, embroidered: false },
});

function yn(v) {
  return v ? 'Yes' : 'No';
}

function formatScheduleSummary(form) {
  if (!form?.scheduledAt) return [];
  const when = new Date(form.scheduledAt);
  return [
    {
      label: 'Meeting date / time',
      value: Number.isNaN(when.getTime())
        ? String(form.scheduledAt)
        : when.toLocaleString(),
    },
    {
      label: 'Calendar invite sent',
      value: yn(form.calendarInviteSent),
    },
  ];
}

function formatDetailsSummary(form, { isCooking, rosConfirmLabel, mediaLabels }) {
  if (!form) return [];
  const rows = [];

  if (isCooking) {
    const menuBits = [form.menu?.app, form.menu?.entree, form.menu?.dessert]
      .filter(Boolean)
      .join(' · ');
    rows.push({
      label: 'Menu',
      value: menuBits || '—',
    });
    rows.push({
      label: 'Menu confirmed',
      value: yn(form.menu?.confirmed),
    });
  } else {
    rows.push({
      label: rosConfirmLabel || 'Activity',
      value: form.activityConfirm?.notes || '—',
    });
    rows.push({
      label: 'Confirmed',
      value: yn(form.activityConfirm?.confirmed),
    });
  }

  const barBits = [];
  if (form.bar?.handling) barBits.push('handling');
  if (form.bar?.consumption) barBits.push('consumption');
  if (form.bar?.wineOrBeer) barBits.push(form.bar.wineOrBeer);
  rows.push({
    label: 'Bar',
    value: barBits.length ? barBits.join(' · ') : '—',
  });

  if (form.arrivalMethod) {
    rows.push({ label: 'Arrival', value: form.arrivalMethod });
  }
  if (form.timeChanged) {
    const bits = [form.newEventDate, form.newStartTime].filter(Boolean);
    rows.push({
      label: 'Event time changed',
      value: bits.length ? bits.join(' · ') : 'Yes',
    });
  }
  if (form.headcountConfirmed !== '' && form.headcountConfirmed != null) {
    rows.push({
      label: 'Headcount',
      value: String(form.headcountConfirmed),
    });
  }
  const poc = [form.dayOfPoc?.name, form.dayOfPoc?.email, form.dayOfPoc?.phone]
    .filter(Boolean)
    .join(' · ');
  if (poc) rows.push({ label: 'Day-of POC', value: poc });

  if (form.mediaPermission) {
    rows.push({
      label: 'Multimedia',
      value: mediaLabels?.[form.mediaPermission] || form.mediaPermission,
    });
  }
  if (form.seatingCurated) {
    rows.push({
      label: 'Seating',
      value: form.seatingStyle || 'Curated',
    });
  }

  let transportValue = yn(form.transport?.needed);
  if (form.transport?.needed && form.transport?.company) {
    transportValue = `Yes — ${form.transport.company}`;
  }
  rows.push({ label: 'Transport', value: transportValue });

  if (form.notes) {
    rows.push({ label: 'Notes', value: form.notes });
  }

  return rows.filter((r) => r.value != null && r.value !== '');
}

const SummaryDl = ({ rows }) => (
  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm text-green-950">
    {rows.map((row) => (
      <div key={row.label}>
        <dt className="text-xs font-semibold uppercase tracking-wider text-green-700">
          {row.label}
        </dt>
        <dd className="text-sm font-semibold text-green-950 break-words mt-1">
          {row.value}
        </dd>
      </div>
    ))}
  </dl>
);

const PhaseSummaryCard = ({ title, subtitle, rows, onEdit, canEdit }) => (
  <Card className="border-green-200 bg-green-50/60">
    <CardContent className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="font-medium text-green-900">{title}</p>
          {subtitle ? (
            <p className="text-sm text-green-700">{subtitle}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-green-600 text-white">Done</Badge>
          {canEdit ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-green-300 text-green-800 hover:bg-green-100"
              onClick={onEdit}
            >
              View / Edit
            </Button>
          ) : null}
        </div>
      </div>
      {rows.length > 0 ? <SummaryDl rows={rows} /> : null}
    </CardContent>
  </Card>
);

function buildInitial(state) {
  const ros = state?.runOfShow || {};
  const pre = state?.prefill || {};
  const transportCompany =
    ros.transport?.company ||
    (pre.transportationDetails?.company === 'Alberto'
      ? 'Sammy Transport'
      : pre.transportationDetails?.company) ||
    '';

  return {
    scheduledAt: ros.scheduledAt || '',
    calendarInviteSent: Boolean(ros.calendarInviteSent),
    menu: {
      app: ros.menu?.app || '',
      entree: ros.menu?.entree || '',
      dessert: ros.menu?.dessert || '',
      confirmed: Boolean(ros.menu?.confirmed),
    },
    activityConfirm: {
      label: ros.activityConfirm?.label || state?.rosConfirmLabel || '',
      notes: ros.activityConfirm?.notes || '',
      confirmed: Boolean(ros.activityConfirm?.confirmed),
    },
    bar: {
      handling: Boolean(ros.bar?.handling ?? pre.alcoholIncluded),
      consumption: Boolean(ros.bar?.consumption),
      wineOrBeer: ros.bar?.wineOrBeer || '',
      notes: ros.bar?.notes || '',
    },
    arrivalMethod: ros.arrivalMethod || '',
    timeChanged: Boolean(ros.timeChanged),
    newEventDate:
      ros.newEventDate ||
      toDateInputValue(pre.eventDate || state?.event?.event_date),
    newStartTime:
      ros.newStartTime ||
      toTimeInputValue(pre.startTime) ||
      '',
    headcountConfirmed:
      ros.headcountConfirmed ??
      pre.headcount ??
      pre.headcountMax ??
      pre.headcountMin ??
      '',
    dayOfPoc: {
      name: ros.dayOfPoc?.name || pre.dayOfPocName || '',
      email: ros.dayOfPoc?.email || pre.dayOfPocEmail || '',
      phone: ros.dayOfPoc?.phone || pre.dayOfPocPhone || '',
    },
    mediaPermission: ros.mediaPermission || pre.mediaPermission || '',
    seatingCurated:
      ros.seatingCurated != null
        ? Boolean(ros.seatingCurated)
        : Boolean(pre.seatingCurated),
    seatingStyle: ros.seatingStyle || pre.seatingStyle || '',
    foodAdditions: {
      charcuterieCount: ros.foodAdditions?.charcuterieCount ?? '',
      additionalProtein: ros.foodAdditions?.additionalProtein ?? '',
      mysteryIngredients: Boolean(
        ros.foodAdditions?.mysteryIngredients ??
          pre.foodAdditions?.mysteryIngredients?.enabled
      ),
      alternativeSauces: Boolean(
        ros.foodAdditions?.alternativeSauces ??
          pre.foodAdditions?.alternativeSauces?.enabled
      ),
    },
    customAddons: {
      ...emptyCustom(),
      ...(ros.customAddons || {}),
      embroideredAprons: {
        ...emptyCustom().embroideredAprons,
        ...(ros.customAddons?.embroideredAprons || {}),
        logoSentToEmbroiderist: Boolean(
          ros.customAddons?.embroideredAprons?.logoSentToEmbroiderist ??
            pre.customAddons?.embroideredAprons?.logoOrdered
        ),
        customName: Boolean(
          ros.customAddons?.embroideredAprons?.customName ??
            pre.customAddons?.embroideredAprons?.customName
        ),
      },
    },
    transport: {
      needed:
        ros.transport?.needed != null
          ? Boolean(ros.transport.needed)
          : Boolean(pre.transportationNeeded),
      company:
        transportCompany === 'Alberto' ? 'Sammy Transport' : transportCompany,
      companyOther: ros.transport?.companyOther || '',
    },
    notes: ros.notes || '',
  };
}

/**
 * Structured Run of Show form (~2.5 weeks). Persists to events.run_of_show.
 * Full BEO PDF generator is intentionally out of scope (plan 05).
 */
export default function RunOfShowForm({ event, user, canEdit = false }) {
  const eventId = event?.id;
  const queryClient = useQueryClient();
  const isCooking = event?.event_type === 'In-Person Cooking';
  const isCompetition = Boolean(event?.is_competition);

  const { data: state, isLoading } = useQuery({
    queryKey: ['run-of-show', eventId],
    queryFn: async () => {
      const res = await base44.functions.invoke('getRunOfShow', { eventId });
      return res?.data ?? res;
    },
    enabled: !!eventId,
  });

  const rosConfirmLabel =
    state?.rosConfirmLabel ||
    (isCooking ? 'Confirm menu' : 'Confirm activity');

  const [form, setForm] = useState(null);
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [editingDetails, setEditingDetails] = useState(false);
  const [accordionValue, setAccordionValue] = useState(['schedule']);

  useEffect(() => {
    if (state) setForm(buildInitial(state));
  }, [state]);

  const isScheduled = Boolean(state?.scheduledAt);
  const completed = Boolean(state?.completed);

  useEffect(() => {
    if (!state) return;
    setEditingSchedule(false);
    setEditingDetails(false);
  }, [state?.scheduledAt, state?.completed]);

  useEffect(() => {
    const next = [];
    if (!isScheduled || editingSchedule) next.push('schedule');
    if (!completed || editingDetails) next.push('details');
    setAccordionValue(next);
  }, [isScheduled, completed, editingSchedule, editingDetails]);

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const setNested = (key, patch) =>
    setForm((f) => ({ ...f, [key]: { ...f[key], ...patch } }));
  const setCustom = (key, patch) =>
    setForm((f) => ({
      ...f,
      customAddons: {
        ...f.customAddons,
        [key]: { ...f.customAddons[key], ...patch },
      },
    }));

  const payloadSchedule = useMemo(() => {
    if (!form) return null;
    return {
      scheduledAt: form.scheduledAt || null,
      calendarInviteSent: form.calendarInviteSent,
    };
  }, [form]);

  const payloadDetails = useMemo(() => {
    if (!form) return null;
    return {
      menu: {
        app: form.menu.app || null,
        entree: form.menu.entree || null,
        dessert: form.menu.dessert || null,
        confirmed: form.menu.confirmed,
      },
      activityConfirm: {
        label: form.activityConfirm?.label || rosConfirmLabel,
        notes: form.activityConfirm?.notes || null,
        confirmed: Boolean(form.activityConfirm?.confirmed),
      },
      bar: {
        handling: form.bar.handling,
        consumption: form.bar.consumption,
        wineOrBeer: form.bar.wineOrBeer || null,
        notes: form.bar.notes || null,
      },
      arrivalMethod: form.arrivalMethod || null,
      timeChanged: form.timeChanged,
      newEventDate: form.timeChanged ? form.newEventDate || null : null,
      newStartTime: form.timeChanged ? form.newStartTime || null : null,
      headcountConfirmed:
        form.headcountConfirmed === ''
          ? null
          : Number(form.headcountConfirmed),
      dayOfPoc: {
        name: form.dayOfPoc.name || null,
        email: form.dayOfPoc.email || null,
        phone: form.dayOfPoc.phone || null,
      },
      mediaPermission: form.mediaPermission || null,
      seatingCurated: form.seatingCurated,
      seatingStyle: form.seatingCurated ? form.seatingStyle || null : null,
      foodAdditions: {
        charcuterieCount:
          form.foodAdditions.charcuterieCount === ''
            ? null
            : Number(form.foodAdditions.charcuterieCount),
        additionalProtein:
          form.foodAdditions.additionalProtein === ''
            ? null
            : form.foodAdditions.additionalProtein,
        mysteryIngredients: isCooking
          ? form.foodAdditions.mysteryIngredients
          : false,
        alternativeSauces: isCooking
          ? form.foodAdditions.alternativeSauces
          : false,
      },
      customAddons: form.customAddons,
      transport: {
        needed: form.transport.needed,
        company: form.transport.needed
          ? form.transport.company || null
          : null,
        companyOther:
          form.transport.company === 'Other'
            ? form.transport.companyOther || null
            : null,
      },
      notes: form.notes || null,
    };
  }, [form, isCooking, rosConfirmLabel]);

  const saveMutation = useMutation({
    mutationFn: async ({
      scope,
      complete = false,
      markScheduled = false,
      afterInvite = false,
    }) => {
      const body =
        scope === 'schedule'
          ? {
              ...payloadSchedule,
              ...(afterInvite ? { calendarInviteSent: true } : {}),
            }
          : payloadDetails;
      const res = await base44.functions.invoke('saveRunOfShow', {
        eventId,
        ...body,
        complete,
        markScheduled,
      });
      return res?.data ?? res;
    },
    onSuccess: (_body, vars) => {
      queryClient.invalidateQueries(['run-of-show', eventId]);
      queryClient.invalidateQueries(['event', eventId]);
      queryClient.invalidateQueries(['event-tasks', eventId]);
      if (vars.scope === 'schedule') {
        setEditingSchedule(false);
      }
      if (vars.complete) {
        setEditingDetails(false);
      }
      if (vars.afterInvite) {
        return;
      }
      toast.success(
        vars.complete
          ? 'Run of Show completed'
          : vars.scope === 'schedule'
            ? 'ROS schedule saved'
            : 'Run of Show draft saved'
      );
    },
    onError: (err) => {
      toast.error(err?.message || 'Failed to save Run of Show');
    },
  });

  if (!eventId || isLoading || !form) {
    return (
      <OpsPanelShell title="Run of Show" icon={ClipboardList} forceOpen>
        <div className="h-28 animate-pulse bg-slate-100 rounded" />
      </OpsPanelShell>
    );
  }

  const mediaLabels = state?.mediaLabels || {};
  const arrivalMethods = state?.arrivalMethods || [];
  const seatingStyles = state?.seatingStyles || [];
  const wineOpts = state?.wineOrBeerOptions || [];
  const transportCompanies = state?.transportCompanies || [
    'Sammy Transport',
    'DC Nation Tours',
    'Other',
  ];

  const scheduleSummaryRows = formatScheduleSummary(form);
  const detailsSummaryRows = formatDetailsSummary(form, {
    isCooking,
    rosConfirmLabel,
    mediaLabels,
  });

  const showScheduleSummary = isScheduled && !editingSchedule;
  const showDetailsSummary = completed && !editingDetails;
  const rosFullyComplete =
    isScheduled && completed && !editingSchedule && !editingDetails;
  const rosMilestone = getPanelMilestoneLabel('ros', event || state?.event);

  const scheduleForm = (
    <div className="space-y-3 rounded-lg border border-orange-200 bg-orange-50/40 p-4">
      <p className="text-xs text-gray-500">
        Pick a time and invite the client + Sales. Save schedule separately
        from meeting notes.
      </p>
      <div>
        <Label className="text-xs text-gray-500">
          ROS meeting date & time
        </Label>
        <Input
          type="datetime-local"
          disabled={!canEdit}
          value={toDatetimeLocalValue(form.scheduledAt)}
          onChange={(e) =>
            setField(
              'scheduledAt',
              fromDatetimeLocalValue(e.target.value) || ''
            )
          }
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={form.calendarInviteSent}
          disabled={!canEdit}
          onCheckedChange={(v) => setField('calendarInviteSent', Boolean(v))}
        />
        Calendar invite sent (client + Sales)
      </label>
      {canEdit && (
        <div className="flex flex-wrap gap-2 items-center">
          <Button
            size="sm"
            className="bg-[#C84B31] hover:bg-[#A03A23]"
            disabled={
              saveMutation.isPending ||
              !form.scheduledAt ||
              !(event?.poc_email || event?.pocEmail)
            }
            onClick={() => {
              const pocEmail = event?.poc_email || event?.pocEmail;
              const start = new Date(form.scheduledAt);
              try {
                sendRosCalendarInvite({
                  eventName: event?.event_name || event?.eventName || 'Event',
                  eventType:
                    event?.event_type || event?.eventType || 'Experience',
                  pocName: event?.poc_name || event?.pocName || '',
                  pocEmail,
                  venue: event?.venue || '',
                  meetingStart: start,
                  confirmLabel: rosConfirmLabel,
                });
                setField('calendarInviteSent', true);
                toast.success(ROS_CALENDAR_SAVE_HINT, { duration: 8000 });
                saveMutation.mutate({
                  scope: 'schedule',
                  markScheduled: true,
                  afterInvite: true,
                });
              } catch (err) {
                toast.error(
                  err instanceof Error
                    ? err.message
                    : 'Could not open calendar invite'
                );
              }
            }}
          >
            <CalendarPlus className="w-4 h-4 mr-1.5" />
            Send calendar invite
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={saveMutation.isPending || !form.scheduledAt}
            onClick={() =>
              saveMutation.mutate({
                scope: 'schedule',
                markScheduled: true,
              })
            }
          >
            <Save className="w-4 h-4 mr-1" />
            Save schedule
          </Button>
          {editingSchedule && isScheduled ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={saveMutation.isPending}
              onClick={() => {
                setForm(buildInitial(state));
                setEditingSchedule(false);
              }}
            >
              Cancel
            </Button>
          ) : null}
        </div>
      )}
      {canEdit && !(event?.poc_email || event?.pocEmail) && (
        <p className="text-xs text-amber-700">
          Add a planner email on the event (deposit intake) before sending the
          invite.
        </p>
      )}
      {canEdit && (
        <p className="text-xs text-gray-500">{ROS_CALENDAR_SAVE_HINT}</p>
      )}
    </div>
  );

  const detailsForm = (
    <div className="space-y-5">
      {!isScheduled ? (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded p-2">
          Schedule the ROS meeting first. You can still draft details early if
          needed.
        </p>
      ) : null}

      <section className="space-y-2">
        <Label className="text-sm font-semibold">{rosConfirmLabel}</Label>
        {isCooking ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {['app', 'entree', 'dessert'].map((k) => (
                <div key={k}>
                  <Label className="text-xs capitalize text-gray-500">{k}</Label>
                  <Input
                    disabled={!canEdit}
                    value={form.menu[k]}
                    onChange={(e) =>
                      setNested('menu', { [k]: e.target.value })
                    }
                  />
                </div>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.menu.confirmed}
                disabled={!canEdit}
                onCheckedChange={(v) =>
                  setNested('menu', { confirmed: Boolean(v) })
                }
              />
              Menu confirmed with client
            </label>
          </>
        ) : (
          <>
            <Textarea
              disabled={!canEdit}
              placeholder="Notes from the client (what was confirmed)…"
              value={form.activityConfirm?.notes || ''}
              onChange={(e) =>
                setNested('activityConfirm', {
                  label: rosConfirmLabel,
                  notes: e.target.value,
                })
              }
              rows={3}
            />
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={Boolean(form.activityConfirm?.confirmed)}
                disabled={!canEdit}
                onCheckedChange={(v) =>
                  setNested('activityConfirm', {
                    label: rosConfirmLabel,
                    confirmed: Boolean(v),
                  })
                }
              />
              Activity confirmed with client
            </label>
          </>
        )}
      </section>

      <section className="space-y-2 border-t pt-4">
        <Label className="text-sm font-semibold">Bar</Label>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.bar.handling}
              disabled={!canEdit}
              onCheckedChange={(v) =>
                setNested('bar', { handling: Boolean(v) })
              }
            />
            Are we handling?
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.bar.consumption}
              disabled={!canEdit}
              onCheckedChange={(v) =>
                setNested('bar', { consumption: Boolean(v) })
              }
            />
            Consumption tracking?
          </label>
        </div>
        <Select
          value={form.bar.wineOrBeer}
          disabled={!canEdit}
          onValueChange={(v) => setNested('bar', { wineOrBeer: v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Wine or beer…" />
          </SelectTrigger>
          <SelectContent>
            {wineOpts.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      <section className="space-y-3 border-t pt-4">
        <Label className="text-sm font-semibold">Arrival & logistics</Label>
        <Select
          value={form.arrivalMethod}
          disabled={!canEdit}
          onValueChange={(v) => setField('arrivalMethod', v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Arrival method…" />
          </SelectTrigger>
          <SelectContent>
            {arrivalMethods.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={form.timeChanged}
            disabled={!canEdit}
            onCheckedChange={(v) => {
              const on = Boolean(v);
              if (on) {
                const preDate =
                  form.newEventDate ||
                  toDateInputValue(state?.prefill?.eventDate) ||
                  toDateInputValue(state?.event?.event_date) ||
                  toDateInputValue(event?.event_date);
                const preTime =
                  form.newStartTime ||
                  toTimeInputValue(state?.prefill?.startTime) ||
                  toTimeInputValue(event?.start_time);
                setForm((prev) => ({
                  ...prev,
                  timeChanged: true,
                  newEventDate: preDate,
                  newStartTime: preTime,
                }));
              } else {
                setField('timeChanged', false);
              }
            }}
          />
          Event time changed
        </label>
        {form.timeChanged && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-gray-500">New event date</Label>
              <Input
                type="date"
                disabled={!canEdit}
                value={form.newEventDate || ''}
                onChange={(e) => setField('newEventDate', e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500">New start time</Label>
              <Input
                type="time"
                disabled={!canEdit}
                value={form.newStartTime || ''}
                onChange={(e) => setField('newStartTime', e.target.value)}
              />
            </div>
          </div>
        )}
        <div>
          <Label className="text-xs text-gray-500">Headcount confirm</Label>
          <Input
            type="number"
            disabled={!canEdit}
            value={form.headcountConfirmed}
            onChange={(e) => setField('headcountConfirmed', e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div>
            <Label className="text-xs text-gray-500">Day-of POC name</Label>
            <Input
              disabled={!canEdit}
              value={form.dayOfPoc.name}
              onChange={(e) => setNested('dayOfPoc', { name: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs text-gray-500">Email</Label>
            <Input
              disabled={!canEdit}
              value={form.dayOfPoc.email}
              onChange={(e) =>
                setNested('dayOfPoc', { email: e.target.value })
              }
            />
          </div>
          <div>
            <Label className="text-xs text-gray-500">Phone</Label>
            <Input
              disabled={!canEdit}
              value={form.dayOfPoc.phone}
              onChange={(e) =>
                setNested('dayOfPoc', { phone: e.target.value })
              }
            />
          </div>
        </div>
      </section>

      <section className="space-y-2 border-t pt-4">
        <Label className="text-sm font-semibold">Multimedia</Label>
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded p-2">
          {state?.mediaTalkTrack}
        </p>
        <Select
          value={form.mediaPermission}
          disabled={!canEdit}
          onValueChange={(v) => setField('mediaPermission', v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Permission…" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(mediaLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      <section className="space-y-2 border-t pt-4">
        <Label className="text-sm font-semibold">Seating</Label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={form.seatingCurated}
            disabled={!canEdit}
            onCheckedChange={(v) => setField('seatingCurated', Boolean(v))}
          />
          Curate seating
        </label>
        {form.seatingCurated && (
          <Select
            value={form.seatingStyle}
            disabled={!canEdit}
            onValueChange={(v) => setField('seatingStyle', v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="How…" />
            </SelectTrigger>
            <SelectContent>
              {seatingStyles.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </section>

      <section className="space-y-2 border-t pt-4">
        <Label className="text-sm font-semibold">
          Food additions progress (Ops)
        </Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-gray-500">
              Charcuterie platter/board count
            </Label>
            <Input
              type="number"
              disabled={!canEdit}
              value={form.foodAdditions.charcuterieCount}
              onChange={(e) =>
                setNested('foodAdditions', {
                  charcuterieCount: e.target.value,
                })
              }
            />
          </div>
          <div>
            <Label className="text-xs text-gray-500">
              Additional protein (optional)
            </Label>
            <Input
              disabled={!canEdit}
              value={form.foodAdditions.additionalProtein}
              onChange={(e) =>
                setNested('foodAdditions', {
                  additionalProtein: e.target.value,
                })
              }
            />
          </div>
        </div>
        {(isCompetition || isCooking) && (
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.foodAdditions.mysteryIngredients}
                disabled={!canEdit}
                onCheckedChange={(v) =>
                  setNested('foodAdditions', {
                    mysteryIngredients: Boolean(v),
                  })
                }
              />
              Competition: mystery ingredients
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.foodAdditions.alternativeSauces}
                disabled={!canEdit}
                onCheckedChange={(v) =>
                  setNested('foodAdditions', {
                    alternativeSauces: Boolean(v),
                  })
                }
              />
              Competition: alternative sauces
            </label>
          </div>
        )}
      </section>

      <section className="space-y-2 border-t pt-4">
        <Label className="text-sm font-semibold">
          Custom add-on progress (Ops)
        </Label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={
              form.customAddons.embroideredAprons.logoSentToEmbroiderist
            }
            disabled={!canEdit}
            onCheckedChange={(v) =>
              setCustom('embroideredAprons', {
                logoSentToEmbroiderist: Boolean(v),
              })
            }
          />
          Embroidered aprons — logo sent to embroiderist
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={form.customAddons.embroideredAprons.customName}
            disabled={!canEdit}
            onCheckedChange={(v) =>
              setCustom('embroideredAprons', { customName: Boolean(v) })
            }
          />
          Custom name on apron
        </label>
        {[
          ['engravedGlassware', 'Custom engraved glassware'],
          ['cheeseboard', 'Custom cheeseboard'],
          ['chocolateMold', 'Chocolate mold'],
        ].map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={Boolean(form.customAddons[key]?.progress)}
              disabled={!canEdit}
              onCheckedChange={(v) =>
                setCustom(key, { progress: Boolean(v) })
              }
            />
            {label}
          </label>
        ))}
        {['chefHats', 'berets'].map((key) => (
          <div key={key} className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={Boolean(form.customAddons[key]?.progress)}
                disabled={!canEdit}
                onCheckedChange={(v) =>
                  setCustom(key, { progress: Boolean(v) })
                }
              />
              {key === 'chefHats' ? 'Chef hats' : 'Berets'}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={Boolean(form.customAddons[key]?.embroidered)}
                disabled={!canEdit}
                onCheckedChange={(v) =>
                  setCustom(key, { embroidered: Boolean(v) })
                }
              />
              ± embroidered
            </label>
          </div>
        ))}
      </section>

      <section className="space-y-2 border-t pt-4">
        <Label className="text-sm font-semibold">Transport</Label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={form.transport.needed}
            disabled={!canEdit}
            onCheckedChange={(v) =>
              setNested('transport', { needed: Boolean(v) })
            }
          />
          Pickup / drop-off needed
        </label>
        {form.transport.needed && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Select
              value={form.transport.company}
              disabled={!canEdit}
              onValueChange={(v) => setNested('transport', { company: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Company…" />
              </SelectTrigger>
              <SelectContent>
                {transportCompanies.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c === 'Sammy Transport'
                      ? 'Sammy Transport (Alberto)'
                      : c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.transport.company === 'Other' && (
              <Input
                disabled={!canEdit}
                placeholder="Other company"
                value={form.transport.companyOther}
                onChange={(e) =>
                  setNested('transport', { companyOther: e.target.value })
                }
              />
            )}
          </div>
        )}
      </section>

      <section className="border-t pt-4">
        <Label className="text-xs text-gray-500">Notes</Label>
        <Textarea
          disabled={!canEdit}
          value={form.notes}
          onChange={(e) => setField('notes', e.target.value)}
          rows={2}
        />
      </section>

      {canEdit && (
        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            variant="outline"
            disabled={saveMutation.isPending}
            onClick={() =>
              saveMutation.mutate({
                scope: 'details',
                complete: false,
                markScheduled: false,
              })
            }
          >
            <Save className="w-4 h-4 mr-1" />
            Save draft
          </Button>
          <Button
            className="bg-[#C84B31] hover:bg-[#A03A23]"
            disabled={saveMutation.isPending || (completed && !editingDetails)}
            onClick={() =>
              saveMutation.mutate({
                scope: 'details',
                complete: true,
                markScheduled: false,
              })
            }
          >
            Complete Run of Show
          </Button>
          {editingDetails && completed ? (
            <Button
              variant="ghost"
              disabled={saveMutation.isPending}
              onClick={() => {
                setForm(buildInitial(state));
                setEditingDetails(false);
              }}
            >
              Cancel
            </Button>
          ) : null}
        </div>
      )}
      {!canEdit && user && (
        <p className="text-xs text-gray-500">View only for your role.</p>
      )}
    </div>
  );

  return (
    <OpsPanelShell
      title="Run of Show"
      icon={ClipboardList}
      complete={rosFullyComplete}
      forceOpen={!rosFullyComplete}
      doneBadge={rosFullyComplete}
      milestoneLabel={rosMilestone}
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-gray-500">
            Schedule the meeting first (~2.5 weeks out), then capture details
            after it happens.
          </p>
          <div className="flex gap-1.5">
            {isScheduled && (
              <Badge variant="outline" className="text-xs">
                Scheduled
              </Badge>
            )}
            {completed && (
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs">
                Completed
              </Badge>
            )}
          </div>
        </div>

        {showScheduleSummary ? (
          <PhaseSummaryCard
            title="1. Schedule saved"
            subtitle="ROS meeting is on the calendar."
            rows={scheduleSummaryRows}
            canEdit={canEdit}
            onEdit={() => setEditingSchedule(true)}
          />
        ) : null}

        {showDetailsSummary ? (
          <PhaseSummaryCard
            title="2. Run of Show complete"
            subtitle={
              state?.runOfShow?.completedAt
                ? `Completed ${new Date(
                    state.runOfShow.completedAt
                  ).toLocaleString()}`
                : 'Meeting details saved.'
            }
            rows={detailsSummaryRows}
            canEdit={canEdit}
            onEdit={() => setEditingDetails(true)}
          />
        ) : null}

        {!showScheduleSummary || !showDetailsSummary ? (
          <Accordion
            type="multiple"
            value={accordionValue}
            onValueChange={setAccordionValue}
            className="w-full"
          >
            {!showScheduleSummary ? (
              <AccordionItem
                value="schedule"
                className="border rounded-lg px-3 mb-2"
              >
                <AccordionTrigger className="hover:no-underline py-3">
                  <span className="flex items-center gap-2 text-left">
                    <span className="font-semibold">
                      1. Schedule (~2.5 weeks)
                    </span>
                    {isScheduled ? (
                      <Badge className="bg-green-600 text-white text-[10px]">
                        Editing
                      </Badge>
                    ) : null}
                  </span>
                </AccordionTrigger>
                <AccordionContent>{scheduleForm}</AccordionContent>
              </AccordionItem>
            ) : null}

            {!showDetailsSummary ? (
              <AccordionItem
                value="details"
                className={`border rounded-lg px-3 ${
                  !isScheduled ? 'border-dashed opacity-90' : ''
                }`}
              >
                <AccordionTrigger className="hover:no-underline py-3">
                  <span className="flex items-center gap-2 text-left">
                    <span className="font-semibold">2. Meeting details</span>
                    {completed ? (
                      <Badge className="bg-green-600 text-white text-[10px]">
                        Editing
                      </Badge>
                    ) : null}
                  </span>
                </AccordionTrigger>
                <AccordionContent>{detailsForm}</AccordionContent>
              </AccordionItem>
            ) : null}
          </Accordion>
        ) : null}
      </div>
    </OpsPanelShell>
  );
}
