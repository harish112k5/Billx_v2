import React, { useState, useEffect } from 'react';
import api from '../api/axios';

export default function TimePhaseTable({ projectId }) {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    api.get(`/projects/${projectId}/boq-schedules`)
      .then(r => setSchedules(r.data.data || []))
      .catch(err => console.error('Failed to fetch schedules:', err))
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) return <div style={{ padding: 32, textAlign: 'center' }}><div className="loader" /></div>;

  if (!schedules.length) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
        No schedule data available.
      </div>
    );
  }

  // Group by period
  const grouped = schedules.reduce((acc, s) => {
    const key = s.period_start;
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  const fmt = (v) => {
    const n = Number(v) || 0;
    return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  };

  return (
    <div className="time-phase-table">
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Period</th>
              <th>Item Code</th>
              <th>Description</th>
              <th style={{ textAlign: 'right' }}>Planned Qty</th>
              <th style={{ textAlign: 'right' }}>Actual Qty</th>
              <th style={{ textAlign: 'right' }}>Planned Amt</th>
              <th style={{ textAlign: 'right' }}>Actual Amt</th>
              <th style={{ textAlign: 'right' }}>Variance</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(grouped).map(([period, items]) => (
              <React.Fragment key={period}>
                <tr className="period-header">
                  <td colSpan="8">
                    {new Date(period).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                  </td>
                </tr>
                {items.map(item => {
                  const pQty = parseFloat(item.planned_quantity) || 0;
                  const aQty = parseFloat(item.actual_quantity) || 0;
                  const variancePct = pQty > 0 ? ((aQty / pQty) * 100).toFixed(1) : 'N/A';
                  const isBehind = pQty > 0 && aQty < pQty;

                  return (
                    <tr key={item.schedule_id}>
                      <td></td>
                      <td>
                        <span className="mono" style={{ fontSize: 12, color: 'var(--amber)', background: 'var(--amber-glow)', padding: '2px 6px', borderRadius: 4 }}>
                          {item.item_code}
                        </span>
                      </td>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.description}
                      </td>
                      <td style={{ textAlign: 'right' }}>{pQty.toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}>{aQty.toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}>{fmt(item.planned_amount)}</td>
                      <td style={{ textAlign: 'right' }}>{fmt(item.actual_amount || 0)}</td>
                      <td style={{ textAlign: 'right', color: isBehind ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>
                        {variancePct === 'N/A' ? variancePct : `${variancePct}%`}
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
