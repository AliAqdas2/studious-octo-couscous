import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

/**
 * @param {{
 *   items: Array<{
 *     eventId: string,
 *     eventName: string,
 *     panelId: string,
 *     label: string,
 *     assigneeId: unknown,
 *     daysOverdue: number,
 *   }>,
 *   nameFor: (id: unknown) => string|null,
 * }} props
 */
const OverdueQueue = ({ items, nameFor }) => {
  return (
    <Card className="bg-white/90 border-orange-100 h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600" />
          Overdue queue
        </CardTitle>
        <p className="text-xs text-gray-500">Open panels past their due date</p>
      </CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <p className="px-4 py-8 text-sm text-center text-gray-500">
            No overdue panels — nice work.
          </p>
        ) : (
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="border-b text-left text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-2 font-medium">Event</th>
                  <th className="px-4 py-2 font-medium">Panel</th>
                  <th className="px-4 py-2 font-medium">Assignee</th>
                  <th className="px-4 py-2 font-medium text-right">Overdue</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr
                    key={`${row.eventId}-${row.panelId}`}
                    className="border-b last:border-0 hover:bg-red-50/40"
                  >
                    <td className="px-4 py-2.5">
                      <Link
                        to={
                          createPageUrl('EventDetail') + `?id=${row.eventId}`
                        }
                        className="text-[#C84B31] hover:underline font-medium"
                      >
                        {row.eventName}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-gray-800">{row.label}</td>
                    <td className="px-4 py-2.5 text-gray-600">
                      {nameFor(row.assigneeId) || (
                        <span className="text-gray-400">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-red-600">
                      {row.daysOverdue}d
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default OverdueQueue;
