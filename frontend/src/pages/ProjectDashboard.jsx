import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import { fmt, fmtFull } from '../components/KPICard';
import KPICard from '../components/KPICard';
import ProgressDonut from '../components/ProgressDonut';
import BOQTable from '../components/BOQTable';
import SandwichView from '../components/SandwichView';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell
} from 'recharts';
import {
  FileText, TrendingUp, Wallet, DollarSign, AlertCircle,
  BarChart3, ListChecks, Upload, ChevronRight, Shield, Percent,
  Building2, Calendar, Hash, TrendingDown, FileSpreadsheet
} from 'lucide-react';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#12121A', border: '1px solid #1E1E2E',
      borderRadius: 8, padding: '10px 14px', fontSize: 12
    }}>
      <div style={{ color: '#94A3B8', marginBottom: 6, fontWeight: 600 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, marginBottom: 3 }}>
          {p.name}: {fmtFull(p.value)}
        </div>
      ))}
    </div>
  );
};

export default function ProjectDashboard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [budgetData, setBudgetData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/projects/${id}/dashboard`),
      api.get(`/projects/${id}/budget`)
    ])
      .then(([dashboardRes, budgetRes]) => {
        setData(dashboardRes.data.data);
        setBudgetData(budgetRes.data.data);
      })
      .catch(e => setError(e.response?.data?.error || 'Failed to load project'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div className="loader" style={{ width: 40, height: 40 }} />
    </div>
  );

  if (error) return (
    <div className="empty-state">
      <AlertCircle size={48} color="var(--red)" />
      <h3>Error Loading Project</h3>
      <p>{error}</p>
    </div>
  );

  if (!data) return null;

  const { project, planning, execution, billing, variance, ra_progression, top_boq_items, sandwich } = data;

  // RA progression chart data
  const chartData = ra_progression.map(r => ({
    name: r.ra_code || `RA-${r.ra}`,
    'Cumulative Basic': parseFloat(r.cumulative_basic) || 0,
    'Net Payable':       parseFloat(r.net_payable)      || 0,
    'Received':          parseFloat(r.received)          || 0,
  }));

  return (
    <div className="fade-in">
      {/* ── Section A: Hero Banner ─────────────────────────────── */}
      <div className="hero-banner">
        <div className="hero-top">
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span className="mono" style={{ fontSize: 12, color: 'var(--amber)', background: 'var(--amber-glow)', padding: '2px 8px', borderRadius: 4 }}>
                {project.project_code}
              </span>
              <span className={`badge ${project.status === 'ongoing' ? 'badge-green' : 'badge-amber'}`}>
                {project.status}
              </span>
              <button 
                className="btn btn-ghost btn-sm" 
                onClick={() => navigate(`/projects/${id}/edit`)}
                style={{ padding: '2px 8px', height: 'auto', fontSize: 11 }}
              >
                Edit
              </button>
            </div>
            <div className="hero-project-name">{project.project_name}</div>
            <div className="hero-meta">
              {project.client_name && (
                <span className="hero-meta-item"><Building2 size={12} /> {project.client_name}</span>
              )}
              {project.work_order_number && (
                <span className="hero-meta-item"><Hash size={12} /> {project.work_order_number}</span>
              )}
              {execution.bill_period_from && (
                <span className="hero-meta-item">
                  <Calendar size={12} /> Bill Period: {execution.bill_period_from} to {execution.bill_period_to}
                </span>
              )}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
              RA Bill
            </div>
            <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: 32, fontWeight: 700, color: 'var(--amber)', lineHeight: 1 }}>
              RA-{String(execution.latest_ra_number || 0).padStart(2,'0')}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              of {execution.total_ra_bills} bills submitted
            </div>
          </div>
        </div>

        {/* Quick chips */}
        <div className="hero-chips">
          {[
            { label: 'Contract Value', value: fmtFull(project.contract_value), color: 'var(--text-primary)' },
            { label: 'Executed Amount', value: fmtFull(execution.amount_upto_date), color: 'var(--amber)' },
            { label: 'Payment Received', value: fmtFull(billing.payment_received), color: 'var(--green)' },
            { label: 'Pending Payment', value: fmtFull(billing.pending_payment), color: billing.pending_payment > 0 ? 'var(--red)' : 'var(--text-muted)' },
          ].map(chip => (
            <div className="hero-chip" key={chip.label}>
              <div className="chip-label">{chip.label}</div>
              <div className="chip-value" style={{ color: chip.color }}>{chip.value}</div>
            </div>
          ))}
        </div>

        {/* Quick Navigation Links */}
        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          {[
            { label: 'Budget',    icon: FileSpreadsheet, path: `/projects/${id}/budget`, color: 'var(--blue)' },
            { label: 'BOQ',       icon: ListChecks,   path: `/projects/${id}/boq`,       color: 'var(--amber)' },
            { label: 'RA Bills',  icon: FileText,     path: `/projects/${id}/ra-bills`,  color: 'var(--purple)' },
            { label: 'Analytics', icon: BarChart3,    path: `/projects/${id}/analytics`, color: 'var(--teal)' },
            { label: 'Investors', icon: DollarSign,   path: `/projects/${id}/investors`, color: 'var(--green)' },
            { label: 'Expenses',  icon: TrendingDown, path: `/projects/${id}/expenses`,  color: 'var(--red)' },
          ].map(nav => (
            <Link
              key={nav.label}
              to={nav.path}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                border: '1px solid var(--border-dark)', color: nav.color,
                background: 'var(--surface-dark)', transition: 'var(--transition)',
                textDecoration: 'none'
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = nav.color; e.currentTarget.style.background = 'var(--surface-hover)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-dark)'; e.currentTarget.style.background = 'var(--surface-dark)'; }}
            >
              <nav.icon size={12} /> {nav.label}
            </Link>
          ))}
        </div>
      </div>

      {/* ── Section A.5: Budget Overview ─────────────────────────── */}
      <div className="section-card" style={{ marginBottom: 16, padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileSpreadsheet size={16} color="var(--blue)" /> Project Budget Overview
          </div>
          <Link to={`/projects/${id}/budget`} className="btn btn-ghost btn-sm">
            View Budget <ChevronRight size={14} />
          </Link>
        </div>
        
        {!budgetData ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, background: 'var(--surface-dark)', borderRadius: 8 }}>
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No budget envelope set up yet. Plan your costs before tracking expenses.</div>
            <button className="btn btn-primary btn-sm" onClick={() => navigate(`/projects/${id}/budget`)}>Create Budget</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>Status</div>
              <div><span className={`badge badge-${budgetData.budget.status === 'approved' ? 'green' : 'amber'}`}>{budgetData.budget.status}</span></div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>Planned Envelope</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--blue)' }}>{fmtFull(budgetData.totals?.total_budgeted || 0)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>Actuals (Budgeted)</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--amber)' }}>{fmtFull(budgetData.totals?.total_actual || 0)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>Variance</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: (budgetData.totals?.total_variance || 0) < 0 ? 'var(--red)' : 'var(--green)' }}>
                {fmtFull(budgetData.totals?.total_variance || 0)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Section B Row 1: Progress ──────────────────────────── */}
      <div className="kpi-grid kpi-grid-3 mb-16">
        {/* BOQ Completion Donut */}
        <div className="kpi-card amber" style={{ gridColumn: '1' }}>
          <div className="kpi-label">BOQ Completion</div>
          <div style={{ marginTop: 12 }}>
            <ProgressDonut planning={planning} />
          </div>
        </div>

        {/* This Bill */}
        <div className="kpi-card amber">
          <div className="kpi-icon amber"><FileText /></div>
          <div className="kpi-label">This Bill (RA-{String(execution.latest_ra_number || 0).padStart(2,'0')})</div>
          <div className="kpi-value amber">{fmt(execution.amount_this_bill)}</div>
          <div className="kpi-sub">{fmtFull(execution.amount_this_bill)}</div>
        </div>

        {/* Upto Date */}
        <div className="kpi-card green">
          <div className="kpi-icon green"><TrendingUp /></div>
          <div className="kpi-label">Executed Upto Date</div>
          <div className="kpi-value green">{fmt(execution.amount_upto_date)}</div>
          <div className="kpi-sub">{fmtFull(execution.amount_upto_date)}</div>
        </div>
      </div>

      {/* ── Section B Row 2: Billing ───────────────────────────── */}
      <div className="kpi-grid kpi-grid-4 mb-16">
        <div className="kpi-card blue">
          <div className="kpi-icon blue"><BarChart3 /></div>
          <div className="kpi-label">Gross Amount</div>
          <div className="kpi-value blue">{fmt(billing.gross_amount_upto_date)}</div>
          <div className="kpi-sub">Basic + GST 18%</div>
        </div>
        <div className="kpi-card purple">
          <div className="kpi-icon purple"><DollarSign /></div>
          <div className="kpi-label">Net Payable</div>
          <div className="kpi-value purple">{fmt(billing.net_payable_upto_date)}</div>
          <div className="kpi-sub">After deductions</div>
        </div>
        <div className="kpi-card green">
          <div className="kpi-icon green"><Wallet /></div>
          <div className="kpi-label">Payment Received</div>
          <div className="kpi-value green">{fmt(billing.payment_received)}</div>
          <div className="kpi-sub">{fmtFull(billing.payment_received)}</div>
        </div>
        <div className="kpi-card red">
          <div className="kpi-icon red"><AlertCircle /></div>
          <div className="kpi-label">Pending Payment</div>
          <div className="kpi-value red">{fmt(billing.pending_payment)}</div>
          <div className="kpi-sub">Outstanding receivable</div>
        </div>
      </div>

      {/* ── Section B Row 3: Deductions ───────────────────────── */}
      <div className="kpi-grid kpi-grid-3 mb-24">
        <div className="kpi-card orange">
          <div className="kpi-icon orange"><Shield /></div>
          <div className="kpi-label">Retention Held</div>
          <div className="kpi-value orange">{fmtFull(billing.retention_held)}</div>
          <div className="kpi-sub">@ 5% of Gross — recoverable</div>
        </div>
        <div className="kpi-card red">
          <div className="kpi-icon red"><Percent /></div>
          <div className="kpi-label">TDS Deducted</div>
          <div className="kpi-value red">{fmtFull(billing.tds_deducted)}</div>
          <div className="kpi-sub">@ 2% of Basic Amount</div>
        </div>
        <div className="kpi-card amber">
          <div className="kpi-icon amber"><Percent /></div>
          <div className="kpi-label">Labour Cess</div>
          <div className="kpi-value amber">{fmtFull(billing.labour_cess)}</div>
          <div className="kpi-sub">@ 1% of Basic Amount</div>
        </div>
      </div>

      {/* ── Section C: RA Bill Progression Chart ──────────────── */}
      <div className="section-card">
        <div className="section-header">
          <div className="section-title">
            <BarChart3 /> RA Bill Progression
          </div>
          <Link to={`/projects/${id}/ra-bills`} className="btn btn-ghost btn-sm">
            View All Bills <ChevronRight size={14} />
          </Link>
        </div>

        {ra_progression.length > 0 ? (
          <>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 16, left: 16, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E1E2E" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: '#94A3B8', fontSize: 12 }}
                    axisLine={{ stroke: '#1E1E2E' }}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={v => fmt(v)}
                    tick={{ fill: '#94A3B8', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: 12, color: '#94A3B8' }}
                  />
                  <Bar dataKey="Cumulative Basic" fill="#F59E0B" radius={[4,4,0,0]} />
                  <Bar dataKey="Net Payable"       fill="#8B5CF6" radius={[4,4,0,0]} />
                  <Bar dataKey="Received"          fill="#10B981" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* RA Bills mini table */}
            <table className="data-table" style={{ marginTop: 16 }}>
              <thead>
                <tr>
                  <th>RA Bill</th><th>Period</th><th>This Bill Basic</th>
                  <th>Net Payable</th><th>Received</th><th>Pending</th><th>Stage</th>
                </tr>
              </thead>
              <tbody>
                {ra_progression.map(r => (
                  <tr
                    key={r.ra}
                    onClick={() => navigate(`/projects/${id}/ra-bills`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td><span className="mono" style={{ color: 'var(--amber)' }}>{r.ra_code || `RA-${r.ra}`}</span></td>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.period}</td>
                    <td className="mono">{fmtFull(r.basic_this_bill)}</td>
                    <td className="mono" style={{ color: 'var(--purple)' }}>{fmtFull(r.net_payable)}</td>
                    <td className="mono" style={{ color: 'var(--green)' }}>{fmtFull(r.received)}</td>
                    <td className="mono" style={{ color: r.pending > 0 ? 'var(--red)' : 'var(--text-muted)' }}>
                      {fmtFull(r.pending)}
                    </td>
                    <td>
                      <span className={`badge ${
                        r.stage === 'paid' ? 'badge-green' :
                        r.stage === 'certified' ? 'badge-purple' :
                        r.stage === 'submitted' ? 'badge-blue' : 'badge-muted'
                      }`}>{r.stage}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <div className="empty-state">
            <BarChart3 />
            <h3>No RA Bills Yet</h3>
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => navigate('/import')}>
              <Upload size={14} /> Import Excel
            </button>
          </div>
        )}
      </div>

      {/* ── Section D: BOQ Progress Table ─────────────────────── */}
      <div className="section-card">
        <div className="section-header">
          <div className="section-title">
            <ListChecks /> BOQ Progress (Top Items by Value)
          </div>
          <Link to={`/projects/${id}/boq`} className="btn btn-ghost btn-sm">
            Full BOQ <ChevronRight size={14} />
          </Link>
        </div>
        <BOQTable
          items={top_boq_items}
          onRowClick={(item) => navigate(`/projects/${id}/boq`)}
        />
      </div>

      {/* ── Section E: Sandwich View ───────────────────────────── */}
      {sandwich?.mode !== 'none' && (
        <div className="section-card">
          <div className="section-header">
            <div className="section-title">
              <Building2 /> Contractor Structure (Sandwich Layer)
            </div>
          </div>
          <SandwichView sandwich={sandwich} projectId={id} />
        </div>
      )}
    </div>
  );
}
