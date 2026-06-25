import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { fmtFull } from '../components/KPICard';
import { Upload, CheckCircle, AlertTriangle, ChevronRight, FileSpreadsheet, X, ListChecks } from 'lucide-react';
import TemplateDownloads from '../components/TemplateDownloads';

const STEPS = ['Select Project', 'Upload File', 'Review & Confirm'];

export default function ImportPage() {
  const navigate = useNavigate();
  const fileRef  = useRef(null);
  const [step, setStep]        = useState(0);
  const [importType, setImportType] = useState('rabill'); // 'rabill' | 'budget'
  const [projects, setProjects]  = useState([]);
  const [contracts, setContracts] = useState([]);
  const [form, setForm] = useState({ project_id: '', contract_id: '' });
  const [file, setFile]        = useState(null);
  const [preview, setPreview]  = useState(null);
  const [filePath, setFilePath] = useState('');
  const [fileName, setFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult]    = useState(null);
  const [drag, setDrag]        = useState(false);

  useEffect(() => {
    api.get('/projects').then(r => setProjects(r.data.data || []));
  }, []);

  useEffect(() => {
    if (form.project_id && importType === 'rabill') {
      api.get(`/projects/${form.project_id}/contracts`).then(r => {
        setContracts(r.data.data || []);
        setForm(f => ({ ...f, contract_id: '' }));
      });
    }
  }, [form.project_id, importType]);

  const handleFileSelect = async (selectedFile) => {
    if (!selectedFile) return;
    if (!selectedFile.name.endsWith('.xlsx')) {
      alert('Only .xlsx files are supported');
      return;
    }
    setFile(selectedFile);
    setUploading(true);

    try {
      const fd = new FormData();
      fd.append('file', selectedFile);
      
      if (importType === 'budget') {
        // Direct import without preview for budget
        fd.append('project_id', form.project_id);
        const res = await api.post('/import/budget', fd, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        setResult(res.data);
      } else {
        // RA Bill preview flow
        const res = await api.post('/import/preview', fd, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        setPreview(res.data.data);
        setFilePath(res.data.file_path);
        setFileName(res.data.file_name);
        setStep(2);
      }
    } catch (e) {
      alert('File upload failed: ' + (e.response?.data?.error || e.message));
    } finally {
      setUploading(false);
    }
  };

  const handleConfirm = async () => {
    setImporting(true);
    try {
      const res = await api.post('/import/ra-bill', {
        project_id:  form.project_id,
        contract_id: form.contract_id,
        file_path:   filePath,
        file_name:   fileName,
      });
      setResult(res.data);
    } catch (e) {
      alert('Import failed: ' + (e.response?.data?.error || e.message));
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setStep(0); setFile(null); setPreview(null); setResult(null);
    setFilePath(''); setFileName('');
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Import Excel</div>
          <div className="page-subtitle">Import Project Budgets or RA Bills to load your data</div>
        </div>
      </div>

      {/* Step Indicator */}
      {!result && (
        <div className="pipeline mb-24" style={{ justifyContent: 'center' }}>
          {STEPS.map((s, i) => {
            // Skip Step 2 for Budget
            if (importType === 'budget' && i === 2) return null;
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center' }}>
                <div className={`pipeline-step ${i < step ? 'done' : i === step ? 'current' : 'pending'}`}>
                  {i < step ? <CheckCircle size={13} /> : <span>{i + 1}</span>}
                  {s}
                </div>
                {i < (importType === 'budget' ? 1 : STEPS.length - 1) && <span className="pipeline-arrow">›</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Step 0: Select Project + Contract ─────────────── */}
      {step === 0 && !result && (
        <div className="section-card" style={{ maxWidth: 600, margin: '0 auto' }}>
          <div className="section-title mb-16"><FileSpreadsheet /> Select Import Destination</div>
          
          <div className="form-group">
            <label className="form-label">Import Type</label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button 
                className={`btn ${importType === 'rabill' ? 'btn-primary' : 'btn-ghost'}`} 
                style={{ flex: 1 }}
                onClick={() => setImportType('rabill')}
              >
                <ListChecks size={14} /> RA Bill & Measurements
              </button>
              <button 
                className={`btn ${importType === 'budget' ? 'btn-primary' : 'btn-ghost'}`} 
                style={{ flex: 1 }}
                onClick={() => setImportType('budget')}
              >
                <FileSpreadsheet size={14} /> Project Budget
              </button>
            </div>
            
            <div style={{ marginTop: 20 }}>
              <TemplateDownloads />
            </div>

            <div style={{ height: 16 }} />
            <label className="form-label">Select Project *</label>
            <select className="form-select" value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}>
              <option value="">Select project...</option>
              {projects.map(p => <option key={p.project_id} value={p.project_id}>{p.project_code} — {p.project_name}</option>)}
            </select>
          </div>
          
          {importType === 'rabill' && (
            <div className="form-group">
              <label className="form-label">Contract</label>
              <select className="form-select" value={form.contract_id} onChange={e => setForm(f => ({ ...f, contract_id: e.target.value }))} disabled={!form.project_id}>
                <option value="">Select contract...</option>
                {contracts.map(c => <option key={c.contract_id} value={c.contract_id}>{c.org_name} — {c.contract_type} (₹{parseFloat(c.contract_value).toLocaleString('en-IN')})</option>)}
              </select>
            </div>
          )}
          
          <button
            className="btn btn-primary"
            disabled={!form.project_id || (importType === 'rabill' && !form.contract_id)}
            onClick={() => setStep(1)}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            Next: Upload File <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* ── Step 1: Upload ─────────────────────────────────── */}
      {step === 1 && !result && (
        <div className="section-card" style={{ maxWidth: 600, margin: '0 auto' }}>
          <div className="section-title mb-16"><Upload /> Upload {importType === 'budget' ? 'Budget' : 'RA Bill'} Excel</div>
          <div
            className={`upload-zone ${drag ? 'drag-over' : ''}`}
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => {
              e.preventDefault(); setDrag(false);
              const f = e.dataTransfer.files[0];
              if (f) handleFileSelect(f);
            }}
          >
            <input ref={fileRef} type="file" accept=".xlsx" style={{ display: 'none' }}
              onChange={e => handleFileSelect(e.target.files[0])} />
            <FileSpreadsheet size={40} style={{ margin: '0 auto 12px', display: 'block', color: 'var(--amber)' }} />
            <div className="upload-title">Drop your Excel file here or click to browse</div>
            <div className="upload-sub">Supports .xlsx files up to 50MB</div>
            {uploading && (
              <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--amber)' }}>
                <div className="loader" style={{ width: 18, height: 18, borderWidth: 2 }} />
                {importType === 'budget' ? 'Importing Budget...' : 'Parsing Excel file...'}
              </div>
            )}
          </div>
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={() => setStep(0)} disabled={uploading}>
            ← Back
          </button>
        </div>
      )}

      {/* ── Step 2: Preview & Confirm (RA Bills only) ──────── */}
      {step === 2 && preview && !result && importType === 'rabill' && (
        <div className="section-card" style={{ maxWidth: 800, margin: '0 auto' }}>
          <div className="section-title mb-16"><CheckCircle color="var(--green)" /> File Parsed — Review &amp; Confirm</div>

          {/* Detected info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'RA Bill No.', value: `RA-${String(preview.detected_ra_number || '?').padStart(2,'0')}`, color: 'var(--amber)' },
              { label: 'Contractor', value: preview.detected_contractor || '—' },
              { label: 'Client', value: preview.detected_client || '—' },
              { label: 'Bill Period', value: preview.bill_period || '—' },
              { label: 'Total Sheets', value: preview.total_sheets },
              { label: 'BOQ Items', value: preview.boq_total || 0 },
              { label: 'Measurement Sheets', value: preview.measurement_sheets || 0 },
              { label: 'Non-BOQ Sheets', value: preview.non_boq_sheets || 0 },
            ].map(d => (
              <div key={d.label} style={{ padding: '10px 14px', background: 'var(--surface-dark)', borderRadius: 'var(--radius)' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{d.label}</div>
                <div style={{ fontWeight: 600, color: d.color || 'var(--text-primary)' }}>{d.value}</div>
              </div>
            ))}
          </div>

          {/* Financial Summary */}
          {preview.financial_summary && (
            <div style={{ marginBottom: 20, padding: 16, background: 'var(--amber-glow)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 'var(--radius)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--amber)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
                Abstract Sheet Financial Summary
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                  { label: 'Basic (This Bill)', value: fmtFull(preview.financial_summary.basic_amount_this_bill) },
                  { label: 'Gross Amount', value: fmtFull(preview.financial_summary.gross_amount) },
                  { label: 'Net Payable', value: fmtFull(preview.financial_summary.net_payable), color: 'var(--green)' },
                ].map(d => (
                  <div key={d.label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{d.label}</div>
                    <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: 14, fontWeight: 700, color: d.color || 'var(--text-primary)' }}>{d.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warnings */}
          {preview.warnings?.length > 0 && (
            <div style={{ marginBottom: 16, padding: 12, background: 'var(--amber-glow)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 'var(--radius)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, color: 'var(--amber)' }}>
                <AlertTriangle size={14} /> {preview.warnings.length} Warning(s)
              </div>
              {preview.warnings.slice(0, 3).map((w, i) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>• {w}</div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-ghost" onClick={() => setStep(1)}>← Re-upload</button>
            <button
              className="btn btn-primary"
              onClick={handleConfirm}
              disabled={importing}
              style={{ flex: 1, justifyContent: 'center' }}
            >
              {importing ? (
                <><div className="loader" style={{ width: 16, height: 16, borderWidth: 2 }} /> Importing...</>
              ) : 'Confirm Import'}
            </button>
          </div>
        </div>
      )}

      {/* ── Result ─────────────────────────────────────────── */}
      {result && (
        <div className="section-card" style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ marginBottom: 20 }}>
            <CheckCircle size={48} color="var(--green)" style={{ margin: '0 auto 12px' }} />
            <div className="page-title">Import Successful!</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: importType === 'budget' ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
            {importType === 'budget' ? (
              <>
                <div style={{ padding: 14, background: 'var(--surface-dark)', borderRadius: 'var(--radius)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Total Budgeted</div>
                  <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: 20, fontWeight: 700, color: 'var(--blue)' }}>{fmtFull(result.summary?.totals?.total_budgeted)}</div>
                </div>
                <div style={{ padding: 14, background: 'var(--surface-dark)', borderRadius: 'var(--radius)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Items Imported</div>
                  <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: 20, fontWeight: 700, color: 'var(--green)' }}>{result.summary?.items?.length || 0}</div>
                </div>
              </>
            ) : (
              [
                { label: 'RA Bill Created', value: result.ra_bill?.ra_number ? `RA-${String(result.ra_bill.ra_number).padStart(2,'0')}` : '—', color: 'var(--amber)' },
                { label: 'BOQ Items', value: result.stats?.boq_items_processed || 0 },
                { label: 'Measurements', value: result.stats?.measurements_processed || 0 },
              ].map(d => (
                <div key={d.label} style={{ padding: 14, background: 'var(--surface-dark)', borderRadius: 'var(--radius)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>{d.label}</div>
                  <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: 20, fontWeight: 700, color: d.color || 'var(--green)' }}>{d.value}</div>
                </div>
              ))
            )}
          </div>

          {result.stats?.errors?.length > 0 && (
            <div style={{ textAlign: 'left', padding: 12, background: 'var(--red-glow)', borderRadius: 'var(--radius)', marginBottom: 16 }}>
              <div style={{ color: 'var(--red)', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                <AlertTriangle size={13} style={{ marginRight: 6 }} />
                {result.stats.errors.length} errors during import
              </div>
              {result.stats.errors.slice(0, 3).map((e, i) => (
                <div key={i} style={{ fontSize: 11, color: 'var(--text-muted)' }}>• {e}</div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="btn btn-ghost" onClick={reset}>Import Another</button>
            <button className="btn btn-primary" onClick={() => navigate(importType === 'budget' ? `/projects/${form.project_id}/budget` : `/projects/${form.project_id}`)}>
              {importType === 'budget' ? 'View Budget Details' : 'View Project Dashboard'} <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
