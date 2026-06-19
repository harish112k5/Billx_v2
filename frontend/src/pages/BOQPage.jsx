import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import BOQTable from '../components/BOQTable';
import { fmtFull, fmtNum } from '../components/KPICard';
import { Search, X, Filter, Activity, Ruler } from 'lucide-react';

const FILTER_TABS = [
  { key: 'all',         label: 'All' },
  { key: 'In Progress', label: 'In Progress' },
  { key: 'Completed',   label: 'Completed' },
  { key: 'Not Started', label: 'Not Started' },
  { key: 'Exceeded BOQ', label: 'Exceeded BOQ' },
];

export default function BOQPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState('all');
  const [search, setSearch]   = useState('');
  const [selected, setSelected] = useState(null);
  const [measurements, setMeasurements] = useState([]);
  const [measLoading, setMeasLoading]   = useState(false);

  const [summary, setSummary] = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/projects/${id}/boq`),
      api.get(`/projects/${id}/boq/summary`),
    ]).then(([boqRes, sumRes]) => {
      setItems(boqRes.data.data || []);
      setSummary(sumRes.data.data);
    }).finally(() => setLoading(false));
  }, [id]);

  const filtered = items.filter(item => {
    const matchStatus = filter === 'all' || item.status === filter;
    const matchSearch = !search || 
      item.item_code?.toLowerCase().includes(search.toLowerCase()) ||
      item.description?.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const handleRowClick = async (item) => {
    setSelected(item);
    setMeasLoading(true);
    try {
      const res = await api.get(`/projects/${id}/boq/${item.boq_id}/measurements`);
      setMeasurements(res.data.data || []);
    } catch (e) {
      setMeasurements([]);
    } finally {
      setMeasLoading(false);
    }
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Bill of Quantities (BOQ)</div>
          <div className="page-subtitle">
            {summary ? `${summary.total_items} items · ${summary.avg_completion_percent?.toFixed(1)}% avg completion` : ''}
          </div>
        </div>
      </div>

      {/* Summary KPIs */}
      {summary && (
        <div className="kpi-grid kpi-grid-4 mb-16">
          <div className="kpi-card green">
            <div className="kpi-label">Completed</div>
            <div className="kpi-value green">{summary.completed || 0}</div>
            <div className="kpi-sub">100% done</div>
          </div>
          <div className="kpi-card amber">
            <div className="kpi-label">In Progress</div>
            <div className="kpi-value amber">{summary.in_progress || 0}</div>
            <div className="kpi-sub">Partially executed</div>
          </div>
          <div className="kpi-card blue">
            <div className="kpi-label">Not Started</div>
            <div className="kpi-value blue">{summary.not_started || 0}</div>
            <div className="kpi-sub">0% progress</div>
          </div>
          <div className="kpi-card red">
            <div className="kpi-label">Exceeded BOQ</div>
            <div className="kpi-value red">{summary.exceeded_boq || 0}</div>
            <div className="kpi-sub">&gt;100% — flag amber</div>
          </div>
        </div>
      )}

      <div className="section-card">
        {/* Filter Tabs */}
        <div className="tab-list">
          {FILTER_TABS.map(t => (
            <button
              key={t.key}
              className={`tab-btn ${filter === t.key ? 'active' : ''}`}
              onClick={() => setFilter(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="form-input"
            style={{ paddingLeft: 34 }}
            placeholder="Search by item code or description..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{
              position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', color: 'var(--text-muted)', padding: 0
            }}>
              <X size={14} />
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ padding: 32, textAlign: 'center' }}><div className="loader" /></div>
        ) : (
          <BOQTable items={filtered} onRowClick={handleRowClick} />
        )}

        {!loading && filtered.length === 0 && items.length > 0 && (
          <div className="empty-state">
            <Filter />
            <h3>No items match your filter</h3>
            <p>Try adjusting the status filter or search term</p>
          </div>
        )}
      </div>

      {/* ── Measurement Detail Modal ───────────────────────── */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 900 }}>
            <div className="modal-header">
              <div>
                <div className="modal-title">
                  <span className="mono" style={{ color: 'var(--amber)', marginRight: 8 }}>{selected.item_code}</span>
                  Measurement Details
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  {selected.description}
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>
                <X size={14} />
              </button>
            </div>

            {/* Item Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
              {[
                { label: 'BOQ Qty', value: fmtNum(selected.planned_quantity, 3) + ' ' + selected.unit },
                { label: 'Executed Qty', value: fmtNum(selected.executed_quantity, 3) + ' ' + selected.unit, color: 'var(--green)' },
                { label: 'Completion', value: (parseFloat(selected.completion_percent)||0).toFixed(1) + '%', color: 'var(--amber)' },
                { label: 'Status', value: selected.status },
              ].map(s => (
                <div key={s.label} style={{
                  padding: '10px 14px', background: 'var(--surface-dark)',
                  borderRadius: 'var(--radius)', textAlign: 'center'
                }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>{s.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: s.color || 'var(--text-primary)' }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Measurements table */}
            {measLoading ? (
              <div style={{ padding: 24, textAlign: 'center' }}><div className="loader" /></div>
            ) : measurements.length > 0 ? (
              <div style={{ overflowX: 'auto', maxHeight: 360, overflowY: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>S.No</th><th>Date</th><th>RFI No</th><th>Description</th>
                      <th>From</th><th>To</th><th>Side</th>
                      <th>Nos</th><th>L</th><th>B</th><th>D</th>
                      <th>Qty</th><th>IPC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {measurements.map((m, i) => (
                      <tr key={m.measurement_id || i}>
                        <td className="mono">{m.serial_no}</td>
                        <td style={{ fontSize: 11 }}>{m.measurement_date || '—'}</td>
                        <td className="mono" style={{ fontSize: 11 }}>{m.rfi_number || '—'}</td>
                        <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.description}</td>
                        <td className="mono">{m.location_from || '—'}</td>
                        <td className="mono">{m.location_to || '—'}</td>
                        <td>{m.side || '—'}</td>
                        <td className="mono">{m.nos || '—'}</td>
                        <td className="mono">{m.length || '—'}</td>
                        <td className="mono">{m.breadth || '—'}</td>
                        <td className="mono">{m.depth || '—'}</td>
                        <td className="mono" style={{ color: 'var(--green)', fontWeight: 600 }}>
                          {fmtNum(m.quantity, 4)}
                        </td>
                        <td><span className="badge badge-blue">IPC-{m.ipc_number}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '24px' }}>
                <Ruler />
                <h3>No measurement records</h3>
                <p>Import an RA Bill Excel to load measurement data</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
