import { useEffect, useState } from 'react';
import api from '../api/axios';
import { Building2, Plus, X } from 'lucide-react';

export default function OrganizationsPage() {
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ org_name: '', org_type: 'main_contractor', pan_number: '', gst_number: '', contact_person: '', contact_phone: '', contact_email: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    api.get('/organizations').then(r => setOrgs(r.data.data || [])).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleAdd = async () => {
    setSaving(true);
    try {
      await api.post('/organizations', form);
      setShowAdd(false);
      load();
    } finally { setSaving(false); }
  };

  const typeColor = { main_contractor: 'badge-amber', subcontractor: 'badge-blue', owner: 'badge-green', consultant: 'badge-purple' };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div className="page-title">Organizations</div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus size={14} /> Add Organization</button>
      </div>

      <div className="section-card">
        {loading ? <div style={{ padding: 32, textAlign: 'center' }}><div className="loader" /></div> : (
          <table className="data-table">
            <thead><tr>
              <th>Organization</th><th>Type</th><th>GST Number</th><th>Contact Person</th><th>Phone</th><th>Email</th>
            </tr></thead>
            <tbody>
              {orgs.map(o => (
                <tr key={o.organization_id}>
                  <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{o.org_name}</td>
                  <td><span className={`badge ${typeColor[o.org_type] || 'badge-muted'}`}>{o.org_type?.replace('_', ' ')}</span></td>
                  <td className="mono" style={{ fontSize: 12 }}>{o.gst_number || '—'}</td>
                  <td>{o.contact_person || '—'}</td>
                  <td>{o.contact_phone || '—'}</td>
                  <td style={{ fontSize: 12 }}>{o.contact_email || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Add Organization</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAdd(false)}><X size={14} /></button>
            </div>
            <div className="form-group">
              <label className="form-label">Organization Name *</label>
              <input className="form-input" value={form.org_name} onChange={e => setForm(f => ({ ...f, org_name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Type</label>
              <select className="form-select" value={form.org_type} onChange={e => setForm(f => ({ ...f, org_type: e.target.value }))}>
                <option value="main_contractor">Main Contractor</option>
                <option value="subcontractor">Subcontractor</option>
                <option value="owner">Owner</option>
                <option value="consultant">Consultant</option>
              </select>
            </div>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">PAN</label><input className="form-input" value={form.pan_number} onChange={e => setForm(f => ({ ...f, pan_number: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">GST</label><input className="form-input" value={form.gst_number} onChange={e => setForm(f => ({ ...f, gst_number: e.target.value }))} /></div>
            </div>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">Contact Person</label><input className="form-input" value={form.contact_person} onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} /></div>
            </div>
            <div className="form-group"><label className="form-label">Email</label><input className="form-input" value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} /></div>
            <button className="btn btn-primary" onClick={handleAdd} disabled={saving} style={{ width: '100%', justifyContent: 'center' }}>
              {saving ? 'Saving...' : 'Add Organization'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
