import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ClipboardList, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import OpsPanelShell from '@/components/events/OpsPanelShell';
import { getPanelMilestoneLabel } from '@/lib/eventMilestones';

const VENDOR_DIRECTORY =
  'https://docs.google.com/document/d/1HHU1nfh-3a0UdJVzgWqRqUFxBpfeC3Y_GQT-2Serbv4/edit';

/** Fallback only if intake API has not returned house venues yet. */
const HOUSE_VENUES_FALLBACK = [
  'Launch Glover Park',
  "Mr. Smith's of Georgetown",
  'City Tavern',
  'The Whittemore House',
  'The Wharf Penthouse',
  'Wingos!',
  '99 M St SE - Navy Yard',
  'The Foundry',
  '1015 15th Street NW',
];

const CHEESEBOARD_MIN = 25;

const emptyFood = () => ({
  charcuterie: { enabled: false, style: null, amount: '' },
  additionalProtein: { enabled: false, amount: '' },
  mysteryIngredients: { enabled: false, amount: '' },
  alternativeSauces: { enabled: false, amount: '' },
  flavorsOfDcWarmMeal: { enabled: false, amount: '' },
});

const emptyAddons = () => ({
  embroideredAprons: {
    enabled: false,
    amount: '',
    customName: false,
    logoOrdered: false,
  },
  engravedGlassware: { enabled: false, amount: '' },
  cheeseboard: { enabled: false, amount: '' },
  chocolateMold: { enabled: false, amount: '' },
  chefHats: { enabled: false, amount: '', embroidered: false },
  berets: { enabled: false, amount: '', embroidered: false },
});

function numOrNull(v) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function yn(v) {
  return v ? 'Yes' : 'No';
}

function fmtAmount(v) {
  if (v == null || v === '') return '';
  return String(v);
}

function listEnabledItems(obj, labels) {
  if (!obj || typeof obj !== 'object') return [];
  const out = [];
  for (const [key, label] of Object.entries(labels)) {
    const row = obj[key];
    if (!row || !row.enabled) continue;
    const amt = fmtAmount(row.amount);
    const tags = [];
    if (row.style) tags.push(String(row.style));
    if (row.customName) tags.push('Custom name');
    if (row.logoOrdered) tags.push('Logo ordered');
    if (row.embroidered) tags.push('Embroidered');
    out.push({
      title: amt ? `${label} ×${amt}` : label,
      tags,
    });
  }
  return out;
}

/**
 * Build summary rows for completed deposit intake (read-only card).
 * @returns {Array<{ label: string, kind?: 'text'|'list'|'link'|'details', value?: string, details?: string[], items?: Array<{title:string,tags?:string[]}>, href?: string, linkLabel?: string }>}
 */
function formatIntakeSummary(src, { isCooking, canViewDeposit }) {
  if (!src) return [];
  const bar = src.bar_details || src.barDetails || {};
  const food = src.food_additions || src.foodAdditions || {};
  const addons = src.custom_addons || src.customAddons || {};
  const transport = src.transportation_details || src.transportationDetails || {};
  const alcohol = Boolean(src.alcohol_included ?? src.alcoholIncluded);
  const transportNeeded = Boolean(
    src.transportation_needed ?? src.transportationNeeded
  );

  const hcMin = src.headcount_min ?? src.headcountMin;
  const hcMax = src.headcount_max ?? src.headcountMax;
  const headcount =
    hcMin != null || hcMax != null
      ? `${hcMin ?? '?'}–${hcMax ?? '?'}`
      : src.headcount != null
        ? String(src.headcount)
        : '—';

  const when = src.event_date || src.eventDate;
  const start = src.start_time || src.startTime;
  const dateTime = [
    when ? new Date(when).toLocaleDateString() : null,
    start || null,
  ]
    .filter(Boolean)
    .join(' · ') || '—';

  const venueMode = src.venue_mode || src.venueMode;
  const venue = src.venue
    ? `${src.venue}${venueMode ? ` (${venueMode})` : ''}`
    : '—';

  const rows = [
    { label: 'Venue', kind: 'text', value: venue },
    {
      label: 'Venue restrictions',
      kind: 'text',
      value: src.venue_restrictions || src.venueRestrictions || null,
    },
    { label: 'Date / time', kind: 'text', value: dateTime },
    { label: 'Headcount', kind: 'text', value: headcount },
    {
      label: 'Planner',
      kind: 'text',
      value: src.poc_name || src.pocName || '—',
    },
    {
      label: 'Planner email',
      kind: 'text',
      value: src.poc_email || src.pocEmail || null,
    },
    {
      label: 'Planner phone',
      kind: 'text',
      value: src.poc_phone || src.pocPhone || null,
    },
  ];

  const alcoholDetails = [];
  if (alcohol) {
    const pay =
      bar.paymentMode === 'Other' || bar.payment_mode === 'Other'
        ? bar.paymentModeOther ||
          bar.payment_mode_other ||
          'Other'
        : bar.paymentMode || bar.payment_mode;
    if (pay) alcoholDetails.push(String(pay));
    if (bar.wineBeerSoft || bar.wine_beer_soft) {
      alcoholDetails.push('Wine / beer / soft');
    }
    const mixed = bar.mixedDrinks || bar.mixed_drinks;
    if (mixed) alcoholDetails.push(String(mixed));
  }
  rows.push({
    label: 'Alcohol',
    kind: 'details',
    value: yn(alcohol),
    details: alcoholDetails,
  });

  let transportValue = yn(transportNeeded);
  if (transportNeeded) {
    const company = transport.company;
    if (company) transportValue = `Yes — ${company}`;
  }
  rows.push({ label: 'Transportation', kind: 'text', value: transportValue });

  if (isCooking) {
    rows.push({
      label: 'Competition',
      kind: 'text',
      value: yn(src.is_competition ?? src.isCompetition),
    });
    const dish = src.dish_configuration || src.dishConfiguration;
    if (dish) {
      rows.push({ label: 'Dish configuration', kind: 'text', value: dish });
    }
  }

  const foodLabels = {
    charcuterie: 'Charcuterie',
    additionalProtein: 'Additional protein',
    flavorsOfDcWarmMeal: 'FoDC / warm meal',
    ...(isCooking
      ? {
          mysteryIngredients: 'Mystery ingredients',
          alternativeSauces: 'Alternative sauces',
        }
      : {}),
  };
  const foodItems = listEnabledItems(food, foodLabels);
  if (foodItems.length) {
    rows.push({ label: 'Food additions', kind: 'list', items: foodItems });
  }

  const addonLabels = {
    embroideredAprons: 'Embroidered aprons',
    engravedGlassware: 'Engraved glassware',
    cheeseboard: 'Cheeseboard',
    chocolateMold: 'Chocolate mold',
    chefHats: 'Chef hats',
    berets: 'Berets',
  };
  const addonItems = listEnabledItems(addons, addonLabels);
  if (addonItems.length) {
    rows.push({ label: 'Custom add-ons', kind: 'list', items: addonItems });
  }

  const listType =
    src.participation_list_type || src.participationListType;
  const listUrl = src.participation_list_url || src.participationListUrl;
  if (listType || listUrl) {
    const typeLabel =
      listType === 'sheets'
        ? 'Google Sheets'
        : listType === 'forms'
          ? 'Google Forms'
          : listType || null;
    if (listUrl) {
      rows.push({
        label: 'Participation list',
        kind: 'link',
        value: typeLabel,
        href: listUrl,
        linkLabel: listUrl,
      });
    } else {
      rows.push({
        label: 'Participation list',
        kind: 'text',
        value: typeLabel,
      });
    }
  }

  if (canViewDeposit) {
    const amt = src.deposit_amount ?? src.depositAmount;
    if (amt != null && amt !== '') {
      rows.push({
        label: 'Deposit',
        kind: 'text',
        value: `$${Number(amt).toLocaleString()}`,
      });
    }
  }

  return rows.filter((r) => {
    if (r.kind === 'list') return Array.isArray(r.items) && r.items.length > 0;
    if (r.kind === 'link') return Boolean(r.href);
    if (r.kind === 'details') return r.value != null && r.value !== '';
    return r.value != null && r.value !== '';
  });
}

function buildFormFromSource(src, houseVenues = HOUSE_VENUES_FALLBACK) {
  if (!src) {
    return {
      startTime: '',
      eventDate: '',
      pocName: '',
      pocEmail: '',
      pocPhone: '',
      headcountMin: '',
      headcountMax: '',
      alcoholIncluded: false,
      barPaymentMode: '',
      barPaymentModeOther: '',
      wineBeerSoft: false,
      mixedDrinks: '',
      isCompetition: false,
      dishConfiguration: '',
      dishConfigurationOther: '',
      food: emptyFood(),
      addons: emptyAddons(),
      transportationNeeded: false,
      transportCompany: '',
      transportCompanyOther: '',
      venueMode: 'house_venue',
      venue: '',
      venueOther: '',
      venueRestrictions: '',
      depositAmount: '',
      participationListUrl: '',
      participationListType: '',
    };
  }

  const bar = src.bar_details || src.barDetails || {};
  const foodSrc = src.food_additions || src.foodAdditions || {};
  const addonsSrc = src.custom_addons || src.customAddons || {};
  const transport = src.transportation_details || src.transportationDetails || {};
  const venueName = src.venue || '';
  const venueMode = src.venue_mode || src.venueMode || 'house_venue';
  const knownVenue = houseVenues.includes(venueName);
  const dish = src.dish_configuration || src.dishConfiguration || '';
  const knownDish = ['Entree', 'App + Entree', 'App + Entree + Dessert'].includes(
    dish
  );

  const foodKey = (key, defaults = {}) => {
    const row = foodSrc[key] || {};
    return {
      enabled: Boolean(row.enabled),
      style: row.style ?? defaults.style ?? null,
      amount: row.amount != null ? String(row.amount) : '',
    };
  };

  const addonKey = (key, extra = {}) => {
    const row = addonsSrc[key] || {};
    return {
      enabled: Boolean(row.enabled),
      amount: row.amount != null ? String(row.amount) : '',
      ...extra,
      ...(row.customName != null ? { customName: Boolean(row.customName) } : {}),
      ...(row.logoOrdered != null ? { logoOrdered: Boolean(row.logoOrdered) } : {}),
      ...(row.embroidered != null ? { embroidered: Boolean(row.embroidered) } : {}),
    };
  };

  const company = transport.company || '';
  const knownTransport = [
    'Sammy Transport',
    'DC Nation Tours',
    'Other',
  ].includes(company);

  return {
    startTime: src.start_time || src.startTime || '',
    eventDate:
      src.event_date || src.eventDate
        ? new Date(src.event_date || src.eventDate).toISOString().slice(0, 10)
        : '',
    pocName: src.poc_name || src.pocName || '',
    pocEmail: src.poc_email || src.pocEmail || '',
    pocPhone: src.poc_phone || src.pocPhone || '',
    headcountMin: src.headcount_min ?? src.headcountMin ?? src.headcount ?? '',
    headcountMax: src.headcount_max ?? src.headcountMax ?? src.headcount ?? '',
    alcoholIncluded: Boolean(src.alcohol_included ?? src.alcoholIncluded),
    barPaymentMode:
      bar.paymentMode === 'Other' || bar.payment_mode === 'Other'
        ? 'Other'
        : bar.paymentMode || bar.payment_mode || '',
    barPaymentModeOther: bar.paymentModeOther || bar.payment_mode_other || '',
    wineBeerSoft: Boolean(bar.wineBeerSoft ?? bar.wine_beer_soft),
    mixedDrinks: bar.mixedDrinks || bar.mixed_drinks || '',
    isCompetition: Boolean(src.is_competition ?? src.isCompetition),
    dishConfiguration: knownDish ? dish : dish ? 'Other' : '',
    dishConfigurationOther: knownDish ? '' : dish,
    food: {
      charcuterie: foodKey('charcuterie', { style: null }),
      additionalProtein: foodKey('additionalProtein'),
      mysteryIngredients: foodKey('mysteryIngredients'),
      alternativeSauces: foodKey('alternativeSauces'),
      flavorsOfDcWarmMeal: foodKey('flavorsOfDcWarmMeal'),
    },
    addons: {
      embroideredAprons: addonKey('embroideredAprons', {
        customName: false,
        logoOrdered: false,
      }),
      engravedGlassware: addonKey('engravedGlassware'),
      cheeseboard: addonKey('cheeseboard'),
      chocolateMold: addonKey('chocolateMold'),
      chefHats: addonKey('chefHats', { embroidered: false }),
      berets: addonKey('berets', { embroidered: false }),
    },
    transportationNeeded: Boolean(
      src.transportation_needed ?? src.transportationNeeded
    ),
    transportCompany: knownTransport ? company : company ? 'Other' : '',
    transportCompanyOther: knownTransport ? '' : company,
    venueMode,
    venue:
      venueMode === 'house_venue'
        ? knownVenue
          ? venueName
          : venueName
            ? 'Other'
            : ''
        : '',
    venueOther:
      venueMode === 'go_to_them'
        ? venueName
        : !knownVenue && venueName
          ? venueName
          : '',
    venueRestrictions: src.venue_restrictions || src.venueRestrictions || '',
    depositAmount: src.deposit_amount ?? src.depositAmount ?? '',
    participationListUrl:
      src.participation_list_url || src.participationListUrl || '',
    participationListType:
      src.participation_list_type || src.participationListType || '',
  };
}

/**
 * Deposit Intake form (plan 02). Completing this persists CRM fields,
 * generates cooking workflow tasks, and emails Dave/Zach/Monica/Eileen.
 * After complete, staff can view/edit without re-sending the notify email.
 */
