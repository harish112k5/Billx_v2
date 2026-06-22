import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/axios';
import { fmt, fmtFull } from '../components/KPICard';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip
} from 'recharts';
import { DollarSign, Plus, X, TrendingDown, Package, Wrench, Users, Truck, AlertTriangle } from 'lucide-react';

const EXPENSE_TYPE_COLORS = {
  material:  '#4E79A7',
  manpower:  '#F28E2B',
  machinery: '#E15759',
  movement:  '#76B7B2',
  misc:      '#B07AA1',
};

const EXPENSE_TYPE_LABELS = {
  material:  'Material (Cement, Steel, Sand, etc.)',
  manpower:  'Manpower (Mason, Helper, etc.)',
  machinery: 'Machinery (Excavator, JCB, etc.)',
  movement:  'Movement/Logistics (Transport, Diesel, etc.)',
  misc:      'Misc/Non-Billable (Office, Security, etc.)',
};

const EXPENSE_TYPE_ICONS = {
  material:  Package,
  manpower:  Users,
  machinery: Wrench,
  movement:  Truck,
  misc:      DollarSign,
};

const getCategoryPlaceholder = (type) => {
  const placeholders = {
    material: 'e.g., Cement, Steel, Sand, Aggregate, Bricks',
    manpower: 'e.g., Mason, Helper, Bar Bender, Carpenter',
    machinery: 'e.g., JCB Rental, Excavator, Concrete Pump',
    movement: 'e.g., Transport, Diesel, Loading/Unloading',
    misc: 'e.g., Office Expense, Security, Tea/Refreshments'
  };
  return placeholders[type] || 'Enter category';
};

const TOOLTIP_STYLE = {
  contentStyle: { background: '#12121A', border: '1px solid #1E1E2E', borderRadius: 8 },
  labelStyle:   { color: '#94A3B8' },
  itemStyle:    { color: '#F1F5F9' },
};

