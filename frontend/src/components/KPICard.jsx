/**
 * KPICard — Reusable KPI metric card
 * Props: label, value, sub, color (amber|green|blue|red|purple|teal), icon, trend
 */
export default function KPICard({ label, value, sub, color = 'amber', icon: Icon, trend, onClick }) {
  return (
    <div className={`kpi-card ${color}`} onClick={onClick} style={onClick ? { cursor: 'pointer' } : {}}>
      {Icon && (
        <div className={`kpi-icon ${color}`}>
          <Icon />
        </div>
      )}
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${color}`}>{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
      {trend !== undefined && (
        <div style={{
          marginTop: 8,
          fontSize: 11,
          color: trend >= 0 ? 'var(--green)' : 'var(--red)',
          display: 'flex',
          alignItems: 'center',
          gap: 3
        }}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
        </div>
      )}
    </div>
  );
}

/**
 * fmt — format Indian currency
 */
export function fmt(amount) {
  if (amount === null || amount === undefined) return '—';
  const n = parseFloat(amount);
  if (isNaN(n)) return '—';
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(2)} L`;
  if (n >= 1000)     return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toFixed(0)}`;
}

export function fmtFull(amount) {
  if (amount === null || amount === undefined) return '—';
  const n = parseFloat(amount);
  if (isNaN(n)) return '—';
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtNum(n, decimals = 2) {
  if (n === null || n === undefined) return '—';
  return parseFloat(n).toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
