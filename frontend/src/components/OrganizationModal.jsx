import { useState, useEffect } from 'react';
import api from '../api/axios';
import { X } from 'lucide-react';

export default function OrganizationModal({ show, onClose, onSaved, organization = null }) {
  const [form, setForm] = useState({
    org_name: '', org_type: 'main_contractor', pan_number: '', gst_number: '', 
    contact_person: '', contact_phone: '', contact_email: ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (show && organization) {
      setForm({
        org_name: organization.org_name || '',
        org_type: organization.org_type || 'main_contractor',
        pan_number: organization.pan_number || '',
        gst_number: organization.gst_number || '',
        contact_person: organization.contact_person || '',
        contact_phone: organization.contact_phone || '',
        contact_email: organization.contact_email || ''
      });
      setError('');
    } else if (show) {
      setForm({
        org_name: '', org_type: 'main_contractor', pan_number: '', gst_number: '', 
        contact_person: '', contact_phone: '', contact_email: ''
      });
      setError('');
    }
  }, [show, organization]);

  if (!show) return null;

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (organization?.organization_id) {
        await api.put(`/organizations/${organization.organization_id}`, form);
        onSaved({ ...organization, ...form });
      } else {
        const res = await api.post('/organizations', form);
        onSaved({ organization_id: res.data.organization_id, ...form });
      }
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save organization');
    } finally {
      setSaving(false);
    }
  };

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            {organization ? 'Edit Contractor' : 'Add Contractor'}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="form-group">
          <label className="form-label">Organization Name *</label>
          <input className="form-input" value={form.org_name} onChange={set('org_name')} required />
        </div>
        <div className="form-group">
          <label className="form-label">Type</label>
          <select className="form-select" value={form.org_type} onChange={set('org_type')}>
            <option value="main_contractor">Main Contractor</option>
            <option value="subcontractor">Subcontractor</option>
            <option value="owner">Owner</option>
            <option value="consultant">Consultant</option>
          </select>
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">PAN</label>
            <input className="form-input" value={form.pan_number} onChange={set('pan_number')} />
          </div>
          <div className="form-group">
            <label className="form-label">GST</label>
            <input className="form-input" value={form.gst_number} onChange={set('gst_number')} />
          </div>
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Contact Person</label>
            <input className="form-input" value={form.contact_person} onChange={set('contact_person')} />
          </div>
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input className="form-input" value={form.contact_phone} onChange={set('contact_phone')} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Email</label>
          <input className="form-input" value={form.contact_email} onChange={set('contact_email')} type="email" />
        </div>
        
        {error && (
          <div style={{ padding: '10px 14px', background: 'var(--red-glow)', color: 'var(--red)', borderRadius: 'var(--radius)', marginBottom: 16, fontSize: 13 }}>
            {error}
          </div>
        )}

        <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving || !form.org_name} style={{ width: '100%', justifyContent: 'center' }}>
          {saving ? 'Saving...' : (organization ? 'Save Changes' : 'Add Organization')}
        </button>
      </div>
    </div>
  );
}
