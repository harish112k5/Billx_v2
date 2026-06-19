import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/axios';
import { ArrowLeft, ArrowRight, Plus, Trash2, ChevronDown, ChevronUp, Calculator, CheckCircle } from 'lucide-react';

const STEPS = ['Bill Info', 'BOQ Items', 'Non-BOQ Items', 'Review & Save'];

const emptyMeasurement = () => ({
  serial_no: '', measurement_date: '', rfi_number: '', description: '',
  location_from: '', location_to: '', side: '', nos: '',
  length: '', breadth: '', depth: '', quantity: '', remarks: ''
});

const emptyNonBOQ = () => ({
  description: '', unit: 'LS', quantity: '', unit_rate: '', amount: ''
});

export default function CreateRABill() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  // Step 1 — Bill Info
  const [info, setInfo] = useState({
    contract_id: '', ra_number: '', ra_code: '', ipc_number: '',
    bill_period_from: '', bill_period_to: '',
    basic_amount_upto_date: '', basic_amount_upto_prev: '', basic_amount_this_bill: '',
    sgst_percent: 9, cgst_percent: 9, retention_percent: 5, tds_percent: 2, labour_cess_percent: 1,
    prepared_by: '', submitted_to: '',
  });

  // Step 2 — BOQ Items (pre-loaded from DB, user fills in qty/measurements)
  const [boqItems, setBoqItems] = useState([]);
  const [expandedBoq, setExpandedBoq] = useState({}); // boq_id => boolean

  // Step 3 — Non-BOQ Items
  const [nonBoqItems, setNonBoqItems] = useState([emptyNonBOQ()]);

  const [contracts, setContracts] = useState([]);
  const [project, setProject] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Live calc
  const basic   = parseFloat(info.basic_amount_this_bill) || 0;
  const sgst_p  = parseFloat(info.sgst_percent) || 0;
  const cgst_p  = parseFloat(info.cgst_percent) || 0;
  const ret_p   = parseFloat(info.retention_percent) || 0;
  const tds_p   = parseFloat(info.tds_percent) || 0;
  const lc_p    = parseFloat(info.labour_cess_percent) || 0;
  const sgst_amt = basic * sgst_p / 100;
  const cgst_amt = basic * cgst_p / 100;
  const gross    = basic + sgst_amt + cgst_amt;
  const ret_amt  = gross * ret_p / 100;
  const tds_amt  = basic * tds_p / 100;
  const lc_amt   = basic * lc_p / 100;
  const net_pay  = gross - ret_amt - tds_amt - lc_amt;

  const fmt = (v) => isNaN(v) || v === null ? '0.00' : Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const setI = (k) => (e) => setInfo(f => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    api.get('/projects/' + id).then(res => {
      const proj = res.data.data;
      setProject(proj);
      if (proj && proj.contracts) {
        setContracts(proj.contracts);
        if (proj.contracts.length > 0)
          setInfo(f => ({ ...f, contract_id: proj.contracts[0].contract_id }));
      }
    });
  }, [id]);

  // Load BOQ items when contract changes or step 2 opens
  useEffect(() => {
    if (step === 1 && info.contract_id) {
      api.get('/projects/' + id + '/boq').then(res => {
        const items = (res.data.data || []).filter(b => !b.is_non_boq);
        setBoqItems(items.map(b => ({
          boq_id: b.boq_id,
          item_code: b.item_code,
          item_number: b.item_number,
          description: b.description,
          unit: b.unit,
          planned_quantity: b.planned_quantity,
          unit_rate: b.unit_rate,
          qty_upto_previous: b.executed_quantity || 0,
          qty_upto_date: '',
          qty_this_bill: '',
          amount_this_bill: '',
          amount_upto_date: '',
          amount_upto_previous: (b.executed_amount || 0),
          measurements: [emptyMeasurement()],
        })));
      });
    }
  }, [step, info.contract_id, id]);

  const handleUptoDateChange = (e) => {
    const upto = parseFloat(e.target.value) || 0;
    const prev = parseFloat(info.basic_amount_upto_prev) || 0;
    setInfo(f => ({ ...f, basic_amount_upto_date: e.target.value, basic_amount_this_bill: upto > 0 ? (upto - prev).toFixed(2) : f.basic_amount_this_bill }));
  };
  const handleUptoPrevChange = (e) => {
    const prev = parseFloat(e.target.value) || 0;
    const upto = parseFloat(info.basic_amount_upto_date) || 0;
    setInfo(f => ({ ...f, basic_amount_upto_prev: e.target.value, basic_amount_this_bill: upto > 0 ? (upto - prev).toFixed(2) : f.basic_amount_this_bill }));
  };

  // BOQ helpers
  const updateBoq = (idx, field, value) => {
    setBoqItems(items => {
      const next = [...items];
      next[idx] = { ...next[idx], [field]: value };
      // Auto-calc amount_this_bill
      if (field === 'qty_this_bill' || field === 'unit_rate') {
        const qty  = parseFloat(field === 'qty_this_bill' ? value : next[idx].qty_this_bill) || 0;
        const rate = parseFloat(field === 'unit_rate' ? value : next[idx].unit_rate) || 0;
        next[idx].amount_this_bill = (qty * rate).toFixed(2);
        const qtyUpto = parseFloat(next[idx].qty_upto_previous || 0) + qty;
        next[idx].qty_upto_date = qtyUpto.toFixed(4);
        next[idx].amount_upto_date = (qtyUpto * rate).toFixed(2);
      }
      return next;
    });
  };

  const updateMeasurement = (boqIdx, mIdx, field, value) => {
    setBoqItems(items => {
      const next = [...items];
      const meas = [...next[boqIdx].measurements];
      meas[mIdx] = { ...meas[mIdx], [field]: value };
      // Auto-calc quantity = nos * L * B * D
      if (['nos', 'length', 'breadth', 'depth'].includes(field)) {
        const nos = parseFloat(field === 'nos' ? value : meas[mIdx].nos) || 1;
        const l   = parseFloat(field === 'length' ? value : meas[mIdx].length) || 1;
        const b   = parseFloat(field === 'breadth' ? value : meas[mIdx].breadth) || 1;
        const d   = parseFloat(field === 'depth' ? value : meas[mIdx].depth) || 1;
        meas[mIdx].quantity = (nos * l * b * d).toFixed(4);
      }
      next[boqIdx] = { ...next[boqIdx], measurements: meas };
      return next;
    });
  };

  const addMeasurement = (boqIdx) => {
    setBoqItems(items => {
      const next = [...items];
      const newM = { ...emptyMeasurement(), serial_no: next[boqIdx].measurements.length + 1 };
      next[boqIdx] = { ...next[boqIdx], measurements: [...next[boqIdx].measurements, newM] };
      return next;
    });
  };

  const removeMeasurement = (boqIdx, mIdx) => {
    setBoqItems(items => {
      const next = [...items];
      next[boqIdx] = { ...next[boqIdx], measurements: next[boqIdx].measurements.filter((_, i) => i !== mIdx) };
      return next;
    });
  };

  // Non-BOQ helpers
  const updateNonBoq = (idx, field, value) => {
    setNonBoqItems(items => {
      const next = [...items];
      next[idx] = { ...next[idx], [field]: value };
      if (field === 'quantity' || field === 'unit_rate') {
        const qty  = parseFloat(field === 'quantity' ? value : next[idx].quantity) || 0;
        const rate = parseFloat(field === 'unit_rate' ? value : next[idx].unit_rate) || 0;
        next[idx].amount = (qty * rate).toFixed(2);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...info,
        boq_items: boqItems.filter(b => b.qty_this_bill || b.measurements.some(m => m.quantity)),
        non_boq_items: nonBoqItems.filter(n => n.description),
      };
      await api.post('/projects/' + id + '/ra-bills/full', payload);
      navigate('/projects/' + id + '/ra-bills');
    } catch (err) {
      setError((err.response && err.response.data && err.response.data.error) || 'Failed to create RA Bill');
      setSaving(false);
    }
  };

  const boqTotal = boqItems.reduce((s, b) => s + (parseFloat(b.amount_this_bill) || 0), 0);
  const nonBoqTotal = nonBoqItems.reduce((s, n) => s + (parseFloat(n.amount) || 0), 0);

  // ─────── Render ───────
  const SectionTitle = ({ children }) => (
    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--amber)', letterSpacing: 1.5, marginBottom: 16, marginTop: 8, textTransform: 'uppercase', borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
      {children}
    </div>
  );

  const inputStyle = { padding: '6px 10px', fontSize: 12, background: 'var(--surface-dark)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', width: '100%', boxSizing: 'border-box' };
  const smallInput = { ...inputStyle, padding: '4px 6px', fontSize: 11 };

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/projects/' + id + '/ra-bills')}>
            <ArrowLeft size={14} /> Back
          </button>
          <div>
            <div className="page-title">Create RA Bill (Manual Entry)</div>
            {project && <div className="page-subtitle">{project.project_code} — {project.project_name}</div>}
          </div>
        </div>
      </div>

      {/* Step Indicator */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
        {STEPS.map((s, i) => (
          <div key={i} onClick={() => i < step + 1 && setStep(i)}
            style={{ flex: 1, padding: '10px 16px', fontSize: 12, fontWeight: 600, textAlign: 'center', cursor: i <= step ? 'pointer' : 'default',
              background: i === step ? 'var(--amber)' : i < step ? 'var(--surface-dark)' : 'var(--surface)',
              color: i === step ? '#000' : i < step ? 'var(--green)' : 'var(--text-muted)',
              borderRight: i < STEPS.length - 1 ? '1px solid var(--border)' : 'none' }}>
            {i < step ? <CheckCircle size={12} style={{ marginRight: 6, display: 'inline', verticalAlign: 'middle' }} /> : null}
            {i + 1}. {s}
          </div>
        ))}
      </div>

      {error && <div style={{ padding: '10px 14px', background: 'var(--red-glow)', color: 'var(--red)', borderRadius: 'var(--radius)', marginBottom: 16, fontSize: 13 }}>{error}</div>}

      {/* ══ STEP 1: Bill Info ══ */}
      {step === 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24, alignItems: 'start' }}>
          <div className="section-card">
            <SectionTitle>1. Bill Identity</SectionTitle>
            <div className="form-group">
              <label className="form-label">Contract *</label>
              <select className="form-select" value={info.contract_id} onChange={setI('contract_id')} required>
                <option value="">Select Contract...</option>
                {contracts.map(c => (
                  <option key={c.contract_id} value={c.contract_id}>
                    {c.contract_type ? c.contract_type.replace('_', ' ') : ''} — {c.org_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">RA Bill Number *</label>
                <input type="number" className="form-input" value={info.ra_number} onChange={setI('ra_number')} placeholder="e.g. 1" />
              </div>
              <div className="form-group">
                <label className="form-label">RA Bill Code</label>
                <input className="form-input" value={info.ra_code} onChange={setI('ra_code')} placeholder="e.g. RA-01" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">IPC Number</label>
              <input className="form-input" value={info.ipc_number} onChange={setI('ipc_number')} placeholder="e.g. 1" />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Bill Period From *</label>
                <input type="date" className="form-input" value={info.bill_period_from} onChange={setI('bill_period_from')} />
              </div>
              <div className="form-group">
                <label className="form-label">Bill Period To *</label>
                <input type="date" className="form-input" value={info.bill_period_to} onChange={setI('bill_period_to')} />
              </div>
            </div>

            <SectionTitle>2. Financial Amounts (₹)</SectionTitle>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Basic Amount Upto Date</label>
                <input type="number" step="0.01" className="form-input" value={info.basic_amount_upto_date} onChange={handleUptoDateChange} placeholder="Cumulative total" />
              </div>
              <div className="form-group">
                <label className="form-label">Basic Amount Upto Previous Bill</label>
                <input type="number" step="0.01" className="form-input" value={info.basic_amount_upto_prev} onChange={handleUptoPrevChange} placeholder="Previous cumulative" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Basic Amount (This Bill) (₹) *</label>
              <input type="number" step="0.01" className="form-input" value={info.basic_amount_this_bill} onChange={setI('basic_amount_this_bill')} placeholder="Auto-calculated or enter manually" />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>= Upto Date − Upto Previous</div>
            </div>

            <SectionTitle>3. Taxes & Deductions (%)</SectionTitle>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">SGST %</label><input type="number" step="0.01" className="form-input" value={info.sgst_percent} onChange={setI('sgst_percent')} /></div>
              <div className="form-group"><label className="form-label">CGST %</label><input type="number" step="0.01" className="form-input" value={info.cgst_percent} onChange={setI('cgst_percent')} /></div>
              <div className="form-group"><label className="form-label">Retention %</label><input type="number" step="0.01" className="form-input" value={info.retention_percent} onChange={setI('retention_percent')} /></div>
              <div className="form-group"><label className="form-label">TDS %</label><input type="number" step="0.01" className="form-input" value={info.tds_percent} onChange={setI('tds_percent')} /></div>
              <div className="form-group"><label className="form-label">Labour Cess %</label><input type="number" step="0.01" className="form-input" value={info.labour_cess_percent} onChange={setI('labour_cess_percent')} /></div>
            </div>

            <SectionTitle>4. Prepared & Submitted</SectionTitle>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">Prepared By</label><input className="form-input" value={info.prepared_by} onChange={setI('prepared_by')} placeholder="Name" /></div>
              <div className="form-group"><label className="form-label">Submitted To</label><input className="form-input" value={info.submitted_to} onChange={setI('submitted_to')} placeholder="Name" /></div>
            </div>
          </div>

          {/* Live Summary */}
          <div className="section-card" style={{ position: 'sticky', top: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Calculator size={15} style={{ color: 'var(--amber)' }} />
              <span style={{ fontSize: 13, fontWeight: 700 }}>Live Calculation</span>
            </div>
            {[
              { label: 'Basic Amount', value: fmt(basic), color: 'var(--text-primary)' },
              { label: 'SGST ' + sgst_p + '%', value: '+ ' + fmt(sgst_amt), color: 'var(--text-muted)' },
              { label: 'CGST ' + cgst_p + '%', value: '+ ' + fmt(cgst_amt), color: 'var(--text-muted)' },
              { label: 'Gross', value: fmt(gross), color: 'var(--blue)', bold: true },
              null,
              { label: 'Retention ' + ret_p + '%', value: '− ' + fmt(ret_amt), color: 'var(--red)' },
              { label: 'TDS ' + tds_p + '%', value: '− ' + fmt(tds_amt), color: 'var(--red)' },
              { label: 'Labour Cess ' + lc_p + '%', value: '− ' + fmt(lc_amt), color: 'var(--red)' },
            ].map((item, i) => item === null
              ? <div key={i} style={{ borderTop: '1px solid var(--border)', margin: '8px 0' }} />
              : <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.label}</span>
                  <span style={{ fontSize: 12, fontWeight: item.bold ? 700 : 400, color: item.color, fontFamily: 'monospace' }}>{item.value}</span>
                </div>
            )}
            <div style={{ borderTop: '2px solid var(--amber)', marginTop: 8, paddingTop: 12, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>Net Payable</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--green)', fontFamily: 'monospace' }}>₹{fmt(net_pay)}</span>
            </div>
          </div>
        </div>
      )}

      {/* ══ STEP 2: BOQ Items ══ */}
      {step === 1 && (
        <div className="section-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>BOQ Items</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{boqItems.length} items pre-loaded. Enter qty and add measurements.</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setBoqItems(b => [...b, { boq_id: null, item_code: '', item_number: '', description: '', unit: '', planned_quantity: '', unit_rate: '', qty_upto_previous: '', qty_upto_date: '', qty_this_bill: '', amount_this_bill: '', amount_upto_date: '', amount_upto_previous: '', measurements: [emptyMeasurement()] }])}>
              <Plus size={13} /> New Item
            </button>
          </div>

          {boqItems.map((item, idx) => (
            <div key={idx} style={{ border: '1px solid var(--border)', borderRadius: 8, marginBottom: 12, overflow: 'hidden' }}>
              {/* BOQ Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '60px 80px 1fr 70px 90px 90px 90px 90px 36px 36px', gap: 6, padding: '10px 12px', background: 'var(--surface-dark)', alignItems: 'center' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', gridColumn: '1/-1', marginBottom: 4, fontWeight: 700 }}>
                  {item.item_code ? item.item_code + ' — ' + item.description : 'New Item'}
                </div>
                <input style={smallInput} placeholder="Code" value={item.item_code} onChange={e => updateBoq(idx, 'item_code', e.target.value)} readOnly={!!item.boq_id} />
                <input style={smallInput} placeholder="Item #" value={item.item_number} onChange={e => updateBoq(idx, 'item_number', e.target.value)} readOnly={!!item.boq_id} />
                <input style={smallInput} placeholder="Description" value={item.description} onChange={e => updateBoq(idx, 'description', e.target.value)} readOnly={!!item.boq_id} />
                <input style={smallInput} placeholder="Unit" value={item.unit} onChange={e => updateBoq(idx, 'unit', e.target.value)} readOnly={!!item.boq_id} />
                <input style={{ ...smallInput, color: 'var(--text-muted)' }} placeholder="Planned Qty" value={item.planned_quantity} onChange={e => updateBoq(idx, 'planned_quantity', e.target.value)} readOnly={!!item.boq_id} />
                <input style={smallInput} placeholder="Rate (₹)" type="number" value={item.unit_rate} onChange={e => updateBoq(idx, 'unit_rate', e.target.value)} />
                <input style={{ ...smallInput, border: '1px solid var(--amber)', color: 'var(--amber)' }} placeholder="Qty This Bill" type="number" value={item.qty_this_bill} onChange={e => updateBoq(idx, 'qty_this_bill', e.target.value)} />
                <input style={{ ...smallInput, color: 'var(--green)', fontWeight: 700 }} placeholder="Amt This Bill" value={item.amount_this_bill} readOnly />
                <button style={{ padding: 4, background: 'none', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', color: expandedBoq[idx] ? 'var(--amber)' : 'var(--text-muted)' }}
                  onClick={() => setExpandedBoq(e => ({ ...e, [idx]: !e[idx] }))} title="Measurements">
                  {expandedBoq[idx] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
                <button style={{ padding: 4, background: 'none', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', color: 'var(--red)' }}
                  onClick={() => setBoqItems(b => b.filter((_, i) => i !== idx))}>
                  <Trash2 size={12} />
                </button>
              </div>

              {/* Column Headers for BOQ row */}
              {!expandedBoq[idx] && false}

              {/* Measurements expansion */}
              {expandedBoq[idx] && (
                <div style={{ padding: '10px 12px', background: 'var(--surface)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--amber)', marginBottom: 8 }}>Measurements for {item.item_code || 'Item ' + (idx + 1)}</div>
                  {/* Measurement column headers */}
                  <div style={{ display: 'grid', gridTemplateColumns: '40px 100px 90px 1fr 70px 70px 60px 50px 70px 70px 50px 80px 100px 28px', gap: 4, marginBottom: 4 }}>
                    {['S.No', 'Date', 'RFI No', 'Description', 'From', 'To', 'Side', 'Nos', 'Length', 'Breadth', 'Depth', 'Qty', 'Remarks', ''].map((h, i) => (
                      <div key={i} style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', textAlign: 'center' }}>{h}</div>
                    ))}
                  </div>
                  {item.measurements.map((m, mIdx) => (
                    <div key={mIdx} style={{ display: 'grid', gridTemplateColumns: '40px 100px 90px 1fr 70px 70px 60px 50px 70px 70px 50px 80px 100px 28px', gap: 4, marginBottom: 4, alignItems: 'center' }}>
                      <input style={smallInput} type="number" value={m.serial_no} onChange={e => updateMeasurement(idx, mIdx, 'serial_no', e.target.value)} placeholder={mIdx + 1} />
                      <input style={smallInput} type="date" value={m.measurement_date} onChange={e => updateMeasurement(idx, mIdx, 'measurement_date', e.target.value)} />
                      <input style={smallInput} value={m.rfi_number} onChange={e => updateMeasurement(idx, mIdx, 'rfi_number', e.target.value)} placeholder="RFI No" />
                      <input style={smallInput} value={m.description} onChange={e => updateMeasurement(idx, mIdx, 'description', e.target.value)} placeholder="Description" />
                      <input style={smallInput} type="number" value={m.location_from} onChange={e => updateMeasurement(idx, mIdx, 'location_from', e.target.value)} placeholder="0" />
                      <input style={smallInput} type="number" value={m.location_to} onChange={e => updateMeasurement(idx, mIdx, 'location_to', e.target.value)} placeholder="0" />
                      <input style={smallInput} value={m.side} onChange={e => updateMeasurement(idx, mIdx, 'side', e.target.value)} placeholder="L/R/B" />
                      <input style={smallInput} type="number" value={m.nos} onChange={e => updateMeasurement(idx, mIdx, 'nos', e.target.value)} placeholder="1" />
                      <input style={smallInput} type="number" value={m.length} onChange={e => updateMeasurement(idx, mIdx, 'length', e.target.value)} placeholder="0" />
                      <input style={smallInput} type="number" value={m.breadth} onChange={e => updateMeasurement(idx, mIdx, 'breadth', e.target.value)} placeholder="0" />
                      <input style={smallInput} type="number" value={m.depth} onChange={e => updateMeasurement(idx, mIdx, 'depth', e.target.value)} placeholder="0" />
                      <input style={{ ...smallInput, color: 'var(--green)', fontWeight: 700 }} value={m.quantity} onChange={e => updateMeasurement(idx, mIdx, 'quantity', e.target.value)} placeholder="0" />
                      <input style={smallInput} value={m.remarks} onChange={e => updateMeasurement(idx, mIdx, 'remarks', e.target.value)} placeholder="Remarks" />
                      <button style={{ padding: 3, background: 'none', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', color: 'var(--red)' }} onClick={() => removeMeasurement(idx, mIdx)}><Trash2 size={10} /></button>
                    </div>
                  ))}
                  <button className="btn btn-ghost btn-sm" style={{ marginTop: 6, fontSize: 11 }} onClick={() => addMeasurement(idx)}>
                    <Plus size={11} /> Add Measurement Row
                  </button>
                </div>
              )}
            </div>
          ))}

          {boqItems.length === 0 && (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: 13 }}>
              No BOQ items found for this project. Click "New Item" to add manually.
            </div>
          )}

          <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--surface-dark)', borderRadius: 8, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>BOQ Total (This Bill)</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--amber)', fontFamily: 'monospace' }}>₹{fmt(boqTotal)}</span>
          </div>
        </div>
      )}

      {/* ══ STEP 3: Non-BOQ Items ══ */}
      {step === 2 && (
        <div className="section-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Non-BOQ Items</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Extra work items not in the original BOQ scope.</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setNonBoqItems(n => [...n, emptyNonBOQ()])}>
              <Plus size={13} /> Add Row
            </button>
          </div>

          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 110px 110px 36px', gap: 8, marginBottom: 6, padding: '0 4px' }}>
            {['Description', 'Unit', 'Quantity', 'Unit Rate (₹)', 'Amount (₹)', ''].map((h, i) => (
              <div key={i} style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>{h}</div>
            ))}
          </div>

          {nonBoqItems.map((item, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 110px 110px 36px', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <input style={inputStyle} value={item.description} onChange={e => updateNonBoq(idx, 'description', e.target.value)} placeholder="Work description" />
              <input style={inputStyle} value={item.unit} onChange={e => updateNonBoq(idx, 'unit', e.target.value)} placeholder="LS" />
              <input style={inputStyle} type="number" value={item.quantity} onChange={e => updateNonBoq(idx, 'quantity', e.target.value)} placeholder="0" />
              <input style={inputStyle} type="number" value={item.unit_rate} onChange={e => updateNonBoq(idx, 'unit_rate', e.target.value)} placeholder="0.00" />
              <input style={{ ...inputStyle, color: 'var(--green)', fontWeight: 700 }} value={item.amount} onChange={e => updateNonBoq(idx, 'amount', e.target.value)} placeholder="0.00" />
              <button style={{ padding: 6, background: 'none', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--red)' }} onClick={() => setNonBoqItems(n => n.filter((_, i) => i !== idx))}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}

          <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--surface-dark)', borderRadius: 8, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Non-BOQ Total</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--amber)', fontFamily: 'monospace' }}>₹{fmt(nonBoqTotal)}</span>
          </div>
        </div>
      )}

      {/* ══ STEP 4: Review & Save ══ */}
      {step === 3 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Bill Summary */}
          <div className="section-card">
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Bill Summary</div>
            {[
              { label: 'Contract', value: (contracts.find(c => c.contract_id === info.contract_id)?.org_name || '—') },
              { label: 'RA Bill', value: (info.ra_code || 'RA-' + info.ra_number) },
              { label: 'IPC Number', value: info.ipc_number || '—' },
              { label: 'Period', value: info.bill_period_from + ' → ' + info.bill_period_to },
              { label: 'Prepared By', value: info.prepared_by || '—' },
              { label: 'Submitted To', value: info.submitted_to || '—' },
            ].map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)' }}>{r.label}</span>
                <span style={{ fontWeight: 600 }}>{r.value}</span>
              </div>
            ))}
          </div>

          {/* Financial Summary */}
          <div className="section-card">
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Financial Summary</div>
            {[
              { label: 'Basic Amount (This Bill)', value: '₹' + fmt(basic), color: 'var(--text-primary)' },
              { label: 'BOQ Items Total', value: '₹' + fmt(boqTotal), color: 'var(--blue)' },
              { label: 'Non-BOQ Items Total', value: '₹' + fmt(nonBoqTotal), color: 'var(--blue)' },
              { label: 'SGST + CGST', value: '₹' + fmt(sgst_amt + cgst_amt), color: 'var(--text-muted)' },
              { label: 'Gross Amount', value: '₹' + fmt(gross), color: 'var(--blue)', bold: true },
              { label: 'Total Deductions', value: '− ₹' + fmt(ret_amt + tds_amt + lc_amt), color: 'var(--red)' },
            ].map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)' }}>{r.label}</span>
                <span style={{ fontWeight: r.bold ? 700 : 500, color: r.color, fontFamily: 'monospace' }}>{r.value}</span>
              </div>
            ))}
            <div style={{ borderTop: '2px solid var(--amber)', paddingTop: 12, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>Net Payable</span>
              <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--green)', fontFamily: 'monospace' }}>₹{fmt(net_pay)}</span>
            </div>
          </div>

          {/* Items count */}
          <div className="section-card" style={{ gridColumn: '1/-1' }}>
            <div style={{ display: 'flex', gap: 24 }}>
              <div style={{ textAlign: 'center', flex: 1, padding: 16, background: 'var(--surface-dark)', borderRadius: 8 }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--amber)' }}>{boqItems.filter(b => b.qty_this_bill).length}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>BOQ Items with Qty</div>
              </div>
              <div style={{ textAlign: 'center', flex: 1, padding: 16, background: 'var(--surface-dark)', borderRadius: 8 }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--amber)' }}>{boqItems.reduce((s, b) => s + b.measurements.filter(m => m.quantity).length, 0)}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Measurement Rows</div>
              </div>
              <div style={{ textAlign: 'center', flex: 1, padding: 16, background: 'var(--surface-dark)', borderRadius: 8 }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--amber)' }}>{nonBoqItems.filter(n => n.description).length}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Non-BOQ Items</div>
              </div>
            </div>

            {error && <div style={{ padding: '10px 14px', background: 'var(--red-glow)', color: 'var(--red)', borderRadius: 'var(--radius)', marginTop: 16, fontSize: 13 }}>{error}</div>}

            <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}
              style={{ width: '100%', justifyContent: 'center', marginTop: 20, padding: '14px', fontSize: 15, fontWeight: 700 }}>
              {saving ? 'Creating RA Bill...' : 'Create RA Bill'}
            </button>
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
        <button className="btn btn-ghost" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}>
          <ArrowLeft size={14} /> Previous
        </button>
        {step < STEPS.length - 1 && (
          <button className="btn btn-primary" onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))}>
            Next <ArrowRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
