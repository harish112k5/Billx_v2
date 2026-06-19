import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import RABillSummary from '../components/RABillSummary';
import { fmtFull } from '../components/KPICard';
import { FileText, ListChecks, ArrowLeft, CheckCircle, DollarSign, Trash2, Plus, Edit3, ChevronDown, ChevronUp, X, Save } from 'lucide-react';

const emptyMeasurement = () => ({
  serial_no: '', measurement_date: '', rfi_number: '', description: '',
  location_from: '', location_to: '', side: '', nos: '',
  length: '', breadth: '', depth: '', quantity: '', remarks: ''
});

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

  // Add / Edit BOQ Item
  const [showAddItem, setShowAddItem] = useState(false);
  const [editItem, setEditItem] = useState(null); // ra_item_id being edited
  const [projectBoqs, setProjectBoqs] = useState([]);
  const [itemForm, setItemForm] = useState({
    boq_id: '', item_code: '', item_number: '', description: '', unit: '',
    planned_quantity: '', unit_rate: '',
    qty_upto_previous: 0, qty_upto_date: '', qty_this_bill: '',
    amount_upto_previous: 0, amount_upto_date: '', amount_this_bill: '',
    is_non_boq: false,
    measurements: [emptyMeasurement()]
  });
  const [showMeasurements, setShowMeasurements] = useState(false);
  const [itemSaving, setItemSaving] = useState(false);

  const loadBill = () => {
    api.get(`/ra-bills/${raId}`).then(r => setBill(r.data.data)).finally(() => setLoading(false));
  };

  useEffect(() => { loadBill(); }, [raId]);

  // Load project BOQ items for the dropdown
  useEffect(() => {
    if (showAddItem && !editItem) {
      api.get('/projects/' + id + '/boq').then(res => {
        setProjectBoqs((res.data.data || []).filter(b => !b.is_non_boq));
      });
    }
  }, [showAddItem, editItem, id]);

  const loadMeasurements = async () => {
    if (measurements.length > 0) return;
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
      loadBill();
      setShowCertify(false);
    } finally { setSaving(false); }
  };

  const handlePayment = async () => {
    setSaving(true);
    try {
      await api.put(`/ra-bills/${raId}/payment`, payForm);
      loadBill();
      setShowPayment(false);
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm('WARNING: Are you sure you want to permanently delete this RA Bill and all its measurements? This action cannot be undone.')) return;
    setSaving(true);
    try {
      await api.delete(`/ra-bills/${raId}`);
      navigate(`/projects/${id}/ra-bills`);
    } catch (err) {
      alert('Failed to delete: ' + (err.response?.data?.error || err.message));
      setSaving(false);
    }
  };

  // ── Item Form Helpers ──
  const resetItemForm = () => {
    setItemForm({
      boq_id: '', item_code: '', item_number: '', description: '', unit: '',
      planned_quantity: '', unit_rate: '',
      qty_upto_previous: 0, qty_upto_date: '', qty_this_bill: '',
      amount_upto_previous: 0, amount_upto_date: '', amount_this_bill: '',
      is_non_boq: false,
      measurements: [emptyMeasurement()]
    });
    setShowMeasurements(false);
  };

  const openAddItem = (isNonBoq = false) => {
    resetItemForm();
    setItemForm(f => ({ ...f, is_non_boq: isNonBoq }));
    setEditItem(null);
    setShowAddItem(true);
  };

  const openEditItem = (item) => {
    setItemForm({
      boq_id: item.boq_id || '',
      item_code: item.item_code || '',
      item_number: item.item_number || '',
      description: item.description || '',
      unit: item.unit || '',
      planned_quantity: item.planned_quantity || '',
      unit_rate: item.unit_rate || '',
      qty_upto_previous: item.qty_upto_previous || 0,
      qty_upto_date: item.qty_upto_date || '',
      qty_this_bill: item.qty_this_bill || '',
      amount_upto_previous: item.amount_upto_previous || 0,
      amount_upto_date: item.amount_upto_date || '',
      amount_this_bill: item.amount_this_bill || '',
      is_non_boq: !!item.is_non_boq,
      measurements: [emptyMeasurement()]
    });
    setEditItem(item.ra_item_id);
    setShowAddItem(true);
    // Load existing measurements for this item
    api.get(`/ra-bills/${raId}/measurements`).then(res => {
      const itemMeas = (res.data.data || []).filter(m => m.ra_item_id === item.ra_item_id || m.item_code === item.item_code);
      if (itemMeas.length > 0) {
        setItemForm(f => ({ ...f, measurements: itemMeas.map(m => ({
          serial_no: m.serial_no || '', measurement_date: m.measurement_date || '',
          rfi_number: m.rfi_number || '', description: m.description || '',
          location_from: m.location_from || '', location_to: m.location_to || '',
          side: m.side || '', nos: m.nos || '',
          length: m.length || '', breadth: m.breadth || '',
          depth: m.depth || '', quantity: m.quantity || '', remarks: m.remarks || ''
        })) }));
        setShowMeasurements(true);
      }
    });
  };

  const selectExistingBoq = (boq_id) => {
    const boq = projectBoqs.find(b => b.boq_id === boq_id);
    if (boq) {
      setItemForm(f => ({
        ...f,
        boq_id: boq.boq_id,
        item_code: boq.item_code,
        item_number: boq.item_number || '',
        description: boq.description,
        unit: boq.unit,
        planned_quantity: boq.planned_quantity,
        unit_rate: boq.unit_rate,
        qty_upto_previous: boq.executed_quantity || 0,
        amount_upto_previous: boq.executed_amount || 0,
      }));
    }
  };

  const updateItemField = (field, value) => {
    setItemForm(f => {
      const next = { ...f, [field]: value };
      if (field === 'qty_this_bill' || field === 'unit_rate') {
        const qty  = parseFloat(field === 'qty_this_bill' ? value : next.qty_this_bill) || 0;
        const rate = parseFloat(field === 'unit_rate' ? value : next.unit_rate) || 0;
        next.amount_this_bill = (qty * rate).toFixed(2);
        const prev = parseFloat(next.qty_upto_previous) || 0;
        next.qty_upto_date = (prev + qty).toFixed(4);
        next.amount_upto_date = ((prev + qty) * rate).toFixed(2);
      }
      return next;
    });
  };

  const updateMeasurement = (mIdx, field, value) => {
    setItemForm(f => {
      const meas = [...f.measurements];
      meas[mIdx] = { ...meas[mIdx], [field]: value };
      if (['nos', 'length', 'breadth', 'depth'].includes(field)) {
        const nos = parseFloat(field === 'nos' ? value : meas[mIdx].nos) || 1;
        const l   = parseFloat(field === 'length' ? value : meas[mIdx].length) || 1;
        const b   = parseFloat(field === 'breadth' ? value : meas[mIdx].breadth) || 1;
        const d   = parseFloat(field === 'depth' ? value : meas[mIdx].depth) || 1;
        meas[mIdx].quantity = (nos * l * b * d).toFixed(4);
      }
      return { ...f, measurements: meas };
    });
  };

  const handleSaveItem = async () => {
    setItemSaving(true);
    try {
      if (editItem) {
        await api.put(`/ra-bills/${raId}/items/${editItem}`, itemForm);
      } else {
        await api.post(`/ra-bills/${raId}/items`, itemForm);
      }
      setShowAddItem(false);
      resetItemForm();
      setMeasurements([]); // force reload
      loadBill();
    } catch (err) {
      alert('Failed: ' + (err.response?.data?.error || err.message));
    } finally { setItemSaving(false); }
  };

  const handleDeleteItem = async (ra_item_id) => {
    if (!window.confirm('Delete this BOQ item from this RA Bill?')) return;
    try {
      await api.delete(`/ra-bills/${raId}/items/${ra_item_id}`);
      setMeasurements([]);
      loadBill();
    } catch (err) {
      alert('Failed: ' + (err.response?.data?.error || err.message));
    }
  };

  const inputStyle = { padding: '6px 10px', fontSize: 12, background: 'var(--surface-dark)', border: '1px solid var(--border-dark)', borderRadius: 6, color: 'var(--text-primary)', width: '100%', boxSizing: 'border-box' };
  const smallInput = { ...inputStyle, padding: '4px 6px', fontSize: 11 };

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
          <button className="btn btn-ghost" style={{ color: 'var(--red)' }} onClick={handleDelete} disabled={saving}>
            <Trash2 size={14} /> Delete
          </button>
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

      {/* Items — with Add/Edit/Delete */}
      {tab === 'items' && (
        <div className="section-card">
          <div className="section-header">
            <div className="section-title"><ListChecks /> BOQ Line Items</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => openAddItem(true)}>
                <Plus size={13} /> Non-BOQ
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => openAddItem(false)}>
                <Plus size={13} /> Add BOQ Item
              </button>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Item Code</th><th>Description</th><th>Unit</th>
                  <th>BOQ Qty</th><th>Exec Upto Prev</th><th>Exec This Bill</th><th>Exec Upto Date</th>
                  <th>Amt This Bill</th><th>Amt Upto Date</th><th style={{ width: 80 }}>Actions</th>
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
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button style={{ padding: 4, background: 'none', border: '1px solid var(--border-dark)', borderRadius: 4, cursor: 'pointer', color: 'var(--blue)' }}
                          onClick={() => openEditItem(item)} title="Edit">
                          <Edit3 size={12} />
                        </button>
                        <button style={{ padding: 4, background: 'none', border: '1px solid var(--border-dark)', borderRadius: 4, cursor: 'pointer', color: 'var(--red)' }}
                          onClick={() => handleDeleteItem(item.ra_item_id)} title="Delete">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {(!bill.items || bill.items.length === 0) && (
                  <tr><td colSpan={10} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                    No BOQ items yet. Click "Add BOQ Item" to get started.
                  </td></tr>
                )}
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
            <div className="empty-state"><ListChecks /><h3>No measurement records</h3><p>Add BOQ items with measurements to populate this section</p></div>
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

      {/* ════ Add / Edit BOQ Item Modal ════ */}
      {showAddItem && (
        <div className="modal-overlay" onClick={() => { setShowAddItem(false); resetItemForm(); }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 900, maxHeight: '90vh', overflow: 'auto' }}>
            <div className="modal-header">
              <div className="modal-title">{editItem ? 'Edit BOQ Item' : (itemForm.is_non_boq ? 'Add Non-BOQ Item' : 'Add BOQ Item')}</div>
              <button className="btn btn-ghost btn-sm" onClick={() => { setShowAddItem(false); resetItemForm(); }}><X size={16} /></button>
            </div>

            {/* Select existing BOQ (only when adding, not editing) */}
            {!editItem && !itemForm.is_non_boq && projectBoqs.length > 0 && (
              <div className="form-group">
                <label className="form-label">Select Existing BOQ Item (or leave blank for new)</label>
                <select className="form-select" value={itemForm.boq_id} onChange={e => selectExistingBoq(e.target.value)}>
                  <option value="">— Enter new item manually —</option>
                  {projectBoqs.map(b => (
                    <option key={b.boq_id} value={b.boq_id}>
                      {b.item_code} — {b.description?.substring(0, 60)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Item Details */}
            <div style={{ display: 'grid', gridTemplateColumns: '100px 80px 1fr 80px', gap: 10, marginBottom: 16 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Item Code</label>
                <input style={inputStyle} value={itemForm.item_code} onChange={e => updateItemField('item_code', e.target.value)} readOnly={!!itemForm.boq_id} placeholder="e.g. 1010" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Unit</label>
                <input style={inputStyle} value={itemForm.unit} onChange={e => updateItemField('unit', e.target.value)} readOnly={!!itemForm.boq_id} placeholder="m³" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Description</label>
                <input style={inputStyle} value={itemForm.description} onChange={e => updateItemField('description', e.target.value)} readOnly={!!itemForm.boq_id} placeholder="Work description" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">BOQ Qty</label>
                <input style={inputStyle} type="number" value={itemForm.planned_quantity} onChange={e => updateItemField('planned_quantity', e.target.value)} readOnly={!!itemForm.boq_id} />
              </div>
            </div>

            {/* Quantity & Amount Fields */}
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--amber)', letterSpacing: 1.5, marginBottom: 10, textTransform: 'uppercase', borderBottom: '1px solid var(--border-dark)', paddingBottom: 6 }}>
              Execution Details
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Unit Rate (₹)</label>
                <input style={inputStyle} type="number" value={itemForm.unit_rate} onChange={e => updateItemField('unit_rate', e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Qty This Bill *</label>
                <input style={{ ...inputStyle, borderColor: 'var(--amber)' }} type="number" value={itemForm.qty_this_bill} onChange={e => updateItemField('qty_this_bill', e.target.value)} placeholder="Enter qty" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Amt This Bill (₹)</label>
                <input style={{ ...inputStyle, color: 'var(--green)', fontWeight: 700 }} value={itemForm.amount_this_bill} readOnly />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Qty Upto Date</label>
                <input style={{ ...inputStyle, color: 'var(--text-muted)' }} value={itemForm.qty_upto_date} readOnly />
              </div>
            </div>

            {/* Measurements Toggle */}
            <button className="btn btn-ghost btn-sm" style={{ marginBottom: 12 }}
              onClick={() => setShowMeasurements(!showMeasurements)}>
              {showMeasurements ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              Measurements ({itemForm.measurements.filter(m => m.quantity || m.description).length} rows)
            </button>

            {showMeasurements && (
              <div style={{ padding: 12, background: 'var(--surface-dark)', borderRadius: 8, marginBottom: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '40px 100px 80px 1fr 60px 50px 60px 60px 60px 60px 28px', gap: 4, marginBottom: 6 }}>
                  {['S.No', 'Date', 'RFI', 'Description', 'Nos', 'Side', 'Length', 'Breadth', 'Depth', 'Qty', ''].map((h, i) => (
                    <div key={i} style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', textAlign: 'center' }}>{h}</div>
                  ))}
                </div>
                {itemForm.measurements.map((m, mIdx) => (
                  <div key={mIdx} style={{ display: 'grid', gridTemplateColumns: '40px 100px 80px 1fr 60px 50px 60px 60px 60px 60px 28px', gap: 4, marginBottom: 4, alignItems: 'center' }}>
                    <input style={smallInput} type="number" value={m.serial_no} onChange={e => updateMeasurement(mIdx, 'serial_no', e.target.value)} placeholder={mIdx + 1} />
                    <input style={smallInput} type="date" value={m.measurement_date} onChange={e => updateMeasurement(mIdx, 'measurement_date', e.target.value)} />
                    <input style={smallInput} value={m.rfi_number} onChange={e => updateMeasurement(mIdx, 'rfi_number', e.target.value)} placeholder="RFI" />
                    <input style={smallInput} value={m.description} onChange={e => updateMeasurement(mIdx, 'description', e.target.value)} placeholder="Description" />
                    <input style={smallInput} type="number" value={m.nos} onChange={e => updateMeasurement(mIdx, 'nos', e.target.value)} placeholder="1" />
                    <input style={smallInput} value={m.side} onChange={e => updateMeasurement(mIdx, 'side', e.target.value)} placeholder="L/R" />
                    <input style={smallInput} type="number" value={m.length} onChange={e => updateMeasurement(mIdx, 'length', e.target.value)} placeholder="0" />
                    <input style={smallInput} type="number" value={m.breadth} onChange={e => updateMeasurement(mIdx, 'breadth', e.target.value)} placeholder="0" />
                    <input style={smallInput} type="number" value={m.depth} onChange={e => updateMeasurement(mIdx, 'depth', e.target.value)} placeholder="0" />
                    <input style={{ ...smallInput, color: 'var(--green)', fontWeight: 700 }} value={m.quantity} onChange={e => updateMeasurement(mIdx, 'quantity', e.target.value)} />
                    <button style={{ padding: 3, background: 'none', border: '1px solid var(--border-dark)', borderRadius: 4, cursor: 'pointer', color: 'var(--red)' }}
                      onClick={() => setItemForm(f => ({ ...f, measurements: f.measurements.filter((_, i) => i !== mIdx) }))}><Trash2 size={10} /></button>
                  </div>
                ))}
                <button className="btn btn-ghost btn-sm" style={{ marginTop: 6, fontSize: 11 }}
                  onClick={() => setItemForm(f => ({ ...f, measurements: [...f.measurements, { ...emptyMeasurement(), serial_no: f.measurements.length + 1 }] }))}>
                  <Plus size={11} /> Add Measurement Row
                </button>
              </div>
            )}

            {/* Save Button */}
            <button className="btn btn-primary" onClick={handleSaveItem} disabled={itemSaving}
              style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: 14, fontWeight: 700 }}>
              <Save size={15} />
              {itemSaving ? 'Saving...' : (editItem ? 'Update BOQ Item' : 'Add BOQ Item')}
            </button>
          </div>
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
