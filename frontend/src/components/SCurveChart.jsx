import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function SCurveChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
        No timeline data available. Import an RA Bill to generate schedule data.
      </div>
    );
  }

  const chartData = data.map(d => ({
    month: new Date(d.period_start).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
    'Planned Value': d.cumulative_pv || 0,
    'Earned Value': d.cumulative_ev || 0,
    'Actual Cost': d.cumulative_ac || 0,
    'Completion %': parseFloat(d.completion_pct) || 0
  }));

  const formatCurrency = (value) => {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
    if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
    return `₹${value}`;
  };

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-dark)" />
        <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={12} />
        <YAxis yAxisId="left" stroke="var(--text-muted)" fontSize={12} tickFormatter={formatCurrency} />
        <YAxis yAxisId="right" orientation="right" stroke="var(--text-muted)" fontSize={12} tickFormatter={v => `${v}%`} />
        <Tooltip
          contentStyle={{ background: 'var(--card-dark)', border: '1px solid var(--border-dark)', borderRadius: 8, color: 'var(--text-primary)' }}
          formatter={(value, name) => {
            if (name === 'Completion %') return [`${value}%`, name];
            return [formatCurrency(value), name];
          }}
        />
        <Legend wrapperStyle={{ color: 'var(--text-primary)' }} />
        <Line yAxisId="left" type="monotone" dataKey="Planned Value" stroke="var(--blue)" strokeWidth={2} dot={false} />
        <Line yAxisId="left" type="monotone" dataKey="Earned Value" stroke="var(--green)" strokeWidth={2} dot={false} />
        <Line yAxisId="left" type="monotone" dataKey="Actual Cost" stroke="var(--orange)" strokeWidth={2} dot={false} />
        <Line yAxisId="right" type="monotone" dataKey="Completion %" stroke="var(--red)" strokeDasharray="5 5" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
