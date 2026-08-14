import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Badge } from '@/components/ui/badge';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { format } from 'date-fns';
import { STAGE_COLORS, onboardingStrings } from './strings';

const COLUMNS = [
  { key: 'name', label: 'Name', sortKey: 'name' },
  { key: 'job_role', label: 'Role', sortKey: 'job_role' },
  { key: 'hire_type', label: 'Hire type', sortKey: 'hire_type' },
  { key: 'source', label: 'Source', sortKey: 'source' },
  { key: 'stage', label: 'Stage', sortKey: 'stage' },
  { key: 'updated_date', label: 'Updated', sortKey: 'updated_date' },
];

function SortIcon({ active, dir }) {
  if (!active) return <ArrowUpDown className="h-3.5 w-3.5 text-gray-400" />;
  return dir === 'asc' ? (
    <ArrowUp className="h-3.5 w-3.5 text-[#C84B31]" />
  ) : (
    <ArrowDown className="h-3.5 w-3.5 text-[#C84B31]" />
  );
}

export default function CandidateListView({ candidates }) {
  const [sortKey, setSortKey] = useState('updated_date');
  const [sortDir, setSortDir] = useState('desc');

  const sorted = useMemo(() => {
    const rows = [...candidates];
    rows.sort((a, b) => {
      let av = a[sortKey] ?? '';
      let bv = b[sortKey] ?? '';
      if (sortKey === 'updated_date' || sortKey === 'created_date') {
        av = av ? new Date(av).getTime() : 0;
        bv = bv ? new Date(bv).getTime() : 0;
      } else {
        av = String(av).toLowerCase();
        bv = String(bv).toLowerCase();
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return rows;
  }, [candidates, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'updated_date' ? 'desc' : 'asc');
    }
  };

  if (candidates.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-orange-100 bg-white overflow-x-auto shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-orange-100 bg-orange-50/50 text-left">
            {COLUMNS.map((col) => (
              <th key={col.key} className="px-3 py-2.5 font-medium">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 hover:text-[#C84B31]"
                  onClick={() => toggleSort(col.sortKey)}
                >
                  {col.label}
                  <SortIcon active={sortKey === col.sortKey} dir={sortDir} />
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((c) => {
            const stage = c.stage || 'Application Received';
            const updated = c.updated_date || c.created_date;
            return (
              <tr
                key={c.id}
                className="border-b border-orange-50 hover:bg-orange-50/40"
              >
                <td className="px-3 py-2.5">
                  <Link
                    to={createPageUrl(`CandidateDetail?id=${c.id}`)}
                    className="font-medium text-[#C84B31] hover:underline"
                  >
                    {c.name}
                  </Link>
                  <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                    {c.email}
                  </p>
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">{c.job_role}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{c.hire_type}</td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  {c.source}
                  {c.source_detail ? (
                    <span className="block text-[11px]">{c.source_detail}</span>
                  ) : null}
                </td>
                <td className="px-3 py-2.5">
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-normal ${STAGE_COLORS[stage] || ''}`}
                  >
                    {stage}
                  </Badge>
                </td>
                <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                  {updated
                    ? format(new Date(updated), 'MMM d, yyyy')
                    : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="px-3 py-2 text-xs text-muted-foreground border-t border-orange-50">
        {sorted.length} {onboardingStrings.listCountLabel}
      </p>
    </div>
  );
}
