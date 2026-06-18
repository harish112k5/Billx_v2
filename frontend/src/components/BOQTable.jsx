import { useState } from 'react';
import { ChevronDown, ChevronUp, Activity } from 'lucide-react';
import { fmtFull, fmtNum } from './KPICard';

const STATUS_CLASS = {
  'Completed':    'badge-green',
  'In Progress':  'badge-amber',
  'Not Started':  'badge-muted',
  'Exceeded BOQ': 'badge-red',
};

export default function BOQTable({ items = [], onRowClick, showMeasurements = false }) {
  const [sortCol, setSortCol] = useState('planned_amount');
  const [sortDir, setSortDir] = useState('desc');

  const sort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  };

  const sorted = [...items].sort((a, b) => {
    const va = parseFloat(a[sortCol]) || a[sortCol] || 0;
    const vb = parseFloat(b[sortCol]) || b[sortCol] || 0;
    return sortDir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
  });

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return null;
    return sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  };

  const th = (label, col) => (
    <th onClick={() => sort(col)} style={{ cursor: 'pointer', userSelect: 'none' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        {label} <SortIcon col={col} />
      </span>
    </th>
  );

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data-table">
        <thead>
          <tr>
            {th('Item Code', 'item_code')}
            <th>Description</th>
            {th('Unit', 'unit')}
            {th('BOQ Qty', 'planned_quantity')}
            {th('Exec Qty', 'executed_quantity')}
            {th('Completion', 'completion_percent')}
            {th('BOQ Amount', 'planned_amount')}
            {th('Exec Amount', 'executed_amount')}
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(item => {
            const pct = parseFloat(item.completion_percent) || 0;
            const barColor = pct >= 100 ? 'green' : pct >= 50 ? 'amber' : pct > 0 ? 'blue' : 'muted';
            return (
              <tr
                key={item.boq_id}
                onClick={() => onRowClick && onRowClick(item)}
                style={onRowClick ? { cursor: 'pointer' } : {}}
              >
                <td>
                  <span className="mono" style={{ color: 'var(--amber)', fontSize: 12 }}>
                    {item.item_code}
                  </span>
                </td>
                <td style={{ maxWidth: 280, overflow: 'hidden' }}>
                  <div style={{
                    overflow: 'hidden', textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap', maxWidth: 260,
                    color: 'var(--text-primary)'
                  }} title={item.description}>
                    {item.description}
                  </div>
                  {item.category && (
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                      {item.category}
                    </div>
                  )}
                </td>
                <td style={{ color: 'var(--text-muted)' }}>{item.unit}</td>
                <td className="mono">{fmtNum(item.planned_quantity, 3)}</td>
                <td className="mono">{fmtNum(item.executed_quantity, 3)}</td>
                <td style={{ minWidth: 100 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div className="progress-bar-wrap" style={{ flex: 1 }}>
                      <div
                        className={`progress-bar-fill ${barColor}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 700, minWidth: 36,
                      color: pct >= 100 ? 'var(--green)' : pct >= 50 ? 'var(--amber)' : 'var(--text-muted)'
                    }}>
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                </td>
                <td className="mono" style={{ color: 'var(--text-secondary)' }}>
                  {fmtFull(item.planned_amount)}
                </td>
                <td className="mono" style={{ color: 'var(--green)' }}>
                  {fmtFull(item.executed_amount)}
                </td>
                <td>
                  <span className={`badge ${STATUS_CLASS[item.status] || 'badge-muted'}`}>
                    {item.status}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {items.length === 0 && (
        <div className="empty-state">
          <Activity />
          <h3>No BOQ Items</h3>
          <p>Import an Excel file to load BOQ items</p>
        </div>
      )}
    </div>
  );
}
