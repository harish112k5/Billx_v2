import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { Search, X, FileSpreadsheet, Activity, AlertCircle, CheckCircle, Edit3 } from 'lucide-react';
import { fmtNum } from '../components/KPICard';

export default function BudgetPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const loadBudget = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/projects/${id}/budget`);
      setData(res.data.data); // will be null if no budget
    } catch (err) {
      setError('Failed to load budget data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBudget();
  }, [id]);

  const handleApprove = async () => {
    if (!window.confirm('Are you sure you want to approve this budget? This will lock the planned amounts from further editing.')) return;
    try {
      await api.post(`/projects/${id}/budget/approve`);
      loadBudget();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to approve budget');
    }
  };

  if (loading) {
    return <div style={{ padding: 32, textAlign: 'center' }}><div className="loader" /></div>;
  }

  if (!data) {
    return (
      <div className="fade-in">
        <div className="page-header">
          <div className="page-title">Project Budget</div>
        </div>
        <div className="empty-state" style={{ marginTop: 40 }}>
          <FileSpreadsheet size={48} style={{ opacity: 0.5, marginBottom: 16 }} />
          <h3>No budget set up yet</h3>
          <p style={{ maxWidth: 400, margin: '0 auto 24px', color: 'var(--text-muted)' }}>
            The project budget defines your planned costs before BOQ execution begins.
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/import')}>
            Import Budget Excel
          </button>
        </div>
      </div>
    );
  }

  const { budget, items, totals, reconciliation } = data;

  const filteredItems = items.filter(item => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (item.task_name || '').toLowerCase().includes(term) ||
           (item.wbs_code || '').toLowerCase().includes(term) ||
           (item.category || '').toLowerCase().includes(term);
  });

  return (
    <div className="fade-in" style={{ paddingBottom: 64 }}>
      <div className="page-header">
        <div>
          <div className="page-title">Project Budget</div>
          <div className="page-subtitle">
            Department: {budget.department || 'N/A'} • Supervisor: {budget.supervisor_name || 'N/A'} • Currency: {budget.currency}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span className={`badge badge-${budget.status === 'approved' ? 'green' : budget.status === 'revised' ? 'amber' : 'blue'}`} style={{ textTransform: 'uppercase' }}>
            {budget.status}
          </span>
          {budget.status !== 'approved' && (
            <button className="btn btn-primary btn-sm" onClick={handleApprove}>
              <CheckCircle size={14} /> Approve Budget
            </button>
          )}
        </div>
      </div>

      <div className="kpi-grid kpi-grid-4 mb-16">
        <div className="kpi-card blue">
          <div className="kpi-label">Total Budgeted</div>
          <div className="kpi-value blue">{fmtNum(totals.total_budgeted)}</div>
          <div className="kpi-sub">Planned Envelope</div>
        </div>
        <div className="kpi-card amber">
          <div className="kpi-label">Total Actuals (Itemized)</div>
          <div className="kpi-value amber">{fmtNum(totals.total_actual)}</div>
          <div className="kpi-sub">From Budget Sheet</div>
        </div>
        <div className="kpi-card" style={{ borderColor: totals.total_variance < 0 ? 'var(--red)' : 'var(--green)' }}>
          <div className="kpi-label">Overall Variance</div>
          <div className="kpi-value" style={{ color: totals.total_variance < 0 ? 'var(--red)' : 'var(--green)' }}>
            {totals.total_variance < 0 ? '-' : '+'}{fmtNum(Math.abs(totals.total_variance))}
          </div>
          <div className="kpi-sub">Budgeted - Actual</div>
        </div>
        <div className="kpi-card purple">
          <div className="kpi-label">Planned vs Actual Hours</div>
          <div className="kpi-value purple">{fmtNum(totals.total_planned_hours)} / {fmtNum(totals.total_actual_hours)}</div>
          <div className="kpi-sub">Total Labor Hours</div>
        </div>
      </div>

      {Math.abs(reconciliation.discrepancy) > 0.01 && (
        <div style={{ padding: 16, background: 'var(--amber-glow)', border: '1px solid var(--amber)', borderRadius: 'var(--radius)', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <AlertCircle size={18} color="var(--amber)" style={{ marginTop: 2 }} />
          <div>
            <div style={{ fontWeight: 600, color: 'var(--amber)', marginBottom: 4 }}>Reconciliation Discrepancy</div>
            <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
              The sum of itemized actuals (<strong>{fmtNum(reconciliation.budget_actual_total)}</strong>) does not match the total recorded in Project Expenses (<strong>{fmtNum(reconciliation.recorded_expenses_total)}</strong>). 
              Difference: <strong>{fmtNum(reconciliation.discrepancy)}</strong>
            </div>
          </div>
        </div>
      )}

      <div className="section-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontWeight: 600 }}>Budget Line Items</div>
          <div style={{ position: 'relative', width: 250 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="form-input"
              style={{ paddingLeft: 34, height: 32, fontSize: 13 }}
              placeholder="Search tasks..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: 'var(--text-muted)', padding: 0
              }}>
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>WBS</th>
                <th>Task Name</th>
                <th>Category</th>
                <th style={{ textAlign: 'right' }}>Plan Hrs</th>
                <th style={{ textAlign: 'right' }}>Act Hrs</th>
                <th style={{ textAlign: 'right' }}>Labor Rate</th>
                <th style={{ textAlign: 'right' }}>Plan Mat Unit</th>
                <th style={{ textAlign: 'right' }}>Act Mat Unit</th>
                <th style={{ textAlign: 'right' }}>Mat Rate</th>
                <th style={{ textAlign: 'right' }}>Fixed/Misc Cost</th>
                <th style={{ textAlign: 'right', background: 'rgba(59,130,246,0.1)' }}>Budgeted (₹)</th>
                <th style={{ textAlign: 'right', background: 'rgba(245,158,11,0.1)' }}>Actual (₹)</th>
                <th style={{ textAlign: 'right' }}>Variance (₹)</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(item => (
                <tr key={item.budget_item_id}>
                  <td className="mono">{item.wbs_code || '—'}</td>
                  <td style={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.task_name}>
                    {item.task_name}
                  </td>
                  <td><span className="badge badge-outline">{item.category}</span></td>
                  
                  <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(item.planned_hours)}</td>
                  <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(item.actual_hours)}</td>
                  <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(item.labor_rate)}</td>
                  
                  <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(item.planned_material_units)}</td>
                  <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(item.actual_material_units)}</td>
                  <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(item.material_rate)}</td>
                  
                  <td className="mono" style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                    {(parseFloat(item.fixed_cost) || 0) + (parseFloat(item.misc_cost) || 0) > 0 ? 
                      fmtNum(parseFloat(item.fixed_cost) + parseFloat(item.misc_cost)) : '—'}
                  </td>

                  <td className="mono" style={{ textAlign: 'right', fontWeight: 600, color: 'var(--blue)' }}>
                    {fmtNum(item.budgeted_amount)}
                  </td>
                  <td className="mono" style={{ textAlign: 'right', fontWeight: 600, color: 'var(--amber)' }}>
                    {fmtNum(item.actual_amount)}
                  </td>
                  <td className="mono" style={{ textAlign: 'right', fontWeight: 600, color: parseFloat(item.variance_amount) < 0 ? 'var(--red)' : 'var(--green)' }}>
                    {fmtNum(item.variance_amount)}
                  </td>
                </tr>
              ))}
              {filteredItems.length > 0 && (
                <tr style={{ background: 'var(--surface-dark)', fontWeight: 700 }}>
                  <td colSpan={3} style={{ textAlign: 'right' }}>SUBTOTAL</td>
                  <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(totals.total_planned_hours)}</td>
                  <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(totals.total_actual_hours)}</td>
                  <td></td>
                  <td colSpan={4}></td>
                  <td className="mono" style={{ textAlign: 'right', color: 'var(--blue)' }}>{fmtNum(totals.total_budgeted)}</td>
                  <td className="mono" style={{ textAlign: 'right', color: 'var(--amber)' }}>{fmtNum(totals.total_actual)}</td>
                  <td className="mono" style={{ textAlign: 'right', color: totals.total_variance < 0 ? 'var(--red)' : 'var(--green)' }}>{fmtNum(totals.total_variance)}</td>
                </tr>
              )}
            </tbody>
          </table>
          {filteredItems.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
              No items match your search
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
