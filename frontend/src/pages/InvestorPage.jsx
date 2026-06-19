import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/axios';
import { fmt, fmtFull } from '../components/KPICard';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';
import { DollarSign, TrendingUp, Users, Plus, X } from 'lucide-react';

export default function InvestorPage() {
  const { id } = useParams();
  const [investments, setInvestments] = useState([]);
  const [investors, setInvestors]     = useState([]);
  const [dashboard, setDashboard]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ investor_id: '', amount: '', investment_date: '', return_type: 'fixed_return', return_percent: 15, notes: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    Promise.all([
      api.get(`/projects/${id}/investments`),
      api.get('/investors'),
      api.get(`/projects/${id}/dashboard`),
    ]).then(([invRes, allInvRes, dash]) => {
      setInvestments(invRes.data.data || []);
      setInvestors(allInvRes.data.data || []);
      setDashboard(dash.data.data);
    }).finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  const totalInvested  = investments.reduce((s, i) => s + parseFloat(i.amount || 0), 0);
  const totalRepaid    = investments.reduce((s, i) => s + parseFloat(i.repaid_amount || 0), 0);
  const totalExpected  = investments.reduce((s, i) => s + parseFloat(i.expected_return || 0), 0);

  const handleAdd = async () => {
    setSaving(true);
    try {
      const expectedReturn = parseFloat(form.amount) * (1 + parseFloat(form.return_percent) / 100);
      await api.post(`/projects/${id}/investments`, { ...form, expected_return: expectedReturn });
      setShowAdd(false);
      load();
    } finally { setSaving(false); }
  };

  const statusColor = {
    active: 'badge-blue', partially_repaid: 'badge-amber', fully_repaid: 'badge-green'
  };

  if (loading) return <div style={{ padding: 32, textAlign: 'center' }}><div className="loader" /></div>;

  const billing = dashboard?.billing;
  const planning = dashboard?.planning;

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Investor Dashboard</div>
          <div className="page-subtitle">Investment tracking and project health for investors</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <Plus size={14} /> Add Investment
        </button>
      </div>

      {/* ── Section A: Summary Cards ───────────────────────── */}
      <div className="kpi-grid kpi-grid-4 mb-24">
        <div className="kpi-card purple">
          <div className="kpi-icon purple"><Users /></div>
          <div className="kpi-label">Total Invested</div>
          <div className="kpi-value purple">{fmtFull(totalInvested)}</div>
          <div className="kpi-sub">{investments.length} investors</div>
        </div>
        <div className="kpi-card blue">
          <div className="kpi-icon blue"><TrendingUp /></div>
          <div className="kpi-label">Certified Revenue</div>
          <div className="kpi-value blue">{fmtFull(billing?.certified_amount || 0)}</div>
          <div className="kpi-sub">From RA Bills</div>
        </div>
        <div className="kpi-card green">
          <div className="kpi-icon green"><DollarSign /></div>
          <div className="kpi-label">Payment Received</div>
          <div className="kpi-value green">{fmtFull(billing?.payment_received || 0)}</div>
          <div className="kpi-sub">Project cashflow in</div>
        </div>
        <div className="kpi-card amber">
          <div className="kpi-icon amber"><TrendingUp /></div>
          <div className="kpi-label">Expected Returns</div>
          <div className="kpi-value amber">{fmtFull(totalExpected)}</div>
          <div className="kpi-sub">Total projected return</div>
        </div>
      </div>

      {/* ── Section C: ROI Tracker ─────────────────────────── */}
      <div className="section-card mb-16">
        <div className="section-header">
          <div className="section-title"><Users /> Investor ROI Tracker</div>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Investor</th><th>Type</th><th>Invested</th>
              <th>Expected Return</th><th>Return %</th>
              <th>Repaid</th><th>ROI Achieved</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {investments.map(inv => {
              const roi = inv.amount > 0 ? ((inv.repaid_amount / inv.amount - 1) * 100).toFixed(1) : 0;
              return (
                <tr key={inv.investment_id}>
                  <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{inv.investor_name}</td>
                  <td style={{ fontSize: 11 }}><span className="badge badge-muted">{inv.investor_type}</span></td>
                  <td className="mono">{fmtFull(inv.amount)}</td>
                  <td className="mono" style={{ color: 'var(--amber)' }}>{fmtFull(inv.expected_return)}</td>
                  <td>
                    <span className="badge badge-purple">{inv.return_percent}%</span>
                  </td>
                  <td className="mono" style={{ color: 'var(--green)' }}>{fmtFull(inv.repaid_amount)}</td>
                  <td className="mono" style={{ color: roi > 0 ? 'var(--green)' : 'var(--text-muted)' }}>
                    {roi > 0 ? `+${roi}%` : '0%'}
                  </td>
                  <td><span className={`badge ${statusColor[inv.status] || 'badge-muted'}`}>{inv.status?.replace('_', ' ')}</span></td>
                </tr>
              );
            })}
            {investments.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                No investments recorded. Add an investment to start tracking.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Section D: Project Health ──────────────────────── */}
      {dashboard && (
        <div className="section-card">
          <div className="section-header">
            <div className="section-title"><TrendingUp /> Project Health for Investors</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {[
              { label: 'BOQ Completion', value: `${planning?.avg_completion?.toFixed(1)}%`, sub: `${planning?.completed_items} of ${planning?.total_boq_items} items`, color: 'var(--green)' },
              { label: 'Contract Value', value: fmtFull(dashboard?.project?.contract_value), sub: 'Total project scope', color: 'var(--blue)' },
              { label: 'RA Bills Filed', value: dashboard?.execution?.total_ra_bills, sub: `Latest: RA-${String(dashboard?.execution?.latest_ra_number).padStart(2,'0')}`, color: 'var(--amber)' },
            ].map(s => (
              <div key={s.label} style={{ padding: '16px', background: 'var(--surface-dark)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Investment Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Add Investment</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAdd(false)}><X size={14} /></button>
            </div>
            <div className="form-group">
              <label className="form-label">Investor</label>
              <select className="form-select" value={form.investor_id} onChange={e => setForm(f => ({ ...f, investor_id: e.target.value }))}>
                <option value="">Select investor...</option>
                {investors.map(i => <option key={i.investor_id} value={i.investor_id}>{i.name}</option>)}
              </select>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Amount (₹)</label>
                <input type="number" className="form-input" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input type="date" className="form-input" value={form.investment_date} onChange={e => setForm(f => ({ ...f, investment_date: e.target.value }))} />
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Return Type</label>
                <select className="form-select" value={form.return_type} onChange={e => setForm(f => ({ ...f, return_type: e.target.value }))}>
                  <option value="fixed_return">Fixed Return</option>
                  <option value="profit_share">Profit Share</option>
                  <option value="billing_based">Billing Based</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Return %</label>
                <input type="number" className="form-input" value={form.return_percent} onChange={e => setForm(f => ({ ...f, return_percent: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-textarea" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <button className="btn btn-primary" onClick={handleAdd} disabled={saving} style={{ width: '100%', justifyContent: 'center' }}>
              {saving ? 'Saving...' : 'Add Investment'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
