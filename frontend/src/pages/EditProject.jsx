import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/axios';
import { ArrowLeft, Plus, Pencil } from 'lucide-react';
import OrganizationModal from '../components/OrganizationModal';

export default function EditProject() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    project_code: '', project_name: '', project_location: '', client_name: '',
    work_order_number: '', work_order_date: '', contract_value: '',
    start_date: '', end_date: '', status: 'ongoing', description: '', 
    contractor_id: '', subcontractor_id: ''
  });
  const [organizations, setOrganizations] = useState([]);
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [editingOrg, setEditingOrg] = useState(null);
  const [editingTarget, setEditingTarget] = useState('main');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/organizations'),
      api.get(`/projects/${id}`)
    ]).then(([orgRes, projRes]) => {
      setOrganizations(orgRes.data.data || []);
      const p = projRes.data.data;
      
      let contractor_id = '';
      let subcontractor_id = '';
      if (p.contracts && p.contracts.length > 0) {
        const mainContract = p.contracts.find(c => c.contract_type === 'main');
        if (mainContract) contractor_id = mainContract.organization_id;
        
        const subContract = p.contracts.find(c => c.contract_type === 'subcontract');
        if (subContract) subcontractor_id = subContract.organization_id;
      }

      setForm({
        project_code: p.project_code || '',
        project_name: p.project_name || '',
        project_location: p.project_location || '',
        client_name: p.client_name || '',
        work_order_number: p.work_order_number || '',
        work_order_date: p.work_order_date ? p.work_order_date.split('T')[0] : '',
        contract_value: p.contract_value || '',
        start_date: p.start_date ? p.start_date.split('T')[0] : '',
        end_date: p.end_date ? p.end_date.split('T')[0] : '',
        status: p.status || 'ongoing',
        description: p.description || '',
        contractor_id,
        subcontractor_id
      });
    }).catch(err => {
      setError('Failed to load project details');
    }).finally(() => {
      setLoading(false);
    });
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.put(`/projects/${id}`, form);
      navigate(`/projects/${id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update project');
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
      setForm(f => ({ ...f, subcontractor_id: org.organization_id }));
    }
  };

  if (loading) return <div style={{ padding: 32, textAlign: 'center' }}><div className="loader" /></div>;

  return (
    <div className="fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/projects/${id}`)}>
            <ArrowLeft size={14} /> Back
          </button>
          <div className="page-title">Edit Project</div>
        </div>
      </div>

      <div className="section-card" style={{ maxWidth: 700 }}>
        <form onSubmit={handleSubmit}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Project Code (Read-Only)</label>
              <input className="form-input" value={form.project_code} disabled />
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
            <input className="form-input" value={form.project_name} onChange={set('project_name')} required />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Client Name</label>
              <input className="form-input" value={form.client_name} onChange={set('client_name')} />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Main Contractor</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {form.contractor_id && (
                    <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '0 4px', height: 20 }} onClick={() => {
                      setEditingTarget('main');
                      setEditingOrg(organizations.find(o => o.organization_id === form.contractor_id));
                      setShowOrgModal(true);
                    }}>
                      <Pencil size={12} />
                    </button>
                  )}
                  <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '0 4px', height: 20 }} onClick={() => {
                    setEditingTarget('main');
                    setEditingOrg(null);
                    setShowOrgModal(true);
                  }}>
                    <Plus size={12} />
                  </button>
                </div>
              </label>
              <select className="form-select" value={form.contractor_id} onChange={set('contractor_id')}>
                <option value="">Select Main Contractor...</option>
                {organizations.map(org => (
                  <option key={org.organization_id} value={org.organization_id}>
                    {org.org_name} ({org.org_type.replace('_', ' ')})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Project Location</label>
              <input className="form-input" value={form.project_location} onChange={set('project_location')} />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Subcontractor</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {form.subcontractor_id && (
                    <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '0 4px', height: 20 }} onClick={() => {
                      setEditingTarget('sub');
                      setEditingOrg(organizations.find(o => o.organization_id === form.subcontractor_id));
                      setShowOrgModal(true);
                    }}>
                      <Pencil size={12} />
                    </button>
                  )}
                  <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '0 4px', height: 20 }} onClick={() => {
                    setEditingTarget('sub');
                    setEditingOrg(null);
                    setShowOrgModal(true);
                  }}>
                    <Plus size={12} />
                  </button>
                </div>
              </label>
              <select className="form-select" value={form.subcontractor_id} onChange={set('subcontractor_id')}>
                <option value="">Select Subcontractor...</option>
                {organizations.map(org => (
                  <option key={org.organization_id} value={org.organization_id}>
                    {org.org_name} ({org.org_type.replace('_', ' ')})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Work Order Number</label>
              <input className="form-input" value={form.work_order_number} onChange={set('work_order_number')} />
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Contract Value (₹)</label>
              <input type="number" className="form-input" value={form.contract_value} onChange={set('contract_value')} />
            </div>
            <div className="form-group">
              <label className="form-label">Start Date</label>
              <input type="date" className="form-input" value={form.start_date} onChange={set('start_date')} />
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">End Date</label>
              <input type="date" className="form-input" value={form.end_date} onChange={set('end_date')} />
            </div>
            <div className="form-group">
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-textarea" value={form.description} onChange={set('description')} />
          </div>

          {error && (
            <div style={{ padding: '10px 14px', background: 'var(--red-glow)', color: 'var(--red)', borderRadius: 'var(--radius)', marginBottom: 16, fontSize: 13 }}>
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={saving} style={{ width: '100%', justifyContent: 'center' }}>
            {saving ? 'Saving...' : 'Save Changes'}
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
