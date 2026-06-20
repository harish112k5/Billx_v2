import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { ArrowLeft, Plus, Pencil, Trash2, Users } from 'lucide-react';
import OrganizationModal from '../components/OrganizationModal';

export default function CreateProject() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    project_code: '', project_name: '', project_location: '', client_name: '',
    work_order_number: '', work_order_date: '', contract_value: '',
    start_date: '', end_date: '', status: 'ongoing', description: '', 
    contractor_id: ''
  });
  const [subcontractorIds, setSubcontractorIds] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [editingOrg, setEditingOrg] = useState(null);
  const [editingTarget, setEditingTarget] = useState('main'); // 'main' | 'sub'
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  useEffect(() => {
    api.get('/organizations').then(res => setOrganizations(res.data.data || []));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, subcontractor_ids: subcontractorIds.filter(Boolean) };
      const res = await api.post('/projects', payload);
      navigate(`/projects/${res.data.project_id}/budget`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create project');
    } finally {
      setSaving(false);
    }
  };

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleOrgSaved = (org) => {
    setOrganizations(prev => {
      const exists = prev.find(o => o.organization_id === org.organization_id);
      if (exists) return prev.map(o => o.organization_id === org.organization_id ? org : o);
      return [...prev, org].sort((a,b) => a.org_name.localeCompare(b.org_name));
    });
    if (editingTarget === 'main') {
      setForm(f => ({ ...f, contractor_id: org.organization_id }));
    } else {
      // Add to sub list if not already there
      setSubcontractorIds(prev => prev.includes(org.organization_id) ? prev : [...prev, org.organization_id]);
    }
  };

  const addSubcontractor = () => {
    setSubcontractorIds(prev => [...prev, '']);
  };

  const updateSub = (idx, value) => {
    setSubcontractorIds(prev => prev.map((v, i) => i === idx ? value : v));
  };

  const removeSub = (idx) => {
    setSubcontractorIds(prev => prev.filter((_, i) => i !== idx));
  };

  // Get org name helper
  const getOrgName = (orgId) => {
    const org = organizations.find(o => o.organization_id === orgId);
    return org ? org.org_name : '';
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/projects')}>
            <ArrowLeft size={14} /> Back
          </button>
          <div className="page-title">New Project</div>
        </div>
      </div>

      <div className="section-card" style={{ maxWidth: 700 }}>
        <form onSubmit={handleSubmit}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Project Code *</label>
              <input className="form-input" value={form.project_code} onChange={set('project_code')} placeholder="TKTR-NIP-001" required />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" value={form.status} onChange={set('status')}>
                <option value="planned">Planned</option>
                <option value="ongoing">Ongoing</option>
                <option value="on_hold">On Hold</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Project Name *</label>
            <input className="form-input" value={form.project_name} onChange={set('project_name')} placeholder="Construction of Loop Road @ ..." required />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Client Name</label>
              <input className="form-input" value={form.client_name} onChange={set('client_name')} placeholder="TK Toll Road Pvt Ltd" />
            </div>
            <div className="form-group">
              <label className="form-label">Project Location</label>
              <input className="form-input" value={form.project_location} onChange={set('project_location')} placeholder="BHS Bypass, Tamil Nadu" />
            </div>
          </div>

          {/* ── Main Contractor ── */}
          <div style={{ border: '1px solid var(--border-dark)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--amber)', textTransform: 'uppercase', letterSpacing: 1 }}>
                Main Contractor
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {form.contractor_id && (
                  <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '2px 6px', height: 24 }} onClick={() => {
                    setEditingTarget('main');
                    setEditingOrg(organizations.find(o => o.organization_id === form.contractor_id));
                    setShowOrgModal(true);
                  }}>
                    <Pencil size={12} />
                  </button>
                )}
                <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '2px 6px', height: 24 }} onClick={() => {
                  setEditingTarget('main');
                  setEditingOrg(null);
                  setShowOrgModal(true);
                }}>
                  <Plus size={12} /> New
                </button>
              </div>
            </div>
            <select className="form-select" value={form.contractor_id} onChange={set('contractor_id')}>
              <option value="">Select Main Contractor...</option>
              {organizations.map(org => (
                <option key={org.organization_id} value={org.organization_id}>
                  {org.org_name} ({org.org_type.replace('_', ' ')})
                </option>
              ))}
            </select>
          </div>

          {/* ── Subcontractors (multiple) ── */}
          <div style={{ border: '1px solid var(--border-dark)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: 1 }}>
                  Subcontractors
                </div>
                {subcontractorIds.length > 0 && (
                  <span className="badge badge-blue" style={{ fontSize: 10 }}>{subcontractorIds.filter(Boolean).length}</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '2px 6px', height: 24 }} onClick={() => {
                  setEditingTarget('sub');
                  setEditingOrg(null);
                  setShowOrgModal(true);
                }}>
                  <Plus size={12} /> New Org
                </button>
                <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '2px 6px', height: 24, color: 'var(--blue)', borderColor: 'var(--blue)' }} onClick={addSubcontractor}>
                  <Plus size={12} /> Add Sub
                </button>
              </div>
            </div>

            {subcontractorIds.length === 0 ? (
              <div style={{ padding: '16px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, background: 'var(--surface-dark)', borderRadius: 8 }}>
                <Users size={20} style={{ margin: '0 auto 6px', display: 'block', opacity: 0.4 }} />
                No subcontractors added. Click "+ Add Sub" to add.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {subcontractorIds.map((subId, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--blue-glow)', color: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                      {idx + 1}
                    </div>
                    <select className="form-select" style={{ flex: 1, marginBottom: 0 }} value={subId} onChange={e => updateSub(idx, e.target.value)}>
                      <option value="">Select Subcontractor...</option>
                      {organizations.map(org => (
                        <option key={org.organization_id} value={org.organization_id}>
                          {org.org_name} ({org.org_type.replace('_', ' ')})
                        </option>
                      ))}
                    </select>
                    {subId && (
                      <button type="button" style={{ padding: 4, background: 'none', border: '1px solid var(--border-dark)', borderRadius: 4, cursor: 'pointer', color: 'var(--blue)' }}
                        onClick={() => {
                          setEditingTarget('sub');
                          setEditingOrg(organizations.find(o => o.organization_id === subId));
                          setShowOrgModal(true);
                        }} title="Edit">
                        <Pencil size={12} />
                      </button>
                    )}
                    <button type="button" style={{ padding: 4, background: 'none', border: '1px solid var(--border-dark)', borderRadius: 4, cursor: 'pointer', color: 'var(--red)' }}
                      onClick={() => removeSub(idx)} title="Remove">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Work Order Number</label>
              <input className="form-input" value={form.work_order_number} onChange={set('work_order_number')} placeholder="SERC/MSC/23578746" />
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Contract Value (₹)</label>
              <input type="number" className="form-input" value={form.contract_value} onChange={set('contract_value')} placeholder="46329919.93" />
            </div>
            <div className="form-group">
              <label className="form-label">Start Date</label>
              <input type="date" className="form-input" value={form.start_date?.split('T')[0] || ''} onChange={set('start_date')} />
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">End Date</label>
              <input type="date" className="form-input" value={form.end_date?.split('T')[0] || ''} onChange={set('end_date')} />
            </div>
            <div className="form-group">
              {/* Empty space */}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-textarea" value={form.description} onChange={set('description')} placeholder="Brief project description..." />
          </div>

          {error && (
            <div style={{ padding: '10px 14px', background: 'var(--red-glow)', color: 'var(--red)', borderRadius: 'var(--radius)', marginBottom: 16, fontSize: 13 }}>
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={saving} style={{ width: '100%', justifyContent: 'center' }}>
            {saving ? 'Creating...' : 'Create Project'}
          </button>
        </form>
      </div>
      <OrganizationModal 
        show={showOrgModal} 
        onClose={() => setShowOrgModal(false)} 
        organization={editingOrg} 
        onSaved={handleOrgSaved} 
      />
    </div>
  );
}
