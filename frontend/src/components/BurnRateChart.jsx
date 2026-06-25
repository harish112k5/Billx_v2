import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Line, ReferenceLine } from 'recharts';

export default function BurnRateChart({ data }) {
  const [hoveredActual, setHoveredActual] = useState(null);

  if (!data || data.length === 0) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
        No burn rate data available.
      </div>
    );
  }

  const chartData = data.map(d => ({
    date: new Date(d.period_start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }),
    'Planned Spend': d.planned_value || 0,
    'Actual Cost': d.actual_cost || 0,
    'Earned Value': d.earned_value || 0
  }));

  const formatCurrency = (value) => {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
    if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
    return `₹${value}`;
  };

  const CustomCursor = (props) => {
    const { x, y, width, height } = props;
    return (
      <line 
        x1={x + width / 2} 
        y1={y} 
        x2={x + width / 2} 
        y2={y + height} 
        stroke="var(--text-muted)" 
        strokeDasharray="5 5" 
        strokeWidth={1} 
      />
    );
  };

  return (
    <ResponsiveContainer width="100%" height={350}>
      <ComposedChart 
        data={chartData} 
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        onMouseMove={(state) => {
          if (state && state.activePayload && state.activePayload.length > 0) {
            const actualPayload = state.activePayload.find(p => p.dataKey === 'Actual Cost');
            if (actualPayload && actualPayload.value > 0) {
              setHoveredActual(actualPayload.value);
            } else {
              setHoveredActual(null);
            }
          }
        }}
        onMouseLeave={() => setHoveredActual(null)}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-dark)" />
        <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={12} />
        <YAxis stroke="var(--text-muted)" fontSize={12} tickFormatter={formatCurrency} />
        <Tooltip
          contentStyle={{ background: 'var(--card-dark)', border: '1px solid var(--border-dark)', borderRadius: 8, color: 'var(--text-primary)' }}
          formatter={value => formatCurrency(value)}
          cursor={<CustomCursor />}
        />
        <Legend wrapperStyle={{ color: 'var(--text-primary)' }} />
        <Bar dataKey="Planned Spend" fill="var(--blue)" opacity={0.7} radius={[4, 4, 0, 0]} />
        <Bar dataKey="Actual Cost" fill="var(--orange)" opacity={0.7} radius={[4, 4, 0, 0]} />
        <Line type="monotone" dataKey="Earned Value" stroke="var(--green)" strokeWidth={2} dot={false} />
        {hoveredActual !== null && (
          <ReferenceLine y={hoveredActual} stroke="red" strokeWidth={1} strokeDasharray="4 4" />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
