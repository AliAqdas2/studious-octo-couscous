import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function TeamPerformanceChart({ leads, users }) {
  // Get leads grouped by assigned_sales_rep
  const repMap = {};

  leads.forEach(lead => {
    const repId = lead.assigned_sales_rep || lead.created_by || 'Unassigned';
    if (!repMap[repId]) {
      repMap[repId] = { total: 0, won: 0, lost: 0, active: 0 };
    }
    repMap[repId].total++;
    if (lead.stage === 'Confirmed Sales') repMap[repId].won++;
    else if (lead.stage === 'Lost/Canceled') repMap[repId].lost++;
    else repMap[repId].active++;
  });

  const data = Object.entries(repMap).map(([repId, stats]) => {
    const user = users.find(u => u.id === repId || u.email === repId);
    const name = user?.full_name || (repId === 'Unassigned' ? 'Unassigned' : repId.split('@')[0]);
    return {
      name: name.length > 12 ? name.substring(0, 12) + '…' : name,
      Won: stats.won,
      Active: stats.active,
      Lost: stats.lost,
    };
  }).sort((a, b) => b.Won - a.Won).slice(0, 8);

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-orange-100 shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-bold text-gray-900">Team Performance</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data}>
              <XAxis dataKey="name" fontSize={10} angle={-20} textAnchor="end" height={50} />
              <YAxis fontSize={11} allowDecimals={false} />
              <Tooltip />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Won" fill="#059669" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Active" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Lost" fill="#EF4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-gray-500 text-center py-8 text-sm">No team data available</p>
        )}
      </CardContent>
    </Card>
  );
}