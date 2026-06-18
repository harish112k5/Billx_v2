import { NavLink, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../App';
import {
  LayoutDashboard, FolderKanban, FileSpreadsheet, BarChart3,
  Upload, Building2, Users, Settings, LogOut, ChevronDown,
  TrendingUp, Wallet, DollarSign
} from 'lucide-react';
import { useState, useEffect } from 'react';
import api from '../api/axios';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [projectsOpen, setProjectsOpen] = useState(false);

  useEffect(() => {
    api.get('/projects').then(r => setProjects(r.data.data?.slice(0, 5) || [])).catch(() => {});
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-text">BillX V2</div>
        <div className="logo-sub">Construction Intelligence</div>
      </div>

      {/* Main Nav */}
      <nav className="sidebar-nav">
        <NavLink to="/dashboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <LayoutDashboard /> Dashboard
        </NavLink>

        <NavLink to="/projects" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <FolderKanban /> Projects
        </NavLink>

        <NavLink to="/import" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Upload /> Import Excel
        </NavLink>
      </nav>

      {/* Recent Projects */}
      {projects.length > 0 && (
        <div className="sidebar-section">
          <div className="sidebar-section-label">Recent Projects</div>
          <nav className="sidebar-nav" style={{ padding: '4px 0' }}>
            {projects.map(p => (
              <NavLink
                key={p.project_id}
                to={`/projects/${p.project_id}`}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                style={{ fontSize: '12px' }}
              >
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: p.status === 'ongoing' ? 'var(--green)' : 'var(--amber)',
                  flexShrink: 0
                }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.project_code}
                </span>
              </NavLink>
            ))}
          </nav>
        </div>
      )}

      {/* Analytics */}
      <div className="sidebar-section">
        <div className="sidebar-section-label">Finance</div>
        <nav className="sidebar-nav">
          <NavLink to="/organizations" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Building2 /> Organizations
          </NavLink>
        </nav>
      </div>

      {/* Admin */}
      {(user?.role === 'super_admin' || user?.role === 'admin') && (
        <div className="sidebar-section">
          <div className="sidebar-section-label">Admin</div>
          <nav className="sidebar-nav">
            <NavLink to="/admin" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Settings /> Admin Panel
            </NavLink>
          </nav>
        </div>
      )}

      {/* Footer / User */}
      <div className="sidebar-footer">
        <div style={{ padding: '8px 12px', borderRadius: 'var(--radius)', background: 'var(--surface-dark)', marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{user?.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
            {user?.role?.replace('_', ' ')} · {user?.org_name?.split(' ')[0]}
          </div>
        </div>
        <button className="nav-item" onClick={handleLogout} style={{ width: '100%', background: 'none', border: 'none' }}>
          <LogOut /> Logout
        </button>
      </div>
    </aside>
  );
}
