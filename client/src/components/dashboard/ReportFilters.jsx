import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function ReportFilters({ filters, onChange, salesReps }) {
  const update = (key, value) => onChange({ ...filters, [key]: value });

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-600">Filters:</span>
      </div>
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-gray-400" />
        <Input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => update('dateFrom', e.target.value)}
          className="h-8 w-36 text-xs"
          placeholder="From"
        />
        <span className="text-gray-400 text-xs">to</span>
        <Input
          type="date"
          value={filters.dateTo}
          onChange={(e) => update('dateTo', e.target.value)}
          className="h-8 w-36 text-xs"
          placeholder="To"
        />
      </div>
      <Select value={filters.channel} onValueChange={(v) => update('channel', v)}>
        <SelectTrigger className="h-8 w-28 text-xs">
          <SelectValue placeholder="Channel" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Channels</SelectItem>
          <SelectItem value="B2B">B2B</SelectItem>
          <SelectItem value="B2C">B2C</SelectItem>
        </SelectContent>
      </Select>
      <Select value={filters.rep} onValueChange={(v) => update('rep', v)}>
        <SelectTrigger className="h-8 w-40 text-xs">
          <SelectValue placeholder="Sales Rep" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Reps</SelectItem>
          {salesReps.map((rep) => (
            <SelectItem key={rep.id} value={rep.id}>{rep.full_name || rep.email}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}