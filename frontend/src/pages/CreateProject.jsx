import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { ArrowLeft } from 'lucide-react';

export default function CreateProject() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    project_code: '', project_name: '', project_location: '', client_name: '',
    work_order_number: '', work_order_date: '', contract_value: '',
    start_date: '', end_date: '', status: 'ongoing', description: ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await api.post('/projects', form);
      navigate(`/projects/${res.data.project_id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create project');
    } finally {
      setSaving(false);
    }
  };

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

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

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Work Order Number</label>
              <input className="form-input" value={form.work_order_number} onChange={set('work_order_number')} placeholder="SERC/MSC/23578746" />
            </div>
            <div className="form-group">
              <label className="form-label">Contract Value (₹)</label>
              <input type="number" className="form-input" value={form.contract_value} onChange={set('contract_value')} placeholder="46329919.93" />
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Start Date</label>
              <input type="date" className="form-input" value={form.start_date} onChange={set('start_date')} />
            </div>
            <div className="form-group">
              <label className="form-label">End Date</label>
              <input type="date" className="form-input" value={form.end_date} onChange={set('end_date')} />
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
    </div>
  );
}
