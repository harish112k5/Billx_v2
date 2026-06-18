import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import RABillSummary from '../components/RABillSummary';
import BOQTable from '../components/BOQTable';
import { fmtFull } from '../components/KPICard';
import { FileText, ListChecks, ArrowLeft, CheckCircle, DollarSign } from 'lucide-react';

export default function RABillDetail() {
  const { id, raId } = useParams();
  const navigate = useNavigate();
  const [bill, setBill]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('abstract');
  const [showCertify, setShowCertify] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [certForm, setCertForm] = useState({ certified_amount: '', certified_date: '' });
  const [payForm, setPayForm]   = useState({ payment_received: '', payment_date: '' });
  const [saving, setSaving] = useState(false);
  const [measurements, setMeasurements] = useState([]);
  const [measLoading, setMeasLoading]   = useState(false);

  useEffect(() => {
    api.get(`/ra-bills/${raId}`).then(r => setBill(r.data.data)).finally(() => setLoading(false));
  }, [raId]);

  const loadMeasurements = async () => {
    if (measurements.length > 0) return; // cached
    setMeasLoading(true);
    try {
      const res = await api.get(`/ra-bills/${raId}/measurements`);
      setMeasurements(res.data.data || []);
    } finally { setMeasLoading(false); }
  };

  const handleCertify = async () => {
    setSaving(true);
    try {
      await api.put(`/ra-bills/${raId}/certify`, certForm);
      const res = await api.get(`/ra-bills/${raId}`);
      setBill(res.data.data);
      setShowCertify(false);
    } finally { setSaving(false); }
  };

  const handlePayment = async () => {
    setSaving(true);
    try {
      await api.put(`/ra-bills/${raId}/payment`, payForm);
      const res = await api.get(`/ra-bills/${raId}`);
      setBill(res.data.data);
      setShowPayment(false);
    } finally { setSaving(false); }
  };

  if (loading) return <div style={{ padding: 32, textAlign: 'center' }}><div className="loader" /></div>;
  if (!bill)   return <div className="empty-state"><h3>RA Bill not found</h3></div>;

  return (
    <div className="fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/projects/${id}/ra-bills`)}>
            <ArrowLeft size={14} /> Back
          </button>
          <div>
            <div className="page-title">
              {bill.ra_code || `RA-${bill.ra_number}`} — {bill.project_name}
            </div>
            <div className="page-subtitle">
              {bill.contractor_name} · {bill.bill_period_from} to {bill.bill_period_to}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {bill.stage !== 'certified' && bill.stage !== 'paid' && (
            <button className="btn btn-ghost" onClick={() => { setCertForm({ certified_amount: bill.net_payable, certified_date: new Date().toISOString().split('T')[0] }); setShowCertify(true); }}>
              <CheckCircle size={14} /> Certify
            </button>
          )}
          {(bill.stage === 'certified' || bill.stage === 'partially_paid') && (
            <button className="btn btn-primary" onClick={() => { setPayForm({ payment_received: bill.certified_amount - bill.payment_received, payment_date: new Date().toISOString().split('T')[0] }); setShowPayment(true); }}>
              <DollarSign size={14} /> Record Payment
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-list">
        <button className={`tab-btn ${tab === 'abstract' ? 'active' : ''}`} onClick={() => setTab('abstract')}>
          Abstract / Financial
        </button>
        <button className={`tab-btn ${tab === 'items' ? 'active' : ''}`} onClick={() => setTab('items')}>
          BOQ Items ({bill.items?.length || 0})
        </button>
        <button className={`tab-btn ${tab === 'measurements' ? 'active' : ''}`} onClick={() => { setTab('measurements'); loadMeasurements(); }}>
          Measurements
        </button>
      </div>

      {/* Abstract */}
      {tab === 'abstract' && (
        <div className="section-card">
          <div className="section-header">
            <div className="section-title"><FileText /> Abstract Sheet — Financial Breakdown</div>
          </div>
          <RABillSummary bill={bill} />
        </div>
      )}

      {/* Items */}
      {tab === 'items' && (
        <div className="section-card">
          <div className="section-header">
            <div className="section-title"><ListChecks /> BOQ Line Items</div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Item Code</th><th>Description</th><th>Unit</th>
                  <th>BOQ Qty</th><th>Exec Upto Prev</th><th>Exec This Bill</th><th>Exec Upto Date</th>
                  <th>Amt This Bill</th><th>Amt Upto Date</th>
                </tr>
              </thead>
              <tbody>
                {(bill.items || []).map(item => (
                  <tr key={item.ra_item_id}>
                    <td><span className="mono" style={{ color: 'var(--amber)', fontSize: 11 }}>{item.item_code}</span></td>
                    <td style={{ maxWidth: 240, overflow: 'hidden' }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}
                           title={item.description}>{item.description}</div>
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{item.unit}</td>
                    <td className="mono">{item.planned_quantity}</td>
                    <td className="mono" style={{ color: 'var(--text-muted)' }}>{item.qty_upto_previous}</td>
                    <td className="mono" style={{ color: 'var(--amber)', fontWeight: 600 }}>{item.qty_this_bill}</td>
                    <td className="mono" style={{ color: 'var(--text-primary)' }}>{item.qty_upto_date}</td>
                    <td className="mono" style={{ color: 'var(--amber)' }}>{fmtFull(item.amount_this_bill)}</td>
                    <td className="mono" style={{ color: 'var(--green)' }}>{fmtFull(item.amount_upto_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Measurements */}
      {tab === 'measurements' && (
        <div className="section-card">
          <div className="section-header">
            <div className="section-title"><ListChecks /> Measurement Book</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{measurements.length} records</div>
          </div>
          {measLoading ? (
            <div style={{ padding: 32, textAlign: 'center' }}><div className="loader" /></div>
          ) : measurements.length === 0 ? (
            <div className="empty-state"><ListChecks /><h3>No measurement records</h3><p>Import an RA Bill Excel to load measurement data</p></div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>S.No</th><th>Item Code</th><th>Date</th><th>RFI No</th><th>Description</th>
                    <th>From</th><th>To</th><th>Side</th><th>Nos</th>
                    <th>L</th><th>B</th><th>D</th><th>Qty</th><th>IPC</th>
                  </tr>
                </thead>
                <tbody>
                  {measurements.map((m, i) => (
                    <tr key={m.measurement_id || i}>
                      <td className="mono">{m.serial_no}</td>
                      <td><span className="mono" style={{ color: 'var(--amber)', fontSize: 11 }}>{m.item_code}</span></td>
                      <td style={{ fontSize: 11 }}>{m.measurement_date || '—'}</td>
                      <td className="mono" style={{ fontSize: 11 }}>{m.rfi_number || '—'}</td>
                      <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.description || '—'}</td>
                      <td className="mono">{m.location_from || '—'}</td>
                      <td className="mono">{m.location_to || '—'}</td>
                      <td>{m.side || '—'}</td>
                      <td className="mono">{m.nos || '—'}</td>
                      <td className="mono">{m.length || '—'}</td>
                      <td className="mono">{m.breadth || '—'}</td>
                      <td className="mono">{m.depth || '—'}</td>
                      <td className="mono" style={{ color: 'var(--green)', fontWeight: 600 }}>{parseFloat(m.quantity || 0).toFixed(4)}</td>
                      <td><span className="badge badge-blue">IPC-{m.ipc_number}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Certify Modal */}
      {showCertify && (
        <div className="modal-overlay" onClick={() => setShowCertify(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <div className="modal-title">Certify RA Bill</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCertify(false)}>×</button>
            </div>
            <div className="form-group">
              <label className="form-label">Certified Amount (₹)</label>
              <input type="number" className="form-input" value={certForm.certified_amount}
                onChange={e => setCertForm(f => ({ ...f, certified_amount: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Certified Date</label>
              <input type="date" className="form-input" value={certForm.certified_date}
                onChange={e => setCertForm(f => ({ ...f, certified_date: e.target.value }))} />
            </div>
            <button className="btn btn-primary" onClick={handleCertify} disabled={saving} style={{ width: '100%', justifyContent: 'center' }}>
              {saving ? 'Saving...' : 'Certify Bill'}
            </button>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPayment && (
        <div className="modal-overlay" onClick={() => setShowPayment(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <div className="modal-title">Record Payment Received</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowPayment(false)}>×</button>
            </div>
            <div className="form-group">
              <label className="form-label">Payment Amount (₹)</label>
              <input type="number" className="form-input" value={payForm.payment_received}
                onChange={e => setPayForm(f => ({ ...f, payment_received: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Payment Date</label>
              <input type="date" className="form-input" value={payForm.payment_date}
                onChange={e => setPayForm(f => ({ ...f, payment_date: e.target.value }))} />
            </div>
            <button className="btn btn-primary" onClick={handlePayment} disabled={saving} style={{ width: '100%', justifyContent: 'center' }}>
              {saving ? 'Saving...' : 'Record Payment'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
