import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../App';
import { fmt, fmtFull } from '../components/KPICard';
import {
  FolderKanban, TrendingUp, DollarSign, AlertCircle,
  Plus, ChevronRight, Activity, Wallet, TrendingDown
} from 'lucide-react';

const STATUS_COLORS = {
  ongoing:   { label: 'Ongoing',   cls: 'badge-green' },
  planned:   { label: 'Planned',   cls: 'badge-blue' },
  on_hold:   { label: 'On Hold',   cls: 'badge-amber' },
  completed: { label: 'Completed', cls: 'badge-muted' },
  cancelled: { label: 'Cancelled', cls: 'badge-red' },
};

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/projects').then(r => {
      setProjects(r.data.data || []);
    }).finally(() => setLoading(false));
  }, []);

  const totalReceived  = projects.reduce((s, p) => s + parseFloat(p.total_received || 0), 0);
  const totalContracts = projects.reduce((s, p) => s + parseFloat(p.contract_value || 0), 0);
  const totalExpenses  = projects.reduce((s, p) => s + parseFloat(p.total_expenses || 0), 0);
  const totalPlannedBudget = projects.reduce((s, p) => s + parseFloat(p.planned_budget || 0), 0);
  const portfolioBudgetPercent = totalPlannedBudget > 0
    ? Math.round((totalExpenses / totalPlannedBudget) * 10000) / 100
    : 0;

  // Sort projects: red first, then orange, then green
  const statusOrder = { red: 0, orange: 1, green: 2 };
  const sortedProjects = [...projects].sort((a, b) => {
    const aOrder = statusOrder[a.budget_status] ?? 2;
    const bOrder = statusOrder[b.budget_status] ?? 2;
    return aOrder - bOrder;
  });

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-subtitle">
            Welcome back, {user?.name} · {user?.org_name}
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/projects/new')}>
          <Plus size={15} /> New Project
        </button>
      </div>

      {/* Portfolio KPI Cards */}
      <div className="kpi-grid kpi-grid-4 mb-24">
        <div className="kpi-card amber">
          <div className="kpi-icon amber"><FolderKanban /></div>
          <div className="kpi-label">Total Projects</div>
          <div className="kpi-value amber">{projects.length}</div>
          <div className="kpi-sub">{projects.filter(p => p.status === 'ongoing').length} ongoing</div>
        </div>
        <div className="kpi-card green">
          <div className="kpi-icon green"><DollarSign /></div>
          <div className="kpi-label">Total Contract Value</div>
          <div className="kpi-value green">{fmt(totalContracts)}</div>
          <div className="kpi-sub">All projects combined</div>
        </div>
        <div className="kpi-card red">
          <div className="kpi-icon red"><TrendingDown /></div>
          <div className="kpi-label">Total Expenses</div>
          <div className="kpi-value red">{fmt(totalExpenses)}</div>
          <div className="kpi-sub">Across all projects</div>
        </div>
        <div className="kpi-card purple">
          <div className="kpi-icon purple"><Activity /></div>
          <div className="kpi-label">Portfolio Budget Used</div>
          <div className="kpi-value purple">{portfolioBudgetPercent}%</div>
          <div className="kpi-sub">{fmt(totalExpenses)} / {fmt(totalPlannedBudget)}</div>
        </div>
      </div>

      {/* All Projects — Budget Health Table */}
      <div className="section-card">
        <div className="section-header">
          <div className="section-title">
            <FolderKanban /> All Projects — Budget Overview
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/projects')}>
            View All <ChevronRight size={14} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <div className="loader" />
          </div>
        ) : projects.length === 0 ? (
          <div className="empty-state">
            <FolderKanban />
            <h3>No Projects Yet</h3>
            <p>Create your first project to get started</p>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/projects/new')}>
              <Plus size={15} /> Create Project
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Contract Value</th>
                  <th>Planned Budget</th>
                  <th>Expenses</th>
                  <th>Budget Used</th>
                  <th>Status</th>
                  <th>Revenue</th>
                  <th>Profit Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sortedProjects.map(p => {
                  const st = STATUS_COLORS[p.status] || { label: p.status, cls: 'badge-muted' };
                  const budgetUsed = parseFloat(p.budget_used_percent) || 0;
                  const budgetStatus = p.budget_status || 'green';
                  const currentProfit = parseFloat(p.current_profit) || 0;
                  const plannedProfit = parseFloat(p.planned_profit) || 0;
                  return (
                    <tr key={p.project_id} onClick={() => navigate(`/projects/${p.project_id}`)} style={{ cursor: 'pointer' }}>
                      <td>
                        <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{p.project_name}</div>
                        <span className="mono" style={{ fontSize: 11, color: 'var(--amber)' }}>{p.project_code}</span>
                      </td>
                      <td className="mono" style={{ color: 'var(--text-secondary)' }}>{fmt(p.contract_value)}</td>
                      <td className="mono" style={{ color: 'var(--blue)' }}>{fmt(p.planned_budget)}</td>
                      <td className="mono" style={{ color: 'var(--red)' }}>{fmt(p.total_expenses)}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="mini-progress">
                            <div
                              className={`mini-fill ${budgetStatus}`}
                              style={{ width: `${Math.min(budgetUsed, 100)}%` }}
                            />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 600 }}>{budgetUsed}%</span>
                        </div>
                      </td>
                      <td>
                        <span className={`status-badge ${budgetStatus}`}>
                          {budgetStatus === 'green' ? 'Healthy' :
                           budgetStatus === 'orange' ? 'Caution' : 'Critical'}
                        </span>
                      </td>
                      <td className="mono" style={{ color: 'var(--green)' }}>{fmt(p.total_received)}</td>
                      <td>
                        <span className={`profit-badge ${currentProfit >= plannedProfit ? 'positive' : 'negative'}`}>
                          {currentProfit >= plannedProfit ? 'On Track' : 'At Risk'}
                        </span>
                      </td>
                      <td><ChevronRight size={14} style={{ color: 'var(--text-muted)' }} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
