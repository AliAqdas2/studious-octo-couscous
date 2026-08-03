import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

function getDaysBetween(d1, d2) {
  return Math.max(0, Math.round((new Date(d2) - new Date(d1)) / (1000 * 60 * 60 * 24)));
}

export default function SalesCycleChart({ leads }) {
  // Only consider leads that reached Confirmed Sales or Lost/Canceled
  const closedLeads = leads.filter(l => ['Confirmed Sales', 'Lost/Canceled'].includes(l.stage));

  const wonLeads = closedLeads.filter(l => l.stage === 'Confirmed Sales');
  const lostLeads = closedLeads.filter(l => l.stage === 'Lost/Canceled');

  const avgCycle = (arr) => {
    if (arr.length === 0) return 0;
    const days = arr.map(l => getDaysBetween(l.created_date, l.updated_date));
    return Math.round(days.reduce((a, b) => a + b, 0) / arr.length);
  };

  const b2bWon = wonLeads.filter(l => l.channel === 'B2B');
  const b2cWon = wonLeads.filter(l => l.channel === 'B2C');
  const b2bLost = lostLeads.filter(l => l.channel === 'B2B');
  const b2cLost = lostLeads.filter(l => l.channel === 'B2C');

  const data = [
    { name: 'B2B Won', days: avgCycle(b2bWon), fill: '#059669' },
    { name: 'B2B Lost', days: avgCycle(b2bLost), fill: '#EF4444' },
    { name: 'B2C Won', days: avgCycle(b2cWon), fill: '#10B981' },
    { name: 'B2C Lost', days: avgCycle(b2cLost), fill: '#F87171' },
  ].filter(d => d.days > 0);

  const overallAvg = avgCycle(wonLeads);

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-orange-100 shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-bold text-gray-900">Sales Cycle Length</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center mb-4 p-3 bg-amber-50 rounded-lg">
          <p className="text-3xl font-bold text-amber-700">{overallAvg}</p>
          <p className="text-xs text-gray-600">Avg Days to Close (Won)</p>
        </div>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data}>
              <XAxis dataKey="name" fontSize={10} angle={-15} textAnchor="end" height={50} />
              <YAxis fontSize={11} label={{ value: 'Days', angle: -90, position: 'insideLeft', fontSize: 11 }} />
              <Tooltip formatter={(v) => `${v} days`} />
              <Bar dataKey="days" radius={[4, 4, 0, 0]}>
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-gray-500 text-center py-8 text-sm">No closed leads yet</p>
        )}
      </CardContent>
    </Card>
  );
}