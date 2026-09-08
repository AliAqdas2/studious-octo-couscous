import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  CheckSquare,
  Clock,
  Percent,
  UserX,
} from 'lucide-react';

/**
 * @param {{
 *   kpis: {
 *     eventsTracked: number,
 *     panelsCompletePct: number,
 *     panelDone: number,
 *     panelTotal: number,
 *     overduePanels: number,
 *     dueToday: number,
 *     unassignedOpen: number,
 *     atRiskEvents: number,
 *   },
 *   activeFilter?: string,
 *   onSelect?: (key: string) => void,
 *   variant?: 'panels' | 'tasks',
 * }} props
 */
const ProgressKpiStrip = ({
  kpis,
  activeFilter = 'all',
  onSelect,
  variant = 'panels',
}) => {
  const isTasks = variant === 'tasks';
  const items = [
    {
      key: 'all',
      label: 'Events tracked',
      value: kpis.eventsTracked,
      hint: 'Next 60 days',
      icon: Calendar,
      tone: 'text-[#C84B31]',
      bg: 'bg-orange-50',
    },
    {
      key: 'done',
      label: isTasks ? 'Tasks complete' : 'Panels complete',
      value: `${kpis.panelsCompletePct}%`,
      hint: `${kpis.panelDone}/${kpis.panelTotal}`,
      icon: isTasks ? CheckSquare : Percent,
      tone: 'text-green-700',
      bg: 'bg-green-50',
    },
    {
      key: 'overdue',
      label: isTasks ? 'Overdue tasks' : 'Overdue panels',
      value: kpis.overduePanels,
      hint: 'Past due date',
      icon: Clock,
      tone: 'text-red-700',
      bg: 'bg-red-50',
    },
    {
      key: 'due_today',
      label: 'Due today',
      value: kpis.dueToday,
      hint: 'Needs action',
      icon: CheckCircle2,
      tone: 'text-amber-700',
      bg: 'bg-amber-50',
    },
    {
      key: 'unassigned',
      label: 'Unassigned open',
      value: kpis.unassignedOpen,
      hint: 'No Who set',
      icon: UserX,
      tone: 'text-slate-700',
      bg: 'bg-slate-50',
    },
    {
      key: 'at_risk',
      label: 'At-risk events',
      value: kpis.atRiskEvents,
      hint: '≤14 days / behind',
      icon: AlertTriangle,
      tone: 'text-orange-800',
      bg: 'bg-orange-50',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      {items.map((item) => {
        const Icon = item.icon;
        const active = activeFilter === item.key;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelect?.(item.key)}
            className={`text-left rounded-xl border transition-shadow ${
              active
                ? 'border-[#C84B31] ring-2 ring-[#C84B31]/20 shadow-md'
                : 'border-orange-100 hover:shadow-sm'
            } bg-white/90`}
          >
            <Card className="border-0 shadow-none bg-transparent">
              <CardContent className="p-4">
                <div
                  className={`inline-flex items-center justify-center w-8 h-8 rounded-lg ${item.bg} mb-2`}
                >
                  <Icon className={`w-4 h-4 ${item.tone}`} />
                </div>
                <p className={`text-2xl font-bold ${item.tone}`}>{item.value}</p>
                <p className="text-xs font-medium text-gray-800 mt-0.5">
                  {item.label}
                </p>
                <p className="text-[11px] text-gray-500">{item.hint}</p>
              </CardContent>
            </Card>
          </button>
        );
      })}
    </div>
  );
};

export default ProgressKpiStrip;
