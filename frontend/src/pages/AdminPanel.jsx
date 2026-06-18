import { useEffect, useState } from 'react';
import api from '../api/axios';
import { Settings, Users, FolderKanban, FileSpreadsheet } from 'lucide-react';

export default function AdminPanel() {
  const [stats, setStats]  = useState(null);
  const [users, setUsers]  = useState([]);
  const [tab, setTab]      = useState('stats');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/admin/stats'),
      api.get('/admin/users'),
    ]).then(([s, u]) => {
      setStats(s.data.data);
      setUsers(u.data.data || []);
    }).finally(() => setLoading(false));
  }, []);

  const roleColor = {
    super_admin: 'badge-red', admin: 'badge-amber',
    manager: 'badge-blue', engineer: 'badge-green',
    viewer: 'badge-muted', investor: 'badge-purple'
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div className="page-title">Admin Panel</div>
      </div>

      <div className="tab-list mb-24">
        <button className={`tab-btn ${tab === 'stats' ? 'active' : ''}`} onClick={() => setTab('stats')}>System Stats</button>
        <button className={`tab-btn ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>Users</button>
      </div>

      {tab === 'stats' && stats && (
        <div className="kpi-grid kpi-grid-3">
          {[
            { label: 'Projects', value: stats.projects, icon: FolderKanban, color: 'amber' },
            { label: 'Active Users', value: stats.users, icon: Users, color: 'blue' },
            { label: 'Organizations', value: stats.orgs, icon: Settings, color: 'green' },
            { label: 'RA Bills', value: stats.ra_bills, icon: FileSpreadsheet, color: 'purple' },
            { label: 'BOQ Items', value: stats.boq_items, icon: Settings, color: 'teal' },
            { label: 'Excel Imports', value: stats.imports, icon: FileSpreadsheet, color: 'orange' },
          ].map(s => (
            <div key={s.label} className={`kpi-card ${s.color}`}>
              <div className={`kpi-icon ${s.color}`}><s.icon /></div>
              <div className="kpi-label">{s.label}</div>
              <div className={`kpi-value ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'users' && (
        <div className="section-card">
          {loading ? <div style={{ padding: 32, textAlign: 'center' }}><div className="loader" /></div> : (
            <table className="data-table">
              <thead><tr>
                <th>Name</th><th>Email</th><th>Role</th><th>Organization</th><th>Last Login</th><th>Status</th>
              </tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.user_id}>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{u.name}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{u.email}</td>
                    <td><span className={`badge ${roleColor[u.role] || 'badge-muted'}`}>{u.role?.replace('_', ' ')}</span></td>
                    <td>{u.org_name}</td>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{u.last_login ? new Date(u.last_login).toLocaleDateString('en-IN') : 'Never'}</td>
                    <td><span className={`badge ${u.is_active ? 'badge-green' : 'badge-red'}`}>{u.is_active ? 'Active' : 'Inactive'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
