import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

export default function PipelineVelocityChart({ leads }) {
  // Show last 6 months of lead creation and conversions
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const monthDate = subMonths(now, i);
    const start = startOfMonth(monthDate);
    const end = endOfMonth(monthDate);
    const label = format(monthDate, 'MMM yy');

    const created = leads.filter(l => {
      const d = new Date(l.created_date);
      return isWithinInterval(d, { start, end });
    }).length;

    const won = leads.filter(l => {
      if (l.stage !== 'Confirmed Sales') return false;
      const d = new Date(l.updated_date);
      return isWithinInterval(d, { start, end });
    }).length;

    const lost = leads.filter(l => {
      if (l.stage !== 'Lost/Canceled') return false;
      const d = new Date(l.updated_date);
      return isWithinInterval(d, { start, end });
    }).length;

    months.push({ name: label, 'New Leads': created, 'Won': won, 'Lost': lost });
  }

  const hasData = months.some(m => m['New Leads'] > 0 || m['Won'] > 0 || m['Lost'] > 0);

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-orange-100 shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-bold text-gray-900">Pipeline Velocity (6 Months)</CardTitle>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={months}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3e8dd" />
              <XAxis dataKey="name" fontSize={11} />
              <YAxis fontSize={11} allowDecimals={false} />
              <Tooltip />
              <Area type="monotone" dataKey="New Leads" stroke="#3B82F6" fill="#DBEAFE" strokeWidth={2} />
              <Area type="monotone" dataKey="Won" stroke="#059669" fill="#D1FAE5" strokeWidth={2} />
              <Area type="monotone" dataKey="Lost" stroke="#EF4444" fill="#FEE2E2" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-gray-500 text-center py-8 text-sm">No pipeline data available yet</p>
        )}
      </CardContent>
    </Card>
  );
}