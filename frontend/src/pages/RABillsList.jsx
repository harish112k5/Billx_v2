import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import { fmt, fmtFull } from '../components/KPICard';
import { FileText, ChevronRight, Plus, Trash2 } from 'lucide-react';

export default function RABillsList() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/projects/${id}/ra-bills`).then(r => setBills(r.data.data || [])).finally(() => setLoading(false));
  }, [id]);

  const stageBadge = {
    draft: 'badge-muted', submitted: 'badge-blue', under_review: 'badge-amber',
    certified: 'badge-purple', paid: 'badge-green', partially_paid: 'badge-orange'
  };

  const handleDelete = async (e, bill) => {
    e.stopPropagation();
    if (!window.confirm(`WARNING: Are you sure you want to permanently delete ${bill.ra_code || 'RA-'+bill.ra_number}?`)) return;
    try {
      await api.delete(`/ra-bills/${bill.ra_bill_id}`);
      setBills(bills.filter(b => b.ra_bill_id !== bill.ra_bill_id));
    } catch (err) {
      alert('Failed to delete: ' + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">RA Bills</div>
          <div className="page-subtitle">{bills.length} bills for this project</div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-secondary" onClick={() => navigate(`/projects/${id}/ra-bills/new`)} style={{ background: 'var(--surface-dark)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
            <Plus size={14} /> Manual Entry
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/import')}>
            <Plus size={14} /> Import Excel
          </button>
        </div>
      </div>

      <div className="section-card">
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center' }}><div className="loader" /></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>RA Bill</th><th>Period</th>
                <th>Basic (This Bill)</th><th>Basic (Upto Date)</th>
                <th>Gross Amount</th><th>Net Payable</th>
                <th>Received</th><th>Pending</th><th>Stage</th><th></th>
              </tr>
            </thead>
            <tbody>
              {bills.map(b => (
                <tr key={b.ra_bill_id} onClick={() => navigate(`/projects/${id}/ra-bills/${b.ra_bill_id}`)} style={{ cursor: 'pointer' }}>
                  <td><span className="mono" style={{ color: 'var(--amber)', fontWeight: 700 }}>{b.ra_code || `RA-${b.ra_number}`}</span></td>
                  <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{b.bill_period_from} → {b.bill_period_to}</td>
                  <td className="mono">{fmtFull(b.basic_amount_this_bill)}</td>
                  <td className="mono">{fmtFull(b.basic_amount_upto_date)}</td>
                  <td className="mono" style={{ color: 'var(--blue)' }}>{fmtFull(b.gross_amount)}</td>
                  <td className="mono" style={{ color: 'var(--purple)' }}>{fmtFull(b.net_payable)}</td>
                  <td className="mono" style={{ color: 'var(--green)' }}>{fmtFull(b.payment_received)}</td>
                  <td className="mono" style={{ color: (b.certified_amount - b.payment_received) > 0 ? 'var(--red)' : 'var(--text-muted)' }}>
                    {fmtFull(Math.max(0, b.certified_amount - b.payment_received))}
                  </td>
                  <td><span className={`badge ${stageBadge[b.stage] || 'badge-muted'}`}>{b.stage?.replace('_', ' ')}</span></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Trash2 size={14} style={{ color: 'var(--red)', cursor: 'pointer' }} onClick={(e) => handleDelete(e, b)} title="Delete Bill" />
                      <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                    </div>
                  </td>
                </tr>
              ))}
              {bills.length === 0 && (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                  No RA Bills. Import an Excel file to get started.
                </td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
