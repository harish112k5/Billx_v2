import { fmtFull } from './KPICard';
import { CheckCircle, Clock, AlertCircle } from 'lucide-react';

/**
 * RABillSummary — Renders the Abstract sheet visual breakdown
 * Mirrors the real Excel Abstract layout exactly
 */
export default function RABillSummary({ bill }) {
  if (!bill) return null;

  const rows = [
    { label: 'Basic Amount (BOQ Work Done)', upto_prev: bill.basic_amount_upto_prev, this_bill: bill.basic_amount_this_bill, upto_date: bill.basic_amount_upto_date, bold: true },
    { label: `SGST @ ${bill.sgst_percent}%`,  upto_prev: null, this_bill: bill.sgst_amount, upto_date: null, color: 'var(--blue)', indent: true },
    { label: `CGST @ ${bill.cgst_percent}%`,  upto_prev: null, this_bill: bill.cgst_amount, upto_date: null, color: 'var(--blue)', indent: true },
    { label: 'Gross Amount (Basic + GST)',     upto_prev: null, this_bill: bill.gross_amount, upto_date: null, bold: true, color: 'var(--text-primary)' },
    { label: 'LESS: Deductions', isHeader: true },
    { label: `Retention Money @ ${bill.retention_percent}%`, upto_prev: null, this_bill: bill.retention_amount, upto_date: null, color: 'var(--red)', indent: true },
    { label: `TDS @ ${bill.tds_percent}%`,       upto_prev: null, this_bill: bill.tds_amount, upto_date: null, color: 'var(--red)', indent: true },
    { label: `Labour Cess @ ${bill.labour_cess_percent}%`, upto_prev: null, this_bill: bill.labour_cess_amount, upto_date: null, color: 'var(--red)', indent: true },
    { label: 'NET PAYABLE (This Bill)',          upto_prev: null, this_bill: bill.net_payable, upto_date: null, bold: true, total: true, color: 'var(--green)' },
  ];

  const stageMap = {
    draft:          { label: 'Draft',          cls: 'badge-muted' },
    submitted:      { label: 'Submitted',      cls: 'badge-blue' },
    under_review:   { label: 'Under Review',   cls: 'badge-amber' },
    certified:      { label: 'Certified',      cls: 'badge-purple' },
    paid:           { label: 'Paid',           cls: 'badge-green' },
    partially_paid: { label: 'Partially Paid', cls: 'badge-orange' },
  };

  const stage = stageMap[bill.stage] || { label: bill.stage, cls: 'badge-muted' };

  return (
    <div>
      {/* Stage Pipeline */}
      <div className="pipeline" style={{ marginBottom: 20 }}>
        {['draft','submitted','under_review','certified','paid'].map((s, i) => {
          const stages  = ['draft','submitted','under_review','certified','paid'];
          const current = stages.indexOf(bill.stage);
          const idx     = stages.indexOf(s);
          const cls = idx < current ? 'done' : idx === current ? 'current' : 'pending';
          return (
            <div key={s} style={{ display: 'flex', alignItems: 'center' }}>
              <div className={`pipeline-step ${cls}`}>
                {cls === 'done' && <CheckCircle size={13} />}
                {cls === 'current' && <Clock size={13} />}
                {cls === 'pending' && <AlertCircle size={13} />}
                {stageMap[s]?.label || s}
              </div>
              {i < 4 && <span className="pipeline-arrow">›</span>}
            </div>
          );
        })}
      </div>

      {/* Abstract Table */}
      <div className="abstract-grid">
        {/* Header */}
        <div className="abstract-row header">
          <div className="abstract-cell label">Particulars</div>
          <div className="abstract-cell label" style={{ textAlign: 'right' }}>Upto Previous</div>
          <div className="abstract-cell label" style={{ textAlign: 'right' }}>This Bill</div>
          <div className="abstract-cell label" style={{ textAlign: 'right' }}>Upto Date</div>
        </div>

        {rows.map((row, i) => {
          if (row.isHeader) {
            return (
              <div key={i} className="abstract-row">
                <div className="abstract-cell" style={{
                  gridColumn: '1 / -1',
                  fontWeight: 600,
                  fontSize: 11,
                  color: 'var(--red)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  background: 'rgba(239,68,68,0.05)'
                }}>
                  {row.label}
                </div>
              </div>
            );
          }
          return (
            <div key={i} className="abstract-row" style={row.total ? { background: 'rgba(16,185,129,0.05)' } : {}}>
              <div className="abstract-cell" style={{
                fontWeight: row.bold ? 600 : 400,
                paddingLeft: row.indent ? 28 : 16,
                color: row.color || 'var(--text-secondary)',
                fontSize: row.total ? 14 : 13
              }}>
                {row.label}
              </div>
              <div className="abstract-cell value" style={{ color: 'var(--text-muted)' }}>
                {row.upto_prev ? fmtFull(row.upto_prev) : '—'}
              </div>
              <div className="abstract-cell value" style={{
                color: row.color || 'var(--text-primary)',
                fontWeight: row.bold ? 700 : 500,
                fontSize: row.total ? 15 : 13
              }}>
                {row.this_bill !== null && row.this_bill !== undefined ? fmtFull(row.this_bill) : '—'}
              </div>
              <div className="abstract-cell value" style={{ color: 'var(--text-muted)' }}>
                {row.upto_date ? fmtFull(row.upto_date) : '—'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Payment Info */}
      {(bill.certified_amount > 0 || bill.payment_received > 0) && (
        <div style={{
          marginTop: 16,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12
        }}>
          <div className="kpi-card purple">
            <div className="kpi-label">Certified Amount</div>
            <div className="kpi-value purple">{fmtFull(bill.certified_amount)}</div>
            {bill.certified_date && <div className="kpi-sub">On {bill.certified_date}</div>}
          </div>
          <div className="kpi-card green">
            <div className="kpi-label">Payment Received</div>
            <div className="kpi-value green">{fmtFull(bill.payment_received)}</div>
            {bill.payment_date && <div className="kpi-sub">On {bill.payment_date}</div>}
          </div>
          <div className="kpi-card red">
            <div className="kpi-label">Pending</div>
            <div className="kpi-value red">
              {fmtFull(Math.max(0, bill.certified_amount - bill.payment_received))}
            </div>
            <div className="kpi-sub">Outstanding</div>
          </div>
        </div>
      )}
    </div>
  );
}
