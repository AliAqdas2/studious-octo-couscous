import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';

export default function ConversionRateChart({ leads }) {
  const b2bLeads = leads.filter(l => l.channel === 'B2B');
  const b2cLeads = leads.filter(l => l.channel === 'B2C');

  const calcRate = (arr, stage) => {
    if (arr.length === 0) return 0;
    return Math.round((arr.filter(l => l.stage === stage).length / arr.length) * 100);
  };

  const wonB2B = calcRate(b2bLeads, 'Confirmed Sales');
  const lostB2B = calcRate(b2bLeads, 'Lost/Canceled');
  const wonB2C = calcRate(b2cLeads, 'Confirmed Sales');
  const lostB2C = calcRate(b2cLeads, 'Lost/Canceled');

  const totalWon = leads.length > 0 ? Math.round((leads.filter(l => l.stage === 'Confirmed Sales').length / leads.length) * 100) : 0;
  const totalLost = leads.length > 0 ? Math.round((leads.filter(l => l.stage === 'Lost/Canceled').length / leads.length) * 100) : 0;
  const totalActive = 100 - totalWon - totalLost;

  const data = [
    { name: 'B2B', Won: wonB2B, Lost: lostB2B, Active: 100 - wonB2B - lostB2B },
    { name: 'B2C', Won: wonB2C, Lost: lostB2C, Active: 100 - wonB2C - lostB2C },
    { name: 'Overall', Won: totalWon, Lost: totalLost, Active: totalActive },
  ];

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-orange-100 shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-bold text-gray-900">Lead Conversion Rates</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center p-3 bg-emerald-50 rounded-lg">
            <p className="text-2xl font-bold text-emerald-700">{totalWon}%</p>
            <p className="text-xs text-gray-600">Win Rate</p>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <p className="text-2xl font-bold text-red-600">{totalLost}%</p>
            <p className="text-xs text-gray-600">Loss Rate</p>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <p className="text-2xl font-bold text-blue-600">{totalActive}%</p>
            <p className="text-xs text-gray-600">Active</p>
          </div>
        </div>
        {leads.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data} layout="vertical">
              <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} fontSize={11} />
              <YAxis type="category" dataKey="name" width={60} fontSize={12} />
              <Tooltip formatter={(v) => `${v}%`} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Won" stackId="a" fill="#059669" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Active" stackId="a" fill="#3B82F6" />
              <Bar dataKey="Lost" stackId="a" fill="#EF4444" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-gray-500 text-center py-8 text-sm">No lead data available</p>
        )}
      </CardContent>
    </Card>
  );
}