import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../App';
import { fmt } from '../components/KPICard';
import {
  FolderKanban, TrendingUp, DollarSign, AlertCircle,
  Plus, ChevronRight, Activity
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

      {/* Summary KPIs */}
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
        <div className="kpi-card blue">
          <div className="kpi-icon blue"><TrendingUp /></div>
          <div className="kpi-label">Total Received</div>
          <div className="kpi-value blue">{fmt(totalReceived)}</div>
          <div className="kpi-sub">Across all RA bills</div>
        </div>
        <div className="kpi-card purple">
          <div className="kpi-icon purple"><Activity /></div>
          <div className="kpi-label">RA Bills Total</div>
          <div className="kpi-value purple">
            {projects.reduce((s, p) => s + parseInt(p.total_ra_bills || 0), 0)}
          </div>
          <div className="kpi-sub">All submitted bills</div>
        </div>
      </div>

      {/* Projects List */}
      <div className="section-card">
        <div className="section-header">
          <div className="section-title">
            <FolderKanban /> All Projects
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
          <table className="data-table">
            <thead>
              <tr>
                <th>Project Code</th>
                <th>Project Name</th>
                <th>Client</th>
                <th>Contract Value</th>
                <th>RA Bills</th>
                <th>Received</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {projects.map(p => {
                const st = STATUS_COLORS[p.status] || { label: p.status, cls: 'badge-muted' };
                return (
                  <tr key={p.project_id} onClick={() => navigate(`/projects/${p.project_id}`)} style={{ cursor: 'pointer' }}>
                    <td>
                      <span className="mono" style={{ color: 'var(--amber)', fontSize: 12 }}>{p.project_code}</span>
                    </td>
                    <td style={{ color: 'var(--text-primary)', maxWidth: 300 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280 }}>
                        {p.project_name}
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{p.client_name || '—'}</td>
                    <td className="mono" style={{ color: 'var(--text-secondary)' }}>{fmt(p.contract_value)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge badge-blue">{p.total_ra_bills || 0}</span>
                    </td>
                    <td className="mono" style={{ color: 'var(--green)' }}>{fmt(p.total_received)}</td>
                    <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                    <td><ChevronRight size={14} style={{ color: 'var(--text-muted)' }} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
