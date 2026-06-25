import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

export default function WorkCompletionChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
        No work completion data available. Import an RA Bill to generate schedule data.
      </div>
    );
  }

  // Build cumulative completion data from timeline
  let cumulativePlannedQty = 0;
  let cumulativeActualQty = 0;
  const totalPlannedQty = data.reduce((sum, d) => sum + (parseFloat(d.planned_qty) || 0), 0);

  const chartData = data.map(d => {
    const plannedQty = parseFloat(d.planned_qty) || 0;
    const actualQty = parseFloat(d.actual_qty) || 0;
    cumulativePlannedQty += plannedQty;
    cumulativeActualQty += actualQty;

    const plannedPct = totalPlannedQty > 0 ? (cumulativePlannedQty / totalPlannedQty) * 100 : 0;
    const actualPct = totalPlannedQty > 0 ? (cumulativeActualQty / totalPlannedQty) * 100 : 0;

    return {
      month: new Date(d.period_start).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
      'Planned %': parseFloat(plannedPct.toFixed(1)),
      'Actual %': parseFloat(actualPct.toFixed(1)),
    };
  });

  return (
    <ResponsiveContainer width="100%" height={400}>
      <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gradPlanned" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--blue)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--blue)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradActual" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--green)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--green)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-dark)" />
        <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={12} />
        <YAxis
          stroke="var(--text-muted)"
          fontSize={12}
          tickFormatter={v => `${v}%`}
          domain={[0, 100]}
        />
        <Tooltip
          contentStyle={{
            background: 'var(--card-dark)',
            border: '1px solid var(--border-dark)',
            borderRadius: 8,
            color: 'var(--text-primary)'
          }}
          formatter={(value) => [`${value}%`, undefined]}
        />
        <Legend wrapperStyle={{ color: 'var(--text-primary)' }} />
        <ReferenceLine y={100} stroke="var(--text-muted)" strokeDasharray="3 3" label="" />
        <Area
          type="monotone"
          dataKey="Planned %"
          stroke="var(--blue)"
          fill="url(#gradPlanned)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Area
          type="monotone"
          dataKey="Actual %"
          stroke="var(--green)"
          fill="url(#gradActual)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
