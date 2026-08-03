import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Star, Upload, Download, ArrowUp, ArrowDown, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Calendar, LayoutGrid, GripVertical, Copy, MoreVertical, Phone } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import NeedsReviewBadge from '@/components/leads/NeedsReviewBadge';
import AiFlagBadge from '@/components/leads/AiFlagBadge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import LeadFormDialog from '@/components/leads/LeadFormDialog';
import ImportLeadsDialog from '@/components/leads/ImportLeadsDialog';
import { toast } from 'sonner';
import { B2C_STAGES, B2B_STAGES, STAGE_COLORS, CHANNEL_COLORS } from '@/components/leads/pipelineConfig';
import StageTooltip from '@/components/leads/StageTooltip';
import StageGroupFilter from '@/components/leads/StageGroupFilter';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns';

const SOURCE_OPTIONS = ['Website', 'Email', 'Phone', 'Referral', 'Call', 'Form', 'Other'];

const EVENT_TYPE_OPTIONS = [
  'Cooking Class',
  'Paint & Sip',
  'Mixology Class',
  'Chocolate Making',
  'Chocolate and Wine Tasting',
  'Terrarium Building',
  'Cheese Board Making',
  'Lend a Hand for Good',
  'Yoga and unWINEd',
  'Alcohol Tasting',
  'Flavors of DC',
  'Baking Class',
  'Dine Around',
  'Georgetown Food Tour',
  'DuPont Food Tour',
  'Premium Food Tour',
  'Scavenger',
  'Monuments Tour',
  'Wine/Whiskey Tasting',
  'Bike Tour',
  'Hand-Crafted Pottery Class',
  'DC at your Door',
  'The Guac Gourmet Showdown',
  'Other',
];

const TABLE_COLUMN_CONFIG = {
  stage: { label: 'Stage', sortKey: 'stage', thClassName: '' },
  company: { label: 'Account', sortKey: 'company', thClassName: '' },
  name: { label: 'Name (POC)', sortKey: 'name', thClassName: '' },
  channel: { label: 'Channel', sortKey: 'channel', thClassName: '' },
  source: { label: 'Source', sortKey: 'source', thClassName: '' },
  created_date: { label: 'Date of Inquiry', sortKey: 'created_date', thClassName: '' },
  preferred_date: { label: 'Date of Interest', sortKey: 'preferred_date', thClassName: '' },
  event_type_interest: { label: 'Event', sortKey: 'event_type_interest', thClassName: '' },
  email: { label: 'Email Address', sortKey: 'email', thClassName: '' },
  phone: { label: 'Phone', sortKey: 'phone', thClassName: '' },
  headcount_estimate: { label: 'Headcount', sortKey: 'headcount_estimate', thClassName: 'text-right' },
};

const TABLE_COLUMN_KEYS = Object.keys(TABLE_COLUMN_CONFIG);

const LEADS_VISIBLE_COLUMNS_KEY = 'mangia_leads_visible_columns';

function getVisibleColumnsFromStorage() {
  try {
    const raw = localStorage.getItem(LEADS_VISIBLE_COLUMNS_KEY);
    if (!raw) return [...TABLE_COLUMN_KEYS];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...TABLE_COLUMN_KEYS];
    const valid = parsed.filter((k) => TABLE_COLUMN_KEYS.includes(k));
    return valid.length > 0 ? valid : [...TABLE_COLUMN_KEYS];
  } catch {
    return [...TABLE_COLUMN_KEYS];
  }
}

function saveVisibleColumnsToStorage(columns) {
  try {
    localStorage.setItem(LEADS_VISIBLE_COLUMNS_KEY, JSON.stringify(columns));
  } catch {}
}

const DATE_PRESET_OPTIONS = [
  { id: '', label: 'Any' },
  { id: 'today', label: 'Today' },
  { id: 'this_week', label: 'This week' },
  { id: 'this_month', label: 'This month' },
  { id: 'last_30', label: 'Last 30 days' },
  { id: 'custom', label: 'Custom range' },
];

