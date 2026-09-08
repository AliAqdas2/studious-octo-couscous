import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users } from 'lucide-react';

/**
 * @param {{
 *   rows: Array<{
 *     userId: string|null,
 *     name: string,
 *     assigned: number,
 *     done: number,
 *     open: number,
 *     overdue: number,
 *     pct: number,
 *   }>,
 *   onSelectAssignee?: (userId: string) => void,
 *   subtitle?: string,
 *   emptyText?: string,
 * }} props
 */
const TeamWorkloadTable = ({
  rows,
  onSelectAssignee,
  subtitle = 'Workload on ops-panel assignments',
  emptyText = 'No panel assignments yet.',
}) => {
  return (
    <Card className="bg-white/90 border-orange-100 h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
          <Users className="w-4 h-4 text-[#C84B31]" />
          Team performance
        </CardTitle>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-sm text-center text-gray-500">
            {emptyText}
          </p>
        ) : (
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="border-b text-left text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-2 font-medium">Person</th>
                  <th className="px-4 py-2 font-medium text-right">Assigned</th>
                  <th className="px-4 py-2 font-medium text-right">Done</th>
                  <th className="px-4 py-2 font-medium text-right">Open</th>
                  <th className="px-4 py-2 font-medium text-right">Overdue</th>
                  <th className="px-4 py-2 font-medium text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.userId || '__unassigned__'}
                    className="border-b last:border-0 hover:bg-orange-50/40"
                  >
                    <td className="px-4 py-2.5">
                      {row.userId && onSelectAssignee ? (
                        <button
                          type="button"
                          className="text-[#C84B31] hover:underline font-medium text-left"
                          onClick={() => onSelectAssignee(row.userId)}
                        >
                          {row.name}
                        </button>
                      ) : (
                        <span className="font-medium text-gray-800">
                          {row.name}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-700">
                      {row.assigned}
                    </td>
                    <td className="px-4 py-2.5 text-right text-green-700">
                      {row.done}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-700">
                      {row.open}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right font-medium ${
                        row.overdue > 0 ? 'text-red-600' : 'text-gray-500'
                      }`}
                    >
                      {row.overdue}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-800">
                      {row.pct}%
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

export default TeamWorkloadTable;