export default function DepositIntakeForm({ event, user }) {
  const queryClient = useQueryClient();
  const eventId = event?.id;
  const isCooking = event?.event_type === 'In-Person Cooking';
  const [isEditing, setIsEditing] = useState(false);

  const { data: intakeState } = useQuery({
    queryKey: ['deposit-intake', eventId],
    queryFn: async () => {
      const res = await base44.functions.invoke('getDepositIntake', { eventId });
      return res.data;
    },
    enabled: !!eventId,
  });

  const canViewDeposit =
    intakeState?.canViewDepositAmount === true ||
    event?.can_view_deposit_amount === true;

  const completed =
    Boolean(event?.deposit_intake_completed_at) ||
    Boolean(intakeState?.completed);

  const sourceEvent = intakeState?.event || event;

  const houseVenues = useMemo(() => {
    const fromApi = intakeState?.houseVenues;
    if (Array.isArray(fromApi) && fromApi.length > 0) return fromApi;
    return HOUSE_VENUES_FALLBACK;
  }, [intakeState?.houseVenues]);

  const [form, setForm] = useState(() =>
    buildFormFromSource(event, HOUSE_VENUES_FALLBACK)
  );

  const hydrateFromLatest = () => {
    setForm(buildFormFromSource(sourceEvent, houseVenues));
  };

  const openEdit = () => {
    hydrateFromLatest();
    setIsEditing(true);
  };

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const setFood = (key, patch) =>
    setForm((f) => ({
      ...f,
      food: { ...f.food, [key]: { ...f.food[key], ...patch } },
    }));

  const setAddon = (key, patch) =>
    setForm((f) => ({
      ...f,
      addons: { ...f.addons, [key]: { ...f.addons[key], ...patch } },
    }));

  const houseVenueSelected = useMemo(() => {
    if (form.venueMode !== 'house_venue') return false;
    return houseVenues.includes(form.venue) || form.venue === 'Other';
  }, [form.venue, form.venueMode, houseVenues]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (form.addons.cheeseboard.enabled) {
        const amt = numOrNull(form.addons.cheeseboard.amount);
        if (amt == null || amt < CHEESEBOARD_MIN) {
          throw new Error(
            `Cheeseboard requires a minimum of ${CHEESEBOARD_MIN} units`
          );
        }
      }

      const payload = {
        eventId,
        startTime: form.startTime || null,
        eventDate: form.eventDate
          ? new Date(`${form.eventDate}T12:00:00`).toISOString()
          : null,
        pocName: form.pocName || null,
        pocEmail: form.pocEmail || null,
        pocPhone: form.pocPhone || null,
        headcountMin: numOrNull(form.headcountMin),
        headcountMax: numOrNull(form.headcountMax),
        alcoholIncluded: form.alcoholIncluded,
        barDetails: form.alcoholIncluded
          ? {
              paymentMode:
                form.barPaymentMode === 'Other'
                  ? 'Other'
                  : form.barPaymentMode || null,
              paymentModeOther: form.barPaymentModeOther || null,
              wineBeerSoft: form.wineBeerSoft,
              mixedDrinks: form.mixedDrinks || null,
            }
          : null,
        isCompetition: isCooking ? form.isCompetition : false,
        dishConfiguration:
          isCooking && form.dishConfiguration
            ? form.dishConfiguration
            : null,
        dishConfigurationOther: form.dishConfigurationOther || null,
        foodAdditions: {
          charcuterie: {
            enabled: form.food.charcuterie.enabled,
            style: form.food.charcuterie.style,
            amount: numOrNull(form.food.charcuterie.amount),
          },
          additionalProtein: {
            enabled: form.food.additionalProtein.enabled,
            amount: numOrNull(form.food.additionalProtein.amount),
          },
          mysteryIngredients: {
            enabled: isCooking && form.food.mysteryIngredients.enabled,
            amount: numOrNull(form.food.mysteryIngredients.amount),
          },
          alternativeSauces: {
            enabled: isCooking && form.food.alternativeSauces.enabled,
            amount: numOrNull(form.food.alternativeSauces.amount),
          },
          flavorsOfDcWarmMeal: {
            enabled: form.food.flavorsOfDcWarmMeal.enabled,
            amount: numOrNull(form.food.flavorsOfDcWarmMeal.amount),
          },
        },
        customAddons: {
          embroideredAprons: {
            enabled: form.addons.embroideredAprons.enabled,
            amount: numOrNull(form.addons.embroideredAprons.amount),
            customName: form.addons.embroideredAprons.customName,
            logoOrdered: form.addons.embroideredAprons.logoOrdered,
            embroidered: true,
          },
          engravedGlassware: {
            enabled: form.addons.engravedGlassware.enabled,
            amount: numOrNull(form.addons.engravedGlassware.amount),
          },
          cheeseboard: {
            enabled: form.addons.cheeseboard.enabled,
            amount: numOrNull(form.addons.cheeseboard.amount),
          },
          chocolateMold: {
            enabled: form.addons.chocolateMold.enabled,
            amount: numOrNull(form.addons.chocolateMold.amount),
          },
          chefHats: {
            enabled: form.addons.chefHats.enabled,
            amount: numOrNull(form.addons.chefHats.amount),
            embroidered: form.addons.chefHats.embroidered,
          },
          berets: {
            enabled: form.addons.berets.enabled,
            amount: numOrNull(form.addons.berets.amount),
            embroidered: form.addons.berets.embroidered,
          },
        },
        transportationNeeded: form.transportationNeeded,
        transportCompany:
          form.transportCompany === 'Alberto'
            ? 'Sammy Transport'
            : form.transportCompany || null,
        transportCompanyOther: form.transportCompanyOther || null,
        venueMode: form.venueMode,
        venue:
          form.venueMode === 'house_venue'
            ? houseVenueSelected
              ? form.venue
              : form.venue || 'Other'
            : null,
        venueOther:
          form.venueMode === 'go_to_them'
            ? form.venueOther || form.venue
            : form.venue === 'Other'
              ? form.venueOther
              : null,
        venueRestrictions: form.venueRestrictions || null,
        ...(canViewDeposit
          ? { depositAmount: numOrNull(form.depositAmount) }
          : {}),
        participationListUrl: form.participationListUrl || null,
        participationListType: form.participationListType || null,
      };

      const res = await base44.functions.invoke(
        'completeDepositIntake',
        payload
      );
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['event', eventId]);
      queryClient.invalidateQueries(['event-tasks', eventId]);
      queryClient.invalidateQueries(['deposit-intake', eventId]);
      setIsEditing(false);
      const tasks = data?.workflow?.tasksCreated ?? 0;
      if (data?.updated) {
        toast.success('Deposit intake updated');
      } else {
        toast.success(
          tasks > 0
            ? `Deposit intake saved — ${tasks} workflow tasks created`
            : 'Deposit intake saved'
        );
      }
    },
    onError: (err) => {
      toast.error(err?.message || 'Failed to save deposit intake');
    },
  });

  const completedAt =
    event?.deposit_intake_completed_at || intakeState?.completedAt;
  const depositMilestone = getPanelMilestoneLabel('deposit', event);

  if (completed && !isEditing) {
    const summaryRows = formatIntakeSummary(sourceEvent, {
      isCooking,
      canViewDeposit,
    });

    return (
      <OpsPanelShell
        title="Deposit Intake"
        icon={ClipboardList}
        complete
        doneBadge
        milestoneLabel={null}
      >
        <div className="rounded-lg border border-green-200 bg-green-50/60 p-4 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="font-medium text-green-900">Deposit intake complete</p>
              <p className="text-sm text-green-700">
                {completedAt
                  ? `Completed ${new Date(completedAt).toLocaleString()}`
                  : 'Fields saved — workflow tasks are live.'}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-green-300 text-green-800 hover:bg-green-100"
              onClick={openEdit}
            >
              View / Edit
            </Button>
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm text-green-950">
            {summaryRows.map((row) => (
              <div
                key={row.label}
                className={
                  row.kind === 'list' ||
                  row.kind === 'link' ||
                  (row.kind === 'details' &&
                    Array.isArray(row.details) &&
                    row.details.length > 0)
                    ? 'sm:col-span-2'
                    : undefined
                }
              >
                <dt className="text-xs font-semibold uppercase tracking-wider text-green-700">
                  {row.label}
                </dt>
                <dd className="text-sm font-semibold text-green-950 break-words mt-1">
                  {row.kind === 'list' ? (
                    <ul className="flex flex-col gap-2 list-none p-0 m-0 font-normal">
                      {row.items.map((item) => (
                        <li
                          key={item.title}
                          className="rounded-md border border-green-200 bg-white/90 px-3 py-2 text-sm text-green-950"
                        >
                          <span className="font-semibold">{item.title}</span>
                          {(item.tags || []).length > 0 ? (
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {(item.tags || []).map((tag) => (
                                <span
                                  key={tag}
                                  className="inline-flex items-center rounded-md border border-green-200 bg-white px-2 py-0.5 text-xs font-medium text-green-800"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : row.kind === 'details' ? (
                    <div className="space-y-1.5">
                      <p>{row.value}</p>
                      {(row.details || []).length > 0 ? (
                        <ul className="flex flex-wrap gap-1.5 list-none p-0 m-0 font-normal">
                          {row.details.map((detail) => (
                            <li
                              key={detail}
                              className="inline-flex items-center rounded-md border border-green-200 bg-white px-2.5 py-1 text-xs font-medium text-green-800"
                            >
                              {detail}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : row.kind === 'link' ? (
                    <span className="flex flex-col gap-1">
                      {row.value ? (
                        <span className="text-sm font-medium text-green-900">
                          {row.value}
                        </span>
                      ) : null}
                      <a
                        href={row.href}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-start gap-1.5 text-[#C84B31] underline underline-offset-2 break-all font-medium hover:text-[#A03A23]"
                      >
                        <span>{row.linkLabel || row.href}</span>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      </a>
                    </span>
                  ) : (
                    row.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </OpsPanelShell>
    );
  }

  return (
    <OpsPanelShell
      title="Deposit Intake"
      icon={ClipboardList}
      complete={false}
      forceOpen
      milestoneLabel={depositMilestone}
    >
      <div className="space-y-6 rounded-lg border border-orange-200 bg-orange-50/40 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="font-normal">
            {completed ? 'Editing' : 'Sales meeting'}
          </Badge>
        </div>
        <p className="text-sm text-gray-600">
          {completed
            ? 'Update intake fields below. Saving does not re-send the deposit notify email.'
            : 'Prefill from CRM — confirm location, preferences, and add-ons. Completing this generates the event workflow and emails Dave, Zach, Monica, and Eileen (Slack alert not required).'}
        </p>
        {/* Core prefill */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>Event date</Label>
            <Input
              type="date"
              value={form.eventDate}
              onChange={(e) => setField('eventDate', e.target.value)}
            />
          </div>
          <div>
            <Label>Start time</Label>
            <Input
              type="time"
              value={form.startTime}
              onChange={(e) => setField('startTime', e.target.value)}
            />
          </div>
          <div>
            <Label>Planner name</Label>
            <Input
              value={form.pocName}
              onChange={(e) => setField('pocName', e.target.value)}
            />
          </div>
          <div>
            <Label>Planner email</Label>
            <Input
              value={form.pocEmail}
              onChange={(e) => setField('pocEmail', e.target.value)}
            />
          </div>
          <div>
            <Label>Planner phone</Label>
            <Input
              value={form.pocPhone}
              onChange={(e) => setField('pocPhone', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Headcount min</Label>
              <Input
                type="number"
                min={0}
                max={999}
                value={form.headcountMin}
                onChange={(e) => setField('headcountMin', e.target.value)}
              />
            </div>
            <div>
              <Label>Headcount max</Label>
              <Input
                type="number"
                min={0}
                max={999}
                value={form.headcountMax}
                onChange={(e) => setField('headcountMax', e.target.value)}
              />
            </div>
          </div>
          {canViewDeposit ? (
            <div>
              <Label>Deposit amount (Dave / Zach / Monica only)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.depositAmount}
                onChange={(e) => setField('depositAmount', e.target.value)}
              />
            </div>
          ) : (
            <div className="text-sm text-gray-500 md:col-span-2">
              Deposit amount is restricted to Dave, Zach, and Monica.
            </div>
          )}
        </section>

        {/* Alcohol */}
        <section className="space-y-3 border-t pt-4">
          <Label className="text-base font-semibold">Alcohol</Label>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={form.alcoholIncluded}
              onCheckedChange={(v) => setField('alcoholIncluded', Boolean(v))}
              id="alcohol"
            />
            <label htmlFor="alcohol" className="text-sm">
              Alcohol included
            </label>
          </div>
          {form.alcoholIncluded && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-1">
              <div>
                <Label>Bar payment</Label>
                <Select
                  value={form.barPaymentMode}
                  onValueChange={(v) => setField('barPaymentMode', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Card on file">Card on file</SelectItem>
                    <SelectItem value="Ticketed">Ticketed</SelectItem>
                    <SelectItem value="Fixed Open Bar">Fixed Open Bar</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.barPaymentMode === 'Other' && (
                <div>
                  <Label>Other payment</Label>
                  <Input
                    value={form.barPaymentModeOther}
                    onChange={(e) =>
                      setField('barPaymentModeOther', e.target.value)
                    }
                  />
                </div>
              )}
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={form.wineBeerSoft}
                  onCheckedChange={(v) => setField('wineBeerSoft', Boolean(v))}
                  id="wineBeer"
                />
                <label htmlFor="wineBeer" className="text-sm">
                  Wine / Beer / Soft drinks
                </label>
              </div>
              <div>
                <Label>Mixed drinks</Label>
                <Select
                  value={form.mixedDrinks}
                  onValueChange={(v) => setField('mixedDrinks', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Optional…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Top Shelf">Top Shelf</SelectItem>
                    <SelectItem value="Rail">Rail</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </section>

        {/* Cooking-only */}
        {isCooking && (
          <section className="space-y-3 border-t pt-4">
            <Label className="text-base font-semibold">Cooking setup</Label>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={form.isCompetition}
                onCheckedChange={(v) => setField('isCompetition', Boolean(v))}
                id="competition"
              />
              <label htmlFor="competition" className="text-sm">
                Competition (vs cooking experience)
              </label>
            </div>
            <div>
              <Label>Dish configuration</Label>
              <Select
                value={form.dishConfiguration}
                onValueChange={(v) => setField('dishConfiguration', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Entree">Entree</SelectItem>
                  <SelectItem value="App + Entree">App + Entree</SelectItem>
                  <SelectItem value="App + Entree + Dessert">
                    App + Entree + Dessert
                  </SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.dishConfiguration === 'Other' && (
              <Input
                placeholder="Describe dish configuration"
                value={form.dishConfigurationOther}
                onChange={(e) =>
                  setField('dishConfigurationOther', e.target.value)
                }
              />
            )}
          </section>
        )}

        {/* Food additions */}
        <section className="space-y-3 border-t pt-4">
          <Label className="text-base font-semibold">Food additions</Label>
          <AddonRow
            label="Charcuterie"
            checked={form.food.charcuterie.enabled}
            onChecked={(v) => setFood('charcuterie', { enabled: v })}
            amount={form.food.charcuterie.amount}
            onAmount={(v) => setFood('charcuterie', { amount: v })}
          >
            {form.food.charcuterie.enabled && (
              <Select
                value={form.food.charcuterie.style || ''}
                onValueChange={(v) => setFood('charcuterie', { style: v })}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Boards / Platters" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="boards">Boards</SelectItem>
                  <SelectItem value="platters">Platters</SelectItem>
                </SelectContent>
              </Select>
            )}
          </AddonRow>
          <AddonRow
            label="Additional protein on the side"
            checked={form.food.additionalProtein.enabled}
            onChecked={(v) => setFood('additionalProtein', { enabled: v })}
            amount={form.food.additionalProtein.amount}
            onAmount={(v) => setFood('additionalProtein', { amount: v })}
          />
          {isCooking && (
            <>
              <AddonRow
                label="Mystery ingredients (competition)"
                checked={form.food.mysteryIngredients.enabled}
                onChecked={(v) => setFood('mysteryIngredients', { enabled: v })}
                amount={form.food.mysteryIngredients.amount}
                onAmount={(v) => setFood('mysteryIngredients', { amount: v })}
              />
              <AddonRow
                label="Alternative sauces (competition)"
                checked={form.food.alternativeSauces.enabled}
                onChecked={(v) => setFood('alternativeSauces', { enabled: v })}
                amount={form.food.alternativeSauces.amount}
                onAmount={(v) => setFood('alternativeSauces', { amount: v })}
              />
            </>
          )}
          <AddonRow
            label="Flavors of DC / Warm Meal (shared)"
            checked={form.food.flavorsOfDcWarmMeal.enabled}
            onChecked={(v) => setFood('flavorsOfDcWarmMeal', { enabled: v })}
            amount={form.food.flavorsOfDcWarmMeal.amount}
            onAmount={(v) => setFood('flavorsOfDcWarmMeal', { amount: v })}
          />
        </section>

        {/* Custom add-ons */}
        <section className="space-y-3 border-t pt-4">
          <Label className="text-base font-semibold">Custom add-ons</Label>
          <AddonRow
            label="Embroidered aprons"
            checked={form.addons.embroideredAprons.enabled}
            onChecked={(v) => setAddon('embroideredAprons', { enabled: v })}
            amount={form.addons.embroideredAprons.amount}
            onAmount={(v) => setAddon('embroideredAprons', { amount: v })}
          >
            {form.addons.embroideredAprons.enabled && (
              <div className="flex flex-wrap gap-3">
                <label className="flex items-center gap-1 text-sm">
                  <Checkbox
                    checked={form.addons.embroideredAprons.customName}
                    onCheckedChange={(v) =>
                      setAddon('embroideredAprons', { customName: Boolean(v) })
                    }
                  />
                  Custom name
                </label>
                <label className="flex items-center gap-1 text-sm">
                  <Checkbox
                    checked={form.addons.embroideredAprons.logoOrdered}
                    onCheckedChange={(v) =>
                      setAddon('embroideredAprons', { logoOrdered: Boolean(v) })
                    }
                  />
                  Logo ordered?
                </label>
              </div>
            )}
          </AddonRow>
          <AddonRow
            label="Custom engraved glassware"
            checked={form.addons.engravedGlassware.enabled}
            onChecked={(v) => setAddon('engravedGlassware', { enabled: v })}
            amount={form.addons.engravedGlassware.amount}
            onAmount={(v) => setAddon('engravedGlassware', { amount: v })}
          />
          <AddonRow
            label={`Custom cheeseboard (${CHEESEBOARD_MIN} unit minimum)`}
            checked={form.addons.cheeseboard.enabled}
            onChecked={(v) => setAddon('cheeseboard', { enabled: v })}
            amount={form.addons.cheeseboard.amount}
            onAmount={(v) => setAddon('cheeseboard', { amount: v })}
          />
          <AddonRow
            label="Chocolate mold"
            checked={form.addons.chocolateMold.enabled}
            onChecked={(v) => setAddon('chocolateMold', { enabled: v })}
            amount={form.addons.chocolateMold.amount}
            onAmount={(v) => setAddon('chocolateMold', { amount: v })}
          />
          <AddonRow
            label="Chef hats"
            checked={form.addons.chefHats.enabled}
            onChecked={(v) => setAddon('chefHats', { enabled: v })}
            amount={form.addons.chefHats.amount}
            onAmount={(v) => setAddon('chefHats', { amount: v })}
          >
            {form.addons.chefHats.enabled && (
              <label className="flex items-center gap-1 text-sm">
                <Checkbox
                  checked={form.addons.chefHats.embroidered}
                  onCheckedChange={(v) =>
                    setAddon('chefHats', { embroidered: Boolean(v) })
                  }
                />
                Embroidered
              </label>
            )}
          </AddonRow>
          <AddonRow
            label="Berets"
            checked={form.addons.berets.enabled}
            onChecked={(v) => setAddon('berets', { enabled: v })}
            amount={form.addons.berets.amount}
            onAmount={(v) => setAddon('berets', { amount: v })}
          >
            {form.addons.berets.enabled && (
              <label className="flex items-center gap-1 text-sm">
                <Checkbox
                  checked={form.addons.berets.embroidered}
                  onCheckedChange={(v) =>
                    setAddon('berets', { embroidered: Boolean(v) })
                  }
                />
                Embroidered
              </label>
            )}
          </AddonRow>
        </section>

        {/* Transport */}
        <section className="space-y-3 border-t pt-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">Transportation</Label>
            <a
              href={VENDOR_DIRECTORY}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-[#C84B31] inline-flex items-center gap-1"
            >
              Vendor Directory <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.transportationNeeded}
              onCheckedChange={(v) =>
                setField('transportationNeeded', Boolean(v))
              }
            />
            Pickup / drop-off needed
          </label>
          {form.transportationNeeded && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Select
                value={form.transportCompany}
                onValueChange={(v) => setField('transportCompany', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Company…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Sammy Transport">
                    Sammy Transport (Alberto)
                  </SelectItem>
                  <SelectItem value="DC Nation Tours">DC Nation Tours</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
              {form.transportCompany === 'Other' && (
                <Input
                  placeholder="Other company"
                  value={form.transportCompanyOther}
                  onChange={(e) =>
                    setField('transportCompanyOther', e.target.value)
                  }
                />
              )}
            </div>
          )}
        </section>

        {/* Venue */}
        <section className="space-y-3 border-t pt-4">
          <Label className="text-base font-semibold">Venue</Label>
          <Select
            value={form.venueMode}
            onValueChange={(v) => setField('venueMode', v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="go_to_them">Go to them</SelectItem>
              <SelectItem value="house_venue">House venue</SelectItem>
            </SelectContent>
          </Select>
          {form.venueMode === 'house_venue' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Select
                value={form.venue}
                onValueChange={(v) => setField('venue', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select venue…" />
                </SelectTrigger>
                <SelectContent>
                  {houseVenues.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
              {form.venue === 'Other' && (
                <Input
                  placeholder="Other venue name"
                  value={form.venueOther}
                  onChange={(e) => setField('venueOther', e.target.value)}
                />
              )}
            </div>
          ) : (
            <Input
              placeholder="Client venue / address"
              value={form.venueOther}
              onChange={(e) => setField('venueOther', e.target.value)}
            />
          )}
          <div>
            <Label>Venue restrictions</Label>
            <Textarea
              rows={2}
              value={form.venueRestrictions}
              onChange={(e) => setField('venueRestrictions', e.target.value)}
              placeholder="Loading dock, noise, capacity…"
            />
          </div>
        </section>

        {/* Admin participation */}
        <section className="space-y-3 border-t pt-4">
          <Label className="text-base font-semibold">
            Participation list (Admin)
          </Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Select
              value={form.participationListType}
              onValueChange={(v) => setField('participationListType', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sheets or Forms…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sheets">Google Sheets</SelectItem>
                <SelectItem value="forms">Google Forms</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Participation list URL"
              value={form.participationListUrl}
              onChange={(e) => setField('participationListUrl', e.target.value)}
            />
          </div>
        </section>

        <div className="flex justify-end gap-2 border-t pt-4">
          {completed && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditing(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
          )}
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="bg-[#C84B31] hover:bg-[#A03A23]"
          >
            {mutation.isPending
              ? 'Saving…'
              : completed
                ? 'Save changes'
                : 'Complete deposit intake'}
          </Button>
        </div>
        {!user && (
          <p className="text-xs text-amber-700">Sign in required to submit.</p>
        )}
      </div>
    </OpsPanelShell>
  );
}

function AddonRow({ label, checked, onChecked, amount, onAmount, children }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
      <label className="flex items-center gap-2 text-sm min-w-[220px]">
        <Checkbox
          checked={checked}
          onCheckedChange={(v) => onChecked(Boolean(v))}
        />
        {label}
      </label>
      {checked && (
        <>
          <Input
            className="w-[120px]"
            type="number"
            min={0}
            placeholder="Amount"
            value={amount}
            onChange={(e) => onAmount(e.target.value)}
          />
          {children}
        </>
      )}
    </div>
  );
}
