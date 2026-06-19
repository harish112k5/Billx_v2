import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/axios';
import { fmt, fmtFull } from '../components/KPICard';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip
} from 'recharts';
import { DollarSign, Plus, X, TrendingDown, Package, Wrench, Users, Truck } from 'lucide-react';

const CATEGORY_COLORS = {
  labour:    '#F59E0B',
  material:  '#3B82F6',
  equipment: '#8B5CF6',
  overhead:  '#10B981',
  transport: '#06B6D4',
  other:     '#64748B',
};

const CATEGORY_ICONS = {
  labour:    Users,
  material:  Package,
  equipment: Wrench,
  overhead:  DollarSign,
  transport: Truck,
  other:     DollarSign,
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
  const [loading,  setLoading]  = useState(true);
  const [showAdd,  setShowAdd]  = useState(false);
  const [catFilter, setCatFilter] = useState('');
  const [saving,   setSaving]   = useState(false);
  const [form, setForm] = useState({
    category: 'labour', sub_category: '', description: '',
    amount: '', expense_date: new Date().toISOString().split('T')[0],
    vendor_name: '', invoice_number: '', payment_status: 'pending',
  });

  const load = () => {
    setLoading(true);
    const params = catFilter ? `?category=${catFilter}` : '';
    api.get(`/projects/${id}/expenses${params}`)
      .then(r => {
        setExpenses(r.data.data || []);
        setSummary(r.data.summary || []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, [id, catFilter]);

  const handleAdd = async () => {
    if (!form.amount || !form.expense_date) return;
    setSaving(true);
    try {
      await api.post(`/projects/${id}/expenses`, form);
      setShowAdd(false);
      setForm(f => ({ ...f, amount: '', description: '', vendor_name: '', invoice_number: '' }));
      load();
    } finally { setSaving(false); }
  };

  const totalExpenses = summary.reduce((s, r) => s + parseFloat(r.total || 0), 0);

  const pieData = summary.map(s => ({
    name:  s.category,
    value: parseFloat(s.total) || 0,
    color: CATEGORY_COLORS[s.category] || '#64748B',
  }));

  const statusBadge = {
    pending: 'badge-amber', paid: 'badge-green', partial: 'badge-blue'
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Project Expenses</div>
          <div className="page-subtitle">Track labour, material, equipment and overhead costs</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <Plus size={14} /> Add Expense
        </button>
      </div>

      {/* ── KPI Row ──────────────────────────────────────────── */}
      <div className="kpi-grid kpi-grid-4 mb-24">
        <div className="kpi-card red">
          <div className="kpi-icon red"><TrendingDown /></div>
          <div className="kpi-label">Total Expenses</div>
          <div className="kpi-value red">{fmt(totalExpenses)}</div>
          <div className="kpi-sub">{expenses.length} entries</div>
        </div>
        {summary.slice(0, 3).map(s => {
          const Icon = CATEGORY_ICONS[s.category] || DollarSign;
          const pct  = totalExpenses > 0 ? ((parseFloat(s.total) / totalExpenses) * 100).toFixed(0) : 0;
          return (
            <div className="kpi-card amber" key={s.category}>
              <div className="kpi-icon amber"><Icon /></div>
              <div className="kpi-label" style={{ textTransform: 'capitalize' }}>{s.category}</div>
              <div className="kpi-value amber">{fmt(s.total)}</div>
              <div className="kpi-sub">{pct}% of total</div>
            </div>
          );
        })}
      </div>

      {/* ── Category Breakdown ──────────────────────────────── */}
      {pieData.length > 0 && (
        <div className="section-card mb-16" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'center' }}>
          <div>
            <div className="section-title mb-16"><DollarSign /> Expense Breakdown by Category</div>
            {summary.map(s => (
              <div key={s.category} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: CATEGORY_COLORS[s.category] || '#64748B' }} />
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{s.category}</span>
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
          {/* Category Filter */}
          <select
            className="form-select"
            style={{ width: 'auto', padding: '6px 12px', fontSize: 12 }}
            value={catFilter}
            onChange={e => setCatFilter(e.target.value)}
          >
            <option value="">All Categories</option>
            {['labour','material','equipment','overhead','transport','other'].map(c => (
              <option key={c} value={c} style={{ textTransform: 'capitalize' }}>{c}</option>
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
                  <th>Date</th><th>Category</th><th>Description</th>
                  <th>Vendor</th><th>Invoice No</th>
                  <th>Amount</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map(e => (
                  <tr key={e.expense_id}>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{e.expense_date}</td>
                    <td>
                      <span className="badge badge-muted" style={{ textTransform: 'capitalize' }}>{e.category}</span>
                    </td>
                    <td style={{ maxWidth: 250 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {e.description || e.sub_category || '—'}
                      </div>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{e.vendor_name || '—'}</td>
                    <td className="mono" style={{ fontSize: 11 }}>{e.invoice_number || '—'}</td>
                    <td className="mono" style={{ color: 'var(--red)', fontWeight: 600 }}>{fmtFull(e.amount)}</td>
                    <td>
                      <span className={`badge ${statusBadge[e.payment_status] || 'badge-muted'}`}>
                        {e.payment_status || 'pending'}
                      </span>
                    </td>
                  </tr>
                ))}
                {expenses.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
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
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <div className="modal-title">Add Expense</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAdd(false)}>
                <X size={14} />
              </button>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Category *</label>
                <select className="form-select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {['labour','material','equipment','overhead','transport','other'].map(c => (
                    <option key={c} value={c} style={{ textTransform: 'capitalize' }}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Sub-Category</label>
                <input className="form-input" value={form.sub_category}
                  placeholder="e.g. Excavation Labour"
                  onChange={e => setForm(f => ({ ...f, sub_category: e.target.value }))} />
              </div>
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
                  placeholder="50000"
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Date *</label>
                <input type="date" className="form-input" value={form.expense_date}
                  onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Vendor Name</label>
                <input className="form-input" value={form.vendor_name}
                  placeholder="Vendor / Supplier name"
                  onChange={e => setForm(f => ({ ...f, vendor_name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Invoice Number</label>
                <input className="form-input" value={form.invoice_number}
                  placeholder="INV-2025-001"
                  onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))} />
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
