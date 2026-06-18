import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import api from '../api/axios';
import { Lock, Mail, Eye, EyeOff, HardHat } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: 'admin@billx.com', password: 'password' });
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/login', form);
      if (res.data.success) {
        login(res.data.user, res.data.token);
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Logo */}
        <div className="login-logo">
          <div style={{
            width: 56, height: 56, borderRadius: 16, margin: '0 auto 16px',
            background: 'linear-gradient(135deg, var(--amber), #E68900)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <HardHat size={28} color="#000" />
          </div>
          <div className="logo-text" style={{ fontSize: 28 }}>BillX V2</div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            Construction Intelligence Platform
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="email"
                className="form-input"
                style={{ paddingLeft: 36 }}
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="admin@billx.com"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type={showPwd ? 'text' : 'password'}
                className="form-input"
                style={{ paddingLeft: 36, paddingRight: 40 }}
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="••••••••"
                required
              />
              <button type="button" onClick={() => setShowPwd(!showPwd)} style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: 'var(--text-muted)', padding: 0
              }}>
                {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: 'var(--radius)',
              background: 'var(--red-glow)', color: 'var(--red)',
              fontSize: 13, marginBottom: 16
            }}>
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
            {loading ? <span className="loader" style={{ width: 16, height: 16, borderWidth: 2 }} /> : 'Sign In'}
          </button>
        </form>

        {/* Demo credentials */}
        <div style={{
          marginTop: 20, padding: '12px', borderRadius: 'var(--radius)',
          background: 'var(--surface-dark)', border: '1px solid var(--border-dark)'
        }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
            Demo Credentials
          </div>
          {[
            { role: 'Super Admin', email: 'admin@billx.com' },
            { role: 'Manager', email: 'manager@billx.com' },
            { role: 'Engineer', email: 'engineer@billx.com' },
          ].map(d => (
            <div
              key={d.email}
              onClick={() => setForm({ email: d.email, password: 'password' })}
              style={{
                fontSize: 12, color: 'var(--text-secondary)',
                cursor: 'pointer', padding: '3px 0',
                display: 'flex', justifyContent: 'space-between'
              }}
            >
              <span style={{ color: 'var(--amber)' }}>{d.role}</span>
              <span className="mono">{d.email}</span>
            </div>
          ))}
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
            Password for all: <span className="mono" style={{ color: 'var(--text-secondary)' }}>password</span>
          </div>
        </div>
      </div>
    </div>
  );
}
