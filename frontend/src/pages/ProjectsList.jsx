import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { fmt } from '../components/KPICard';
import { FolderKanban, Plus, Search, SlidersHorizontal, Download, LayoutGrid, List } from 'lucide-react';

export default function ProjectsList() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading]   = useState(true);

  // Table Controls State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [hiddenColumns, setHiddenColumns] = useState([]);
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [viewMode, setViewMode] = useState('list');

  useEffect(() => {
    api.get('/projects')
      .then(r => setProjects(r.data.data || []))
      .catch(e => {
        console.error('Failed to fetch projects:', e);
        setProjects([]);
      })
      .finally(() => setLoading(false));
  }, []);

  // Filtering Logic
  const filtered = projects.filter(p => {
    if (statusFilter !== 'all' && p.status?.toLowerCase() !== statusFilter.toLowerCase()) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const nameMatch = p.project_name?.toLowerCase().includes(term);
      const codeMatch = p.project_code?.toLowerCase().includes(term);
      if (!nameMatch && !codeMatch) return false;
    }
    return true;
  });

  // Export CSV Logic
  const handleExportCSV = () => {
    const headers = ['Project Code', 'Project Name', 'Client', 'Status', 'Contract Value', 'Received'];
    const rows = filtered.map(p => [
      p.project_code || '',
      `"${(p.project_name || '').replace(/"/g, '""')}"`,
      `"${(p.client_name || '').replace(/"/g, '""')}"`,
      p.status || '',
      p.contract_value || 0,
      p.total_received || 0
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "projects_export.csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const allColumns = ['Project Code', 'Project Name', 'Client', 'Status', 'Contract Value', 'Received'];

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Projects</div>
          <div className="page-subtitle">{filtered.length} projects found</div>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/projects/new')}>
          <Plus size={14} /> New Project
        </button>
      </div>

      {/* Data Table Controls */}
      <div className="controls-bar" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Search projects..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
              style={{ padding: '8px 12px 8px 32px', borderRadius: 6, border: '1px solid var(--border-dark)', background: 'var(--surface-dark)', color: 'var(--text-primary)', outline: 'none' }} 
            />
          </div>
          {/* Status Filter */}
          <select 
            value={statusFilter} 
            onChange={e => setStatusFilter(e.target.value)} 
            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-dark)', background: 'var(--surface-dark)', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer' }}
          >
            <option value="all">All Status</option>
            <option value="planned">Planned</option>
            <option value="ongoing">Ongoing</option>
            <option value="on hold">On Hold</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: 12, position: 'relative', alignItems: 'center' }}>
          {/* Columns Toggle */}
          <div>
            <button className="btn btn-secondary" onClick={() => setShowColumnMenu(!showColumnMenu)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <SlidersHorizontal size={14} /> Columns
            </button>
            {showColumnMenu && (
              <div style={{ position: 'absolute', top: '110%', right: 120, background: 'var(--surface-dark)', border: '1px solid var(--border-dark)', padding: 12, borderRadius: 6, zIndex: 10, boxShadow: 'var(--shadow)', minWidth: 160 }}>
                {allColumns.map(col => (
                  <label key={col} style={{ display: 'flex', alignItems: 'center', marginBottom: 8, cursor: 'pointer', color: 'var(--text-primary)' }}>
                    <input 
                      type="checkbox" 
                      checked={!hiddenColumns.includes(col)} 
                      onChange={() => {
                        if (hiddenColumns.includes(col)) {
                          setHiddenColumns(hiddenColumns.filter(c => c !== col));
                        } else {
                          setHiddenColumns([...hiddenColumns, col]);
                        }
                      }} 
                      style={{ marginRight: 8 }} 
                    />
                    {col}
                  </label>
                ))}
              </div>
            )}
          </div>
          
          {/* Export */}
          <button className="btn btn-secondary" onClick={handleExportCSV} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Download size={14} /> Export
          </button>
          
          {/* View Toggles */}
          <div style={{ display: 'flex', border: '1px solid var(--border-dark)', borderRadius: 6, overflow: 'hidden' }}>
            <button 
              onClick={() => setViewMode('list')} 
              style={{ padding: '6px 10px', background: viewMode === 'list' ? 'var(--border-dark)' : 'var(--surface-dark)', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}
              title="List View"
            >
              <List size={16} />
            </button>
            <button 
              onClick={() => setViewMode('grid')} 
              style={{ padding: '6px 10px', background: viewMode === 'grid' ? 'var(--border-dark)' : 'var(--surface-dark)', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}
              title="Grid View"
            >
              <LayoutGrid size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="section-card" style={{ padding: viewMode === 'list' ? 0 : undefined, overflow: 'hidden' }}>
        {loading ? <div style={{ padding: 32, textAlign: 'center' }}><div className="loader" /></div> : (
          <>
            {viewMode === 'grid' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16, padding: 24 }}>
                {filtered.map(p => (
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
                      <span className={`badge ${p.status === 'ongoing' ? 'badge-green' : 'badge-muted'}`} style={{ textTransform: 'capitalize' }}>{p.status}</span>
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

            {viewMode === 'list' && (
              <div style={{ width: '100%', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead style={{ background: 'var(--surface-dark)', borderBottom: '1px solid var(--border-dark)' }}>
                    <tr>
                      {!hiddenColumns.includes('Project Code') && <th style={{ padding: '16px', color: 'var(--text-muted)', fontWeight: 500, fontSize: 13 }}>Project Code</th>}
                      {!hiddenColumns.includes('Project Name') && <th style={{ padding: '16px', color: 'var(--text-muted)', fontWeight: 500, fontSize: 13 }}>Project Name</th>}
                      {!hiddenColumns.includes('Client') && <th style={{ padding: '16px', color: 'var(--text-muted)', fontWeight: 500, fontSize: 13 }}>Client</th>}
                      {!hiddenColumns.includes('Status') && <th style={{ padding: '16px', color: 'var(--text-muted)', fontWeight: 500, fontSize: 13 }}>Status</th>}
                      {!hiddenColumns.includes('Contract Value') && <th style={{ padding: '16px', color: 'var(--text-muted)', fontWeight: 500, fontSize: 13 }}>Contract Value</th>}
                      {!hiddenColumns.includes('Received') && <th style={{ padding: '16px', color: 'var(--text-muted)', fontWeight: 500, fontSize: 13 }}>Received</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(p => (
                      <tr 
                        key={p.project_id} 
                        onClick={() => navigate(`/projects/${p.project_id}`)}
                        style={{ borderBottom: '1px solid var(--border-dark)', cursor: 'pointer', transition: 'background 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        {!hiddenColumns.includes('Project Code') && (
                          <td style={{ padding: '16px' }}>
                            <span className="mono" style={{ fontSize: 12, color: 'var(--amber)', background: 'var(--amber-glow)', padding: '4px 8px', borderRadius: 4 }}>
                              {p.project_code}
                            </span>
                          </td>
                        )}
                        {!hiddenColumns.includes('Project Name') && (
                          <td style={{ padding: '16px', color: 'var(--text-primary)', fontWeight: 500 }}>{p.project_name}</td>
                        )}
                        {!hiddenColumns.includes('Client') && (
                          <td style={{ padding: '16px', color: 'var(--text-muted)', fontSize: 13 }}>{p.client_name}</td>
                        )}
                        {!hiddenColumns.includes('Status') && (
                          <td style={{ padding: '16px' }}>
                            <span className={`badge ${p.status === 'ongoing' ? 'badge-green' : 'badge-muted'}`} style={{ textTransform: 'capitalize' }}>{p.status}</span>
                          </td>
                        )}
                        {!hiddenColumns.includes('Contract Value') && (
                          <td style={{ padding: '16px', color: 'var(--text-primary)' }}>{fmt(p.contract_value)}</td>
                        )}
                        {!hiddenColumns.includes('Received') && (
                          <td style={{ padding: '16px', color: 'var(--green)', fontWeight: 500 }}>{fmt(p.total_received)}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {!loading && filtered.length === 0 && (
          <div className="empty-state" style={{ padding: 48, textAlign: 'center' }}>
            <FolderKanban size={48} style={{ color: 'var(--text-muted)', marginBottom: 16, opacity: 0.5 }} />
            <h3 style={{ color: 'var(--text-primary)', marginBottom: 8 }}>No Projects Found</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>No projects match your current filters.</p>
            {searchTerm || statusFilter !== 'all' ? (
              <button className="btn btn-secondary" onClick={() => { setSearchTerm(''); setStatusFilter('all'); }}>
                Clear Filters
              </button>
            ) : (
              <button className="btn btn-primary" onClick={() => navigate('/projects/new')}>
                <Plus size={14} style={{ marginRight: 6 }} /> Create First Project
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