function getDatePresetRange(presetId) {
  const now = new Date();
  switch (presetId) {
    case 'today': {
      const d = format(now, 'yyyy-MM-dd');
      return { from: d, to: d };
    }
    case 'this_week':
      return {
        from: format(startOfWeek(now, { weekStartsOn: 0 }), 'yyyy-MM-dd'),
        to: format(endOfWeek(now, { weekStartsOn: 0 }), 'yyyy-MM-dd'),
      };
    case 'this_month':
      return {
        from: format(startOfMonth(now), 'yyyy-MM-dd'),
        to: format(endOfMonth(now), 'yyyy-MM-dd'),
      };
    case 'last_30':
      return {
        from: format(subDays(now, 29), 'yyyy-MM-dd'),
        to: format(now, 'yyyy-MM-dd'),
      };
    default:
      return { from: '', to: '' };
  }
}

const B2B_STAGE_ORDER = [
  'New Inquiry',
  'Initial Outreach – Call to Schedule',
  'Survey Sent',
  'Awaiting Survey Response (24hr)',
  'No Survey Response – Follow-Up 1',
  'Awaiting Response After Follow-Up 1',
  'No Response – Follow-Up 2',
  'Awaiting Response After Follow-Up 2',
  'No Response – Final Email Sent',
  'Survey Completed – Calendar Invite Sent',
  'Awaiting Calendar Acceptance',
  'Calendar Invite Resent',
  'Calendar Accepted',
  'Program Planning Discussion',
  'After Meeting Follow-Up',
  'Deposit Requested',
  'Confirmed Sales',
  'Lost/Canceled',
];

const B2C_STAGE_ORDER = [
  'New Inquiry',
  'Outreach Initiated – Call Attempted',
  'No Answer – 1st Email Sent',
  'Calendar Invite Sent',
  'Invite Not Accepted',
  '2nd Follow-Up – Off Radar',
  'No Response – Final Email Sent',
  'Invite Accepted – Survey Sent',
  'Program Planning Discussion',
  'After Meeting Follow-Up',
  'Deposit Requested',
  'Confirmed Sales',
  'Lost/Canceled',
];

function getStageIndex(stage, channel) {
  if (channel === 'B2C') {
    const idx = B2C_STAGE_ORDER.indexOf(stage);
    return idx >= 0 ? idx : 999;
  }
  // Default to B2B order, or try both
  const b2bIdx = B2B_STAGE_ORDER.indexOf(stage);
  if (b2bIdx >= 0) return b2bIdx;
  const b2cIdx = B2C_STAGE_ORDER.indexOf(stage);
  if (b2cIdx >= 0) return b2cIdx;
  return 999;
}

function SortableHeader({ label, sortKey, sort, onSort, className = '' }) {
  const isActive = sort.key === sortKey;
  const Icon = isActive && sort.dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th
      className={`text-left px-1.5 py-1.5 md:px-4 md:py-3 cursor-pointer select-none group ${className}`}
      onClick={() => onSort(sortKey)}
    >
      <span className={`inline-flex items-center gap-1 ${isActive ? 'font-extrabold text-gray-900' : 'font-semibold text-gray-600'}`}>
        {label}
        <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-[#007bff] stroke-[3]' : 'text-gray-300 group-hover:text-gray-400'}`} />
      </span>
    </th>
  );
}

const SORT_STORAGE_KEY = 'leads_sort_preference';
const FILTERS_STORAGE_KEY = 'leads_filters_session';