export default function ExpensesPage() {
  const { id } = useParams();
  const [expenses, setExpenses] = useState([]);
  const [summary,  setSummary]  = useState([]);
  const [typeSummary, setTypeSummary] = useState([]);
  const [boqItems, setBoqItems] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showAdd,  setShowAdd]  = useState(false);
  const [typeFilter, setTypeFilter] = useState('');
  const [saving,   setSaving]   = useState(false);
  const [budgetWarning, setBudgetWarning] = useState(null);
  const [form, setForm] = useState({
    expense_type: 'material', category: '', description: '',
    amount: '', quantity: '', expense_date: new Date().toISOString().split('T')[0],
    vendor_name: '', boq_id: '', payment_status: 'pending',
  });

  const load = () => {
    setLoading(true);
    const params = typeFilter ? `?expense_type=${typeFilter}` : '';
    Promise.all([
      api.get(`/projects/${id}/expenses${params}`),
      api.get(`/projects/${id}/boq`).catch(() => ({ data: { data: [] } })),
    ]).then(([expRes, boqRes]) => {
      setExpenses(expRes.data.data || []);
      setSummary(expRes.data.summary || []);
      setTypeSummary(expRes.data.type_summary || []);
      setBoqItems(boqRes.data.data || []);
    }).finally(() => setLoading(false));
  };

  useEffect(load, [id, typeFilter]);

  const handleAdd = async () => {
    if (!form.amount || !form.expense_date) return;
    setSaving(true);
    setBudgetWarning(null);
    try {
      const res = await api.post(`/projects/${id}/expenses`, form);
      if (res.data.budget_exceeded) {
        setBudgetWarning(res.data.warning);
      }
      setShowAdd(false);
      setForm(f => ({ ...f, amount: '', description: '', vendor_name: '', category: '', quantity: '', boq_id: '' }));
      load();
    } finally { setSaving(false); }
  };

  const totalExpenses = typeSummary.reduce((s, r) => s + parseFloat(r.total || 0), 0);

  const pieData = typeSummary.map(s => ({
    name:  s.expense_type || 'material',
    value: parseFloat(s.total) || 0,
    color: EXPENSE_TYPE_COLORS[s.expense_type] || '#64748B',
    count: parseInt(s.count) || 0,
  }));

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Project Expenses</div>
          <div className="page-subtitle">Track material, manpower, machinery, logistics and miscellaneous costs</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <Plus size={14} /> Add Expense
        </button>
      </div>

      {/* Budget Warning Banner */}
      {budgetWarning && (
        <div style={{ padding: '12px 16px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid var(--amber)', borderRadius: 'var(--radius)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--amber)' }}>
          <AlertTriangle size={16} />
          <span>{budgetWarning}</span>
          <button onClick={() => setBudgetWarning(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--amber)', cursor: 'pointer' }}><X size={14} /></button>
        </div>
      )}

      {/* ── KPI Row ──────────────────────────────────────────── */}
      <div className="kpi-grid kpi-grid-4 mb-24">
        <div className="kpi-card red">
          <div className="kpi-icon red"><TrendingDown /></div>
          <div className="kpi-label">Total Expenses</div>
          <div className="kpi-value red">{fmt(totalExpenses)}</div>
          <div className="kpi-sub">{expenses.length} entries</div>
        </div>
        {typeSummary.slice(0, 3).map(s => {
          const Icon = EXPENSE_TYPE_ICONS[s.expense_type] || DollarSign;
          const pct  = totalExpenses > 0 ? ((parseFloat(s.total) / totalExpenses) * 100).toFixed(0) : 0;
          return (
            <div className="kpi-card amber" key={s.expense_type}>
              <div className="kpi-icon amber"><Icon /></div>
              <div className="kpi-label" style={{ textTransform: 'capitalize' }}>{s.expense_type}</div>
              <div className="kpi-value amber">{fmt(s.total)}</div>
              <div className="kpi-sub">{pct}% of total · {s.count} entries</div>
            </div>
          );
        })}
      </div>

      {/* ── Category Breakdown ──────────────────────────────── */}
      {pieData.length > 0 && (
        <div className="section-card mb-16" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'center' }}>
          <div>
            <div className="section-title mb-16"><DollarSign /> Expense Breakdown by Type</div>
            {typeSummary.map(s => (
              <div key={s.expense_type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: EXPENSE_TYPE_COLORS[s.expense_type] || '#64748B' }} />
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{s.expense_type}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({s.count})</span>
                </div>
                <span style={{ fontFamily: 'Rajdhani,sans-serif', fontWeight: 700, color: 'var(--text-primary)' }}>{fmtFull(s.total)}</span>
              </div>
            ))}
          </div>
          <div style={{ height: 220 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
                  {pieData.map((e, i) => <Cell key={i} fill={e.color} stroke="none" />)}
                </Pie>
                <Tooltip {...TOOLTIP_STYLE} formatter={v => [fmtFull(v), 'Amount']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Expense Table ───────────────────────────────────── */}
      <div className="section-card">
        <div className="section-header">
          <div className="section-title"><TrendingDown /> All Expenses</div>
          {/* Type Filter */}
          <select
            className="form-select"
            style={{ width: 'auto', padding: '6px 12px', fontSize: 12 }}
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
          >
            <option value="">All Types</option>
            {Object.keys(EXPENSE_TYPE_LABELS).map(t => (
              <option key={t} value={t} style={{ textTransform: 'capitalize' }}>{t}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div style={{ padding: 32, textAlign: 'center' }}><div className="loader" /></div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th><th>Type</th><th>Category</th><th>Description</th>
                  <th>BOQ Item</th><th>Vendor</th>
                  <th>Amount</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map(e => (
                  <tr key={e.expense_id}>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{e.expense_date}</td>
                    <td>
                      <span className="badge badge-muted" style={{ textTransform: 'capitalize', background: EXPENSE_TYPE_COLORS[e.expense_type] + '22', color: EXPENSE_TYPE_COLORS[e.expense_type] || 'var(--text-muted)', border: 'none' }}>
                        {e.expense_type || '—'}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, textTransform: 'capitalize' }}>{e.category || '—'}</td>
                    <td style={{ maxWidth: 200 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {e.description || e.sub_category || '—'}
                      </div>
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--amber)' }}>
                      {e.boq_item_code ? `${e.boq_item_code}` : '—'}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{e.vendor_name || '—'}</td>
                    <td className="mono" style={{ color: 'var(--red)', fontWeight: 600 }}>{fmtFull(e.amount)}</td>
                    <td>
                      <span className={`badge ${e.payment_status === 'paid' ? 'badge-green' : e.payment_status === 'partial' ? 'badge-blue' : 'badge-amber'}`}>
                        {e.payment_status || 'pending'}
                      </span>
                    </td>
                  </tr>
                ))}
                {expenses.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                    No expenses recorded yet. Add one using the button above.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Add Expense Modal ───────────────────────────────── */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <div className="modal-title">Add Expense</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAdd(false)}>
                <X size={14} />
              </button>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Expense Type *</label>
                <select className="form-select" value={form.expense_type} onChange={e => setForm(f => ({ ...f, expense_type: e.target.value }))}>
                  {Object.entries(EXPENSE_TYPE_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Category *</label>
                <input className="form-input" value={form.category}
                  placeholder={getCategoryPlaceholder(form.expense_type)}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
              </div>
            </div>

            {/* BOQ Item Link */}
            <div className="form-group">
              <label className="form-label">Link to BOQ Item (Optional)</label>
              <select className="form-select" value={form.boq_id} onChange={e => setForm(f => ({ ...f, boq_id: e.target.value }))}>
                <option value="">— Not linked to BOQ —</option>
                {boqItems.map(item => (
                  <option key={item.boq_id} value={item.boq_id}>
                    {item.item_code} — {(item.description || '').substring(0, 50)} (Budget: {fmtFull(item.planned_amount)})
                  </option>
                ))}
              </select>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Linking helps track budget vs actual cost per work item</div>
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <input className="form-input" value={form.description}
                placeholder="Brief description of the expense"
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Amount (₹) *</label>
                <input type="number" className="form-input" value={form.amount}
                  placeholder="50000" min="1"
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Quantity</label>
                <input type="number" className="form-input" value={form.quantity}
                  placeholder="e.g., 100 bags, 50 workers"
                  onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Date *</label>
                <input type="date" className="form-input" value={form.expense_date}
                  onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Vendor/Supplier Name</label>
                <input className="form-input" value={form.vendor_name}
                  placeholder="Vendor / Supplier name"
                  onChange={e => setForm(f => ({ ...f, vendor_name: e.target.value }))} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Payment Status</label>
              <select className="form-select" value={form.payment_status}
                onChange={e => setForm(f => ({ ...f, payment_status: e.target.value }))}>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="partial">Partial</option>
              </select>
            </div>

            <button
              className="btn btn-primary"
              onClick={handleAdd}
              disabled={saving || !form.amount || !form.expense_date}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {saving ? <><div className="loader" style={{ width: 16, height: 16, borderWidth: 2 }} /> Saving...</> : 'Record Expense'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
