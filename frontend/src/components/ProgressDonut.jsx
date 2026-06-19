import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS = {
  completed:   '#10B981',
  in_progress: '#F59E0B',
  not_started: '#64748B',
  exceeded:    '#EF4444',
};

export default function ProgressDonut({ planning }) {
  if (!planning) return null;

  const data = [
    { name: 'Completed',    value: planning.completed_items    || 0, color: COLORS.completed },
    { name: 'In Progress',  value: planning.in_progress_items  || 0, color: COLORS.in_progress },
    { name: 'Not Started',  value: planning.not_started_items  || 0, color: COLORS.not_started },
    { name: 'Exceeded BOQ', value: planning.exceeded_boq_items || 0, color: COLORS.exceeded },
  ].filter(d => d.value > 0);

  const pct = planning.avg_completion || 0;
  const total = planning.total_boq_items || 0;

  return (
    <div className="donut-wrap">
      <div style={{ position: 'relative', width: 160, height: 160, flexShrink: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%" cy="50%"
              innerRadius={48}
              outerRadius={72}
              paddingAngle={2}
              dataKey="value"
              startAngle={90}
              endAngle={-270}
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} stroke="none" />
              ))}
            </Pie>
            <Tooltip
              formatter={(v, n) => [v + ' items', n]}
              contentStyle={{ background: '#12121A', border: '1px solid #1E1E2E', borderRadius: 8 }}
              labelStyle={{ color: '#94A3B8' }}
              itemStyle={{ color: '#F1F5F9' }}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Center Label */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center', pointerEvents: 'none'
        }}>
          <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: 22, fontWeight: 700, color: '#F59E0B' }}>
            {pct.toFixed(0)}%
          </div>
          <div style={{ fontSize: 10, color: '#64748B' }}>done</div>
        </div>
      </div>

      <div className="donut-legend">
        {data.map((d, i) => (
          <div className="legend-item" key={i}>
            <div className="legend-dot" style={{ background: d.color }} />
            <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{d.name}</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{d.value}</span>
          </div>
        ))}
        <div className="legend-item" style={{ marginTop: 4, borderTop: '1px solid var(--border-dark)', paddingTop: 6 }}>
          <div className="legend-dot" style={{ background: 'var(--amber)' }} />
          <span style={{ color: 'var(--text-muted)' }}>Total BOQ</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{total}</span>
        </div>
      </div>
    </div>
  );
}
