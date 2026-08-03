import React from 'react';
import { Badge } from '@/components/ui/badge';

const COLORS = {
  Initiated: 'bg-blue-100 text-blue-800 border-blue-200',
  Ringing: 'bg-blue-100 text-blue-800 border-blue-200',
  'In Progress': 'bg-amber-100 text-amber-800 border-amber-200',
  Completed: 'bg-green-100 text-green-800 border-green-200',
  Analyzed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'No Answer': 'bg-gray-100 text-gray-800 border-gray-200',
  Busy: 'bg-orange-100 text-orange-800 border-orange-200',
  Failed: 'bg-red-100 text-red-800 border-red-200',
  'Rep Declined': 'bg-red-100 text-red-800 border-red-200'
};

export default function CallStatusBadge({ status }) {
  const cls = COLORS[status] || 'bg-gray-100 text-gray-800 border-gray-200';
  return <Badge variant="outline" className={cls}>{status || 'Unknown'}</Badge>;
}