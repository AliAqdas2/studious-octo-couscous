import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';

/**
 * @param {{
 *   rows: Array<{
 *     panelId: string,
 *     label: string,
 *     open: number,
 *     overdue: number,
 *     done: number,
 *     total: number,
 *   }>,
 * }} props
 */
const PanelBottleneckBars = ({ rows }) => {
  const maxOpen = useMemo(
    () => Math.max(1, ...rows.map((r) => r.open + r.overdue)),
    [rows]
  );

  return (
    <Card className="bg-white/90 border-orange-100 h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-[#C84B31]" />
          Panel bottlenecks
        </CardTitle>
        <p className="text-xs text-gray-500">
          Which ops panels are still open across events
        </p>
      </CardHeader>
      <CardContent className="space-y-3 pt-1">
        {rows.length === 0 ? (
          <p className="py-6 text-sm text-center text-gray-500">
            No panel data yet.
          </p>
        ) : (
          rows.map((row) => {
            const openPct = Math.round(((row.open - row.overdue) / maxOpen) * 100);
            const overduePct = Math.round((row.overdue / maxOpen) * 100);
            const safeOpen = Math.max(0, openPct);
            return (
              <div key={row.panelId}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-gray-800">{row.label}</span>
                  <span className="text-gray-500">
                    {row.open} open
                    {row.overdue > 0 ? (
                      <span className="text-red-600"> · {row.overdue} overdue</span>
                    ) : null}
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden flex">
                  {row.overdue > 0 ? (
                    <div
                      className="h-full bg-red-500"
                      style={{ width: `${overduePct}%` }}
                      title={`${row.overdue} overdue`}
                    />
                  ) : null}
                  {row.open - row.overdue > 0 ? (
                    <div
                      className="h-full bg-[#C84B31]/70"
                      style={{ width: `${safeOpen}%` }}
                      title={`${row.open - row.overdue} open`}
                    />
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
};

export default PanelBottleneckBars;
