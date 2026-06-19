import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { fmt } from '../components/KPICard';
import { FolderKanban, Plus, ChevronRight } from 'lucide-react';

export default function ProjectsList() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    api.get('/projects').then(r => setProjects(r.data.data || [])).finally(() => setLoading(false));
  }, []);

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Projects</div>
          <div className="page-subtitle">{projects.length} projects total</div>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/projects/new')}>
          <Plus size={14} /> New Project
        </button>
      </div>

      <div className="section-card">
        {loading ? <div style={{ padding: 32, textAlign: 'center' }}><div className="loader" /></div> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
            {projects.map(p => (
              <div
                key={p.project_id}
                onClick={() => navigate(`/projects/${p.project_id}`)}
                style={{
                  background: 'var(--surface-dark)',
                  border: '1px solid var(--border-dark)',
                  borderRadius: 'var(--radius)',
                  padding: 18, cursor: 'pointer',
                  transition: 'var(--transition)'
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--amber)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-dark)'; e.currentTarget.style.transform = 'none'; }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span className="mono" style={{ fontSize: 12, color: 'var(--amber)', background: 'var(--amber-glow)', padding: '2px 8px', borderRadius: 4 }}>
                    {p.project_code}
                  </span>
                  <span className={`badge ${p.status === 'ongoing' ? 'badge-green' : 'badge-muted'}`}>{p.status}</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6, lineHeight: 1.3 }}>
                  {p.project_name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>{p.client_name}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Contract: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{fmt(p.contract_value)}</span></span>
                  <span style={{ color: 'var(--text-muted)' }}>Received: <span style={{ color: 'var(--green)', fontWeight: 600 }}>{fmt(p.total_received)}</span></span>
                </div>
              </div>
            ))}
          </div>
        )}
        {!loading && projects.length === 0 && (
          <div className="empty-state">
            <FolderKanban />
            <h3>No Projects</h3>
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => navigate('/projects/new')}>
              Create First Project
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