function getSavedSort() {
  try {
    const saved = localStorage.getItem(SORT_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return { key: 'created_date', dir: 'desc' };
}

function getSavedFilters() {
  try {
    const saved = sessionStorage.getItem(FILTERS_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return {};
}

function saveFiltersToStorage(filters) {
  try { sessionStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters)); } catch {}
}

export default function Leads() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [duplicatePrefill, setDuplicatePrefill] = useState(null);
  const [callConfirmLead, setCallConfirmLead] = useState(null);
  const [isCalling, setIsCalling] = useState(false);
  const urlParams = new URLSearchParams(window.location.search);
  const initialStage = urlParams.get('stage');
  const savedFilters = getSavedFilters();
  const [searchTerm, setSearchTerm] = useState(savedFilters.searchTerm || '');
  const [debouncedSearch, setDebouncedSearch] = useState(savedFilters.searchTerm || '');
  const [filterStages, setFilterStages] = useState(initialStage ? [initialStage] : (savedFilters.filterStages || []));
  const [filterChannel, setFilterChannel] = useState(savedFilters.filterChannel || 'all');
  const [sort, setSort] = useState(getSavedSort);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(savedFilters.showAdvancedFilters || false);
  const [filterSource, setFilterSource] = useState(savedFilters.filterSource || 'all');
  const [inquiryDatePreset, setInquiryDatePreset] = useState(savedFilters.inquiryDatePreset || '');
  const [interestDatePreset, setInterestDatePreset] = useState(savedFilters.interestDatePreset || '');
  const [dateInquiryFrom, setDateInquiryFrom] = useState(savedFilters.dateInquiryFrom || '');
  const [dateInquiryTo, setDateInquiryTo] = useState(savedFilters.dateInquiryTo || '');
  const [dateInterestFrom, setDateInterestFrom] = useState(savedFilters.dateInterestFrom || '');
  const [dateInterestTo, setDateInterestTo] = useState(savedFilters.dateInterestTo || '');
  const [filterEventType, setFilterEventType] = useState(savedFilters.filterEventType || 'all');
  const [filterAccount, setFilterAccount] = useState(savedFilters.filterAccount || '');
  const [visibleColumns, setVisibleColumns] = useState(getVisibleColumnsFromStorage);
  const [currentPage, setCurrentPage] = useState(savedFilters.currentPage || 1);
  const [pageSize, setPageSize] = useState(savedFilters.pageSize || 25);

  // Debounce search so we don't fire on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 350);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Reset to page 1 whenever any filter/search/sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, filterStages, filterChannel, filterSource, filterEventType, filterAccount,
      inquiryDatePreset, interestDatePreset, dateInquiryFrom, dateInquiryTo, dateInterestFrom, dateInterestTo,
      sort, pageSize]);

  // Persist filter state to sessionStorage so filters survive navigating away and back
  useEffect(() => {
    saveFiltersToStorage({
      searchTerm, filterStages, filterChannel, showAdvancedFilters,
      filterSource, inquiryDatePreset, interestDatePreset,
      dateInquiryFrom, dateInquiryTo, dateInterestFrom, dateInterestTo,
      filterEventType, filterAccount, currentPage, pageSize
    });
  }, [searchTerm, filterStages, filterChannel, showAdvancedFilters,
      filterSource, inquiryDatePreset, interestDatePreset,
      dateInquiryFrom, dateInquiryTo, dateInterestFrom, dateInterestTo,
      filterEventType, filterAccount, currentPage, pageSize]);

  const inquiryRange = inquiryDatePreset === 'custom'
    ? { from: dateInquiryFrom, to: dateInquiryTo }
    : inquiryDatePreset ? getDatePresetRange(inquiryDatePreset) : { from: '', to: '' };
  const interestRange = interestDatePreset === 'custom'
    ? { from: dateInterestFrom, to: dateInterestTo }
    : interestDatePreset ? getDatePresetRange(interestDatePreset) : { from: '', to: '' };

  const queryPayload = {
    pageNumber: currentPage,
    pageSize,
    searchQuery: debouncedSearch,
    sortKey: sort.key,
    sortDir: sort.dir,
    filterStages,
    filterChannel,
    filterSource,
    filterEventType,
    filterAccount,
    dateInquiryFrom: inquiryRange.from,
    dateInquiryTo: inquiryRange.to,
    dateInterestFrom: interestRange.from,
    dateInterestTo: interestRange.to,
  };

  const { data: result, isLoading } = useQuery({
    queryKey: ['leads-paginated', queryPayload],
    queryFn: async () => {
      const res = await base44.functions.invoke('getLeadsPaginated', queryPayload);
      return res.data;
    },
    keepPreviousData: true,
  });

  const leads = result?.data ?? [];
  const totalCount = result?.totalCount ?? 0;
  const totalPages = result?.totalPages ?? 1;

  const handleSort = (key) => {
    const newSort = sort.key === key
      ? { key, dir: sort.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: 'asc' };
    setSort(newSort);
    localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify(newSort));
  };

  const updateChannelMutation = useMutation({
    mutationFn: async ({ leadId, channel }) => {
      return base44.entities.Lead.update(leadId, { channel, stage: 'New Inquiry' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads-paginated'] });
      setCurrentPage(1);
      toast.success('Channel updated — stage reset to New Inquiry');
    },
  });

  // filteredLeads is just the server-returned page
  const filteredLeads = leads;



  const hasAdvancedFilters = filterSource !== 'all' || inquiryDatePreset || interestDatePreset || dateInquiryFrom || dateInquiryTo || dateInterestFrom || dateInterestTo || filterEventType !== 'all' || filterAccount.trim() !== '';

  const clearAdvancedFilters = () => {
    setFilterSource('all');
    setInquiryDatePreset('');
    setInterestDatePreset('');
    setDateInquiryFrom('');
    setDateInquiryTo('');
    setDateInterestFrom('');
    setDateInterestTo('');
    setFilterEventType('all');
    setFilterAccount('');
    sessionStorage.removeItem(FILTERS_STORAGE_KEY);
  };

  const exportColumns = ['name', 'email', 'phone', 'company', 'channel', 'source', 'stage', 'created_date', 'preferred_date', 'preferred_time', 'event_type_interest', 'event_format', 'headcount_estimate', 'inquiry_type', 'client_type', 'referral_source', 'referral_source_other', 'is_priority', 'meeting_date', 'assigned_sales_rep', 'deposit_number', 'deposit_amount', 'notes', 'last_contact_date'];

  const formatExportDate = (val) => {
    if (!val) return '';
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return '';
      return format(d, 'yyyy-MM-dd');
    } catch { return ''; }
  };

  const formatExportTime = (val) => {
    if (!val) return '';
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return '';
      return format(d, 'HH:mm:ss');
    } catch { return ''; }
  };

  const getExportCellValue = (lead, col) => {
    switch (col) {
      case 'preferred_date':
        return formatExportDate(lead.preferred_date);
      case 'preferred_time':
        return formatExportTime(lead.preferred_date);
      default:
        return lead[col];
    }
  };
  const pageStart = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const pageEnd = Math.min(currentPage * pageSize, totalCount);

  const escapeCsvValue = (val) => {
    if (val == null || val === '') return '';
    const s = String(val);
    if (/[,"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const handleTriggerCall = async (lead) => {
    setIsCalling(true);
    try {
      const res = await base44.functions.invoke('triggerCallTwiML', { leadId: lead.id });
      if (res.data?.success) {
        toast.success(`Call initiated for ${lead.name}`);
      } else {
        toast.error(res.data?.message || 'Failed to initiate call');
      }
    } catch (e) {
      toast.error('Failed to initiate call');
    }
    setIsCalling(false);
    setCallConfirmLead(null);
  };

  const handleExportCsv = async () => {
    if (totalCount === 0) { toast.error('No leads to export'); return; }
    toast.info('Preparing export...');
    const res = await base44.functions.invoke('getLeadsPaginated', { ...queryPayload, pageNumber: 1, pageSize: 10000 });
    const allLeads = res.data?.data ?? [];
    const header = exportColumns.join(',');
    const rows = allLeads.map((lead) => exportColumns.map((col) => escapeCsvValue(getExportCellValue(lead, col))).join(','));
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${allLeads.length} leads`);
  };

  const excludedCount = TABLE_COLUMN_KEYS.length - visibleColumns.length;
  const columnsDropdownLabel = excludedCount === 0 ? 'All' : excludedCount === 1 ? '1 excluded' : `${excludedCount} excluded`;

  const handleColumnChecked = (key, checked) => {
    if (checked) {
      // Re-add at end of current visible order (preserve user's order)
      const next = [...visibleColumns, key];
      setVisibleColumns(next);
      saveVisibleColumnsToStorage(next);
    } else {
      if (visibleColumns.length <= 1) return;
      const next = visibleColumns.filter((k) => k !== key);
      setVisibleColumns(next);
      saveVisibleColumnsToStorage(next);
    }
  };

  const handleColumnDragEnd = (result) => {
    if (!result.destination) return;
    const reordered = Array.from(visibleColumns);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    setVisibleColumns(reordered);
    saveVisibleColumnsToStorage(reordered);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-[#C84B31] mb-2">Leads</h1>
          <p className="text-gray-600">Manage your sales pipeline and customer inquiries</p>
        </div>
        <div className="flex flex-nowrap items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" className="shrink-0 h-9" onClick={() => setShowImport(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Import
          </Button>
          <Button variant="outline" size="sm" className="shrink-0 h-9" onClick={handleExportCsv} disabled={filteredLeads.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button
            size="sm"
            className="shrink-0 h-9 bg-gradient-to-r from-[#C84B31] to-[#E8B55F] hover:opacity-90 text-white shadow-md"
            onClick={() => setShowForm(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Lead
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-white/80 backdrop-blur-sm border-orange-100 shadow-sm">
        <CardContent className="p-5">
          <Collapsible open={showAdvancedFilters} onOpenChange={setShowAdvancedFilters}>
            {/* Basic filters row */}
            <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
              <div className="flex-1 min-w-0 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <Input
                  placeholder="Search by name, company, or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-10 bg-gray-50/50 border-slate-200 focus:bg-white"
                />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-600 whitespace-nowrap">Channel</label>
                  <Select value={filterChannel} onValueChange={(v) => { setFilterChannel(v); setFilterStages([]); }}>
                    <SelectTrigger className="h-10 w-[120px] border-slate-200 bg-gray-50/50 focus:bg-white">
                      <SelectValue placeholder="Channel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="B2B">B2B</SelectItem>
                      <SelectItem value="B2C">B2C</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-600 whitespace-nowrap">Stage</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="h-10 min-w-[180px] border-slate-200 bg-gray-50/50 justify-between font-normal text-sm">
                        <span className="truncate">
                          {filterStages.length === 0 ? 'All stages' : filterStages.length === 1 ? filterStages[0] : `${filterStages.length} stages`}
                        </span>
                        <ChevronDown className="w-4 h-4 opacity-50 shrink-0 ml-2" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-2" align="start">
                      <div className="flex items-center justify-between px-2 py-1 mb-1">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Pipeline Stages</span>
                        {filterStages.length > 0 && (
                          <button onClick={() => setFilterStages([])} className="text-xs text-[#C84B31] hover:underline font-medium">Clear</button>
                        )}
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        <StageGroupFilter filterStages={filterStages} setFilterStages={setFilterStages} />
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10 gap-1.5 border-slate-200 text-gray-700 hover:bg-orange-50 hover:border-orange-200 hover:text-[#C84B31]"
                  >
                    {showAdvancedFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    Advanced
                    {hasAdvancedFilters ? (
                      <Badge className="h-5 min-w-5 px-1.5 rounded-full bg-[#C84B31]/10 text-[#C84B31] text-xs font-medium">
                        On
                      </Badge>
                    ) : null}
                  </Button>
                </CollapsibleTrigger>
              </div>
            </div>

            {/* Active stage tags row */}
            {filterStages.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {filterStages.map(stage => (
                  <span key={stage} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#C84B31]/10 text-[#C84B31] text-xs font-medium border border-[#C84B31]/20">
                    {stage}
                    <button onClick={() => setFilterStages(prev => prev.filter(s => s !== stage))} className="hover:text-[#A03A23] ml-0.5">×</button>
                  </span>
                ))}
              </div>
            )}

            {/* Advanced filters panel */}
            <CollapsibleContent>
              <div className="mt-5 pt-5 border-t border-orange-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Refine by</p>
                <div className="space-y-4">
                  {/* Row 1: Source + Event */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
                    <div className="flex items-center gap-2 min-w-0">
                      <label className="text-sm font-medium text-gray-700 shrink-0 w-16">Source:</label>
                      <Select value={filterSource} onValueChange={setFilterSource}>
                        <SelectTrigger className="h-9 flex-1 min-w-0 border-slate-200 bg-gray-50/50 py-1.5 text-sm">
                          <SelectValue placeholder="Source" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All sources</SelectItem>
                          {SOURCE_OPTIONS.map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                      <label className="text-sm font-medium text-gray-700 shrink-0 w-16">Event:</label>
                      <Select value={filterEventType} onValueChange={setFilterEventType}>
                        <SelectTrigger className="h-9 flex-1 min-w-0 border-slate-200 bg-gray-50/50 py-1.5 text-sm">
                          <SelectValue placeholder="Event" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All events</SelectItem>
                          {EVENT_TYPE_OPTIONS.map((ev) => (
                            <SelectItem key={ev} value={ev}>{ev}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {/* Row 2: Date of Inquiry - full width */}
                  <div className="flex items-start gap-2 min-w-0">
                    <label className="text-sm font-medium text-gray-700 shrink-0 w-[7.5rem] pt-2">Date of Inquiry:</label>
                    <div className="flex-1 min-w-0 space-y-1.5 max-w-md">
                      <Select value={inquiryDatePreset || 'any'} onValueChange={(v) => setInquiryDatePreset(v === 'any' ? '' : v)}>
                        <SelectTrigger className="h-9 w-full border-slate-200 bg-gray-50/50 py-1.5 text-sm">
                          <SelectValue placeholder="Date range" />
                        </SelectTrigger>
                        <SelectContent>
                          {DATE_PRESET_OPTIONS.map((p) => (
                            <SelectItem key={p.id || 'any'} value={p.id || 'any'}>{p.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {inquiryDatePreset === 'custom' && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="relative flex-1 min-w-[130px]">
                            <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            <Input
                              type="date"
                              value={dateInquiryFrom}
                              onChange={(e) => setDateInquiryFrom(e.target.value)}
                              className="h-9 w-full pl-8 py-1.5 text-sm border-slate-200 bg-gray-50/50"
                            />
                          </div>
                          <span className="text-slate-400 text-sm shrink-0">to</span>
                          <div className="relative flex-1 min-w-[130px]">
                            <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            <Input
                              type="date"
                              value={dateInquiryTo}
                              onChange={(e) => setDateInquiryTo(e.target.value)}
                              className="h-9 w-full pl-8 py-1.5 text-sm border-slate-200 bg-gray-50/50"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Row 3: Date of Interest - full width */}
                  <div className="flex items-start gap-2 min-w-0">
                    <label className="text-sm font-medium text-gray-700 shrink-0 w-[7.5rem] pt-2">Date of Interest:</label>
                    <div className="flex-1 min-w-0 space-y-1.5 max-w-md">
                      <Select value={interestDatePreset || 'any'} onValueChange={(v) => setInterestDatePreset(v === 'any' ? '' : v)}>
                        <SelectTrigger className="h-9 w-full border-slate-200 bg-gray-50/50 py-1.5 text-sm">
                          <SelectValue placeholder="Date range" />
                        </SelectTrigger>
                        <SelectContent>
                          {DATE_PRESET_OPTIONS.map((p) => (
                            <SelectItem key={p.id || 'any'} value={p.id || 'any'}>{p.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {interestDatePreset === 'custom' && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="relative flex-1 min-w-[130px]">
                            <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            <Input
                              type="date"
                              value={dateInterestFrom}
                              onChange={(e) => setDateInterestFrom(e.target.value)}
                              className="h-9 w-full pl-8 py-1.5 text-sm border-slate-200 bg-gray-50/50"
                            />
                          </div>
                          <span className="text-slate-400 text-sm shrink-0">to</span>
                          <div className="relative flex-1 min-w-[130px]">
                            <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            <Input
                              type="date"
                              value={dateInterestTo}
                              onChange={(e) => setDateInterestTo(e.target.value)}
                              className="h-9 w-full pl-8 py-1.5 text-sm border-slate-200 bg-gray-50/50"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Row 4: Account + Clear */}
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <label className="text-sm font-medium text-gray-700 shrink-0 w-16">Account:</label>
                      <Input
                        placeholder="Company name"
                        value={filterAccount}
                        onChange={(e) => setFilterAccount(e.target.value)}
                        className="h-9 w-[140px] border-slate-200 bg-gray-50/50 py-1.5 text-sm"
                      />
                    </div>
                    {hasAdvancedFilters && (
                      <button
                        type="button"
                        onClick={clearAdvancedFilters}
                        className="text-sm text-[#C84B31] hover:underline font-medium"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      {/* Columns control - above table */}
      <div className="flex justify-end">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-1.5 border-slate-200 bg-white text-sm whitespace-nowrap">
              <LayoutGrid className="w-4 h-4 text-gray-500 shrink-0" />
              <span>Columns:</span>
              <span className="font-medium text-gray-800">{columnsDropdownLabel}</span>
              <ChevronDown className="w-4 h-4 opacity-50 shrink-0" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="end">
            <p className="text-xs text-gray-500 mb-1">Drag to reorder. Check to show/hide.</p>
            <div className="max-h-72 overflow-y-auto">
              <DragDropContext onDragEnd={handleColumnDragEnd}>
                <Droppable droppableId="columns">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-0.5">
                      {visibleColumns.map((key, index) => (
                        <Draggable key={key} draggableId={key} index={index}>
                          {(drag, snapshot) => (
                            <div
                              ref={drag.innerRef}
                              {...drag.draggableProps}
                              className={`flex items-center gap-2 py-1.5 px-2 rounded-md ${snapshot.isDragging ? 'bg-orange-50 shadow-md' : 'hover:bg-slate-50'}`}
                            >
                              <span {...drag.dragHandleProps} className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing">
                                <GripVertical className="w-4 h-4" />
                              </span>
                              <Checkbox
                                checked={true}
                                onCheckedChange={() => handleColumnChecked(key, false)}
                                className="h-4 w-4 rounded border-2 border-slate-400 data-[state=checked]:bg-[#C84B31] data-[state=checked]:border-[#C84B31] data-[state=checked]:text-white shrink-0"
                              />
                              <span className="text-sm text-gray-800 flex-1">{TABLE_COLUMN_CONFIG[key].label}</span>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
              {TABLE_COLUMN_KEYS.filter(k => !visibleColumns.includes(k)).map((key) => (
                <div key={key} className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-slate-50">
                  <span className="w-4 h-4 shrink-0" />
                  <Checkbox
                    checked={false}
                    onCheckedChange={() => handleColumnChecked(key, true)}
                    className="h-4 w-4 rounded border-2 border-slate-400 data-[state=checked]:bg-[#C84B31] data-[state=checked]:border-[#C84B31] shrink-0"
                  />
                  <span className="text-sm text-gray-400 flex-1">{TABLE_COLUMN_CONFIG[key].label}</span>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Leads Table */}
      <Card className="bg-white/80 backdrop-blur-sm border-orange-100 shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-center py-12 text-gray-500">Loading leads...</p>
          ) : filteredLeads.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-500">No leads found</p>
            </div>
          ) : (
            (() => {
              const renderLeadCell = (lead, key) => {
              switch (key) {
                case 'channel':
                  return lead.channel ? (
                    <Badge className={`${CHANNEL_COLORS[lead.channel] || 'bg-gray-100 text-gray-700 border-gray-200'} border font-medium text-xs whitespace-nowrap`}>
                      {lead.channel}
                    </Badge>
                  ) : <span className="text-gray-400 text-xs">—</span>;
                case 'source':
                    return <span className="text-gray-600">{lead.source || '—'}</span>;
                  case 'created_date':
                    return <span className="text-gray-600 whitespace-nowrap">{new Date(lead.created_date).toLocaleDateString()}</span>;
                  case 'preferred_date':
                    return <span className="text-gray-600 whitespace-nowrap">{lead.preferred_date ? new Date(lead.preferred_date).toLocaleDateString() : '—'}</span>;
                  case 'event_type_interest':
                    return <span className="text-gray-700 max-w-[160px] truncate block">{lead.event_type_interest || '—'}</span>;
                  case 'company':
                    return <span className="text-gray-700 font-medium max-w-[140px] truncate block">{lead.company || '—'}</span>;
                  case 'name':
                    return (
                      <div className="flex items-center gap-1.5">
                        {lead.is_priority && <Star className="w-3.5 h-3.5 text-[#E8B55F] fill-[#E8B55F] flex-shrink-0" />}
                        <span className="font-medium text-gray-900 group-hover:text-[#C84B31] transition-colors truncate max-w-[120px]">{lead.name}</span>
                      </div>
                    );
                  case 'email':
                    return <span className="text-gray-600 max-w-[180px] truncate block">{lead.email}</span>;
                  case 'phone':
                    return <span className="text-gray-600 whitespace-nowrap">{lead.phone || '—'}</span>;
                  case 'headcount_estimate':
                    return <span className="text-gray-700">{lead.headcount_estimate ?? '—'}</span>;
                  case 'stage':
                    return (
                      <StageTooltip stage={lead.stage}>
                        <span className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold cursor-help whitespace-nowrap ${STAGE_COLORS[lead.stage] || 'bg-gray-100 text-gray-800 border-gray-200'}`}>
                          {lead.stage}
                        </span>
                      </StageTooltip>
                    );
                  default:
                    return '—';
                }
              };

              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] md:text-sm leading-tight md:leading-normal">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50/80">
                        {visibleColumns.map((key) => {
                          const col = TABLE_COLUMN_CONFIG[key];
                          if (!col) return null;
                          return (
                            <SortableHeader
                              key={key}
                              label={col.label}
                              sortKey={col.sortKey}
                              sort={sort}
                              onSort={handleSort}
                              className={col.thClassName || ''}
                            />
                          );
                        })}
                        <th className="px-1.5 py-1.5 md:px-4 md:py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-8 md:w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredLeads.map((lead) => (
                        <tr
                          key={lead.id}
                          className="hover:bg-orange-50/50 transition-colors group cursor-pointer"
                          onClick={() => (window.location.href = createPageUrl(`LeadDetail?id=${lead.id}`))}
                        >
                          {visibleColumns.map((key, idx) => {
                            const col = TABLE_COLUMN_CONFIG[key];
                            const isRight = col?.thClassName?.includes('text-right');
                            const isFirst = idx === 0;
                            return (
                              <td key={key} className={`px-1.5 py-1.5 md:px-4 md:py-3 ${isRight ? 'text-right' : ''}`}>
                                {isFirst ? (
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {lead.reviewed === false && <NeedsReviewBadge />}
                                    {lead.ai_flag_category && (
                                      <AiFlagBadge category={lead.ai_flag_category} reason={lead.ai_flag_reason} />
                                    )}
                                    {renderLeadCell(lead, key)}
                                  </div>
                                ) : (
                                  renderLeadCell(lead, key)
                                )}
                              </td>
                            );
                          })}
                          <td className="px-1.5 py-1.5 md:px-4 md:py-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="icon" className="h-7 w-7 bg-gray-100 hover:bg-gray-200 border-gray-200 text-gray-600">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setCallConfirmLead(lead)}>
                                  <Phone className="w-4 h-4 mr-2 text-green-600" />
                                  Call to Connect Rep
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setDuplicatePrefill({ name: lead.name, company: lead.company, email: lead.email, phone: lead.phone, source: lead.source, client_type: 'Previous', channel: lead.channel, referral_source: lead.referral_source, referral_source_other: lead.referral_source_other })}>
                                  <Copy className="w-4 h-4 mr-2" />
                                  Clone Lead for Contact
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalCount > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-1">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Show</span>
            <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
              <SelectTrigger className="h-8 w-[70px] border-slate-200 bg-white text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[5,10,25, 50, 100, 200].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span>per page · {pageStart}–{pageEnd} of <strong>{totalCount}</strong> leads</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline" size="sm"
              className="h-8 w-8 p-0 border-slate-200"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >«</Button>
            <Button
              variant="outline" size="sm"
              className="h-8 w-8 p-0 border-slate-200"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const half = Math.floor(Math.min(5, totalPages) / 2);
              let start = Math.max(1, currentPage - half);
              let end = Math.min(totalPages, start + Math.min(5, totalPages) - 1);
              if (end - start < Math.min(5, totalPages) - 1) start = Math.max(1, end - Math.min(5, totalPages) + 1);
              return start + i;
            }).map((p) => (
              <Button
                key={p}
                variant={p === currentPage ? 'default' : 'outline'}
                size="sm"
                className={`h-8 w-8 p-0 text-xs ${p === currentPage ? 'bg-[#C84B31] border-[#C84B31] text-white hover:bg-[#A03A23]' : 'border-slate-200'}`}
                onClick={() => setCurrentPage(p)}
              >{p}</Button>
            ))}
            <Button
              variant="outline" size="sm"
              className="h-8 w-8 p-0 border-slate-200"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button
              variant="outline" size="sm"
              className="h-8 w-8 p-0 border-slate-200"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
            >»</Button>
          </div>
        </div>
      )}

      {(showForm || duplicatePrefill) && (
        <LeadFormDialog
          prefillData={duplicatePrefill || undefined}
          onClose={() => { setShowForm(false); setDuplicatePrefill(null); queryClient.invalidateQueries({ queryKey: ['leads-paginated'] }); }}
        />
      )}

      {showImport && (
        <ImportLeadsDialog onClose={() => { setShowImport(false); queryClient.invalidateQueries({ queryKey: ['leads-paginated'] }); }} />
      )}

      <AlertDialog open={!!callConfirmLead} onOpenChange={(open) => { if (!open) setCallConfirmLead(null); }}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-green-700">
              <Phone className="w-5 h-5" />
              Call to Connect Rep
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600">
              This will place an automated call to the rep and connect them with{' '}
              <strong>{callConfirmLead?.name}{callConfirmLead?.company ? ` (${callConfirmLead.company})` : ''}</strong>.
              The rep will hear a brief on this lead before being connected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCalling}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleTriggerCall(callConfirmLead)}
              disabled={isCalling}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isCalling ? 'Initiating...' : 'Yes, Call Now'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}