import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/axios';
import { fmtFull } from '../components/KPICard';
import {
  Clock, Upload, Pencil, CreditCard, ArrowRightLeft,
  FileSpreadsheet, Ruler, Filter, ChevronLeft, Activity
} from 'lucide-react';

const EVENT_ICONS = {
  excel_import: Upload,
  manual_boq_entry: Pencil,
  manual_ra_bill: FileSpreadsheet,
  manual_measurement: Ruler,
  manual_expense: CreditCard,
  payment_recorded: CreditCard,
  stage_changed: ArrowRightLeft,
  boq_updated: Pencil,
  measurement_added: Ruler,
};

const EVENT_LABELS = {
  excel_import: 'Excel Import',
  manual_boq_entry: 'Manual BOQ Entry',
  manual_ra_bill: 'Manual RA Bill',
  manual_measurement: 'Manual Measurement',
  manual_expense: 'Expense Added',
  payment_recorded: 'Payment Recorded',
  stage_changed: 'Stage Changed',
  boq_updated: 'BOQ Updated',
  measurement_added: 'Measurement Added',
};

const MODULE_LABELS = {
  boq: 'BOQ',
  ra_bill: 'RA Bill',
  measurements: 'Measurements',
  expenses: 'Expenses',
  payments: 'Payments',
  analytics: 'Analytics',
};

const MODULE_COLORS = {
  boq: 'var(--blue)',
  ra_bill: 'var(--amber)',
  measurements: 'var(--teal)',
  expenses: 'var(--red)',
  payments: 'var(--green)',
  analytics: 'var(--purple)',
};

function formatDateIST(dateStr) {
  if (!dateStr) return 'Date not recorded';
  try {
    return new Date(dateStr).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function formatDateGroup(dateStr) {
  if (!dateStr) return 'Unknown Date';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now - d) / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return d.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export default function ProjectHistoryPage() {
  const { id } = useParams();
  const [events, setEvents] = useState([]);
  const [moduleSummary, setModuleSummary] = useState({});
  const [projectInfo, setProjectInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterModule, setFilterModule] = useState('all');
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/projects/${id}/data-frequency`),
      api.get(`/projects/${id}/dashboard`).catch(() => ({ data: { data: null } })),
    ]).then(([freqRes, dashRes]) => {
      const freq = freqRes.data.data;
      setEvents(freq?.events || []);
      setModuleSummary(freq?.module_summary || {});
      if (dashRes.data.data) {
        setProjectInfo(dashRes.data.data.project);
      }
    }).catch(() => {
      setEvents([]);
    }).finally(() => setLoading(false));
  }, [id]);

  // Filter events
  const filtered = events.filter(e => {
    if (filterModule !== 'all' && e.affected_module !== filterModule) return false;
    if (filterType !== 'all' && e.event_type !== filterType) return false;
    return true;
  });

  // Group events by date
  const grouped = {};
  filtered.forEach(e => {
    const dateKey = e.performed_at ? new Date(e.performed_at).toDateString() : 'unknown';
    if (!grouped[dateKey]) grouped[dateKey] = { label: formatDateGroup(e.performed_at), events: [] };
    grouped[dateKey].events.push(e);
  });

  // Get unique event types for filter
  const uniqueTypes = [...new Set(events.map(e => e.event_type))];
  const uniqueModules = [...new Set(events.map(e => e.affected_module))];

  // Stats
  const totalEvents = events.length;
  const lastEvent = events[0];

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div className="loader" style={{ width: 40, height: 40 }} />
    </div>
  );

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Link to={`/projects/${id}`} className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }}>
              <ChevronLeft size={14} /> Back
            </Link>
            {projectInfo && (
              <span className="mono" style={{ fontSize: 11, color: 'var(--amber)', background: 'var(--amber-glow)', padding: '2px 8px', borderRadius: 4 }}>
                {projectInfo.project_code}
              </span>
            )}
          </div>
          <div className="page-title">Project Activity History</div>
          <div className="page-subtitle">
            {projectInfo?.project_name || 'Loading...'} · {totalEvents} event{totalEvents !== 1 ? 's' : ''} recorded
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="kpi-grid kpi-grid-4 mb-16">
        <div className="kpi-card amber">
          <div className="kpi-icon amber"><Activity /></div>
          <div className="kpi-label">Total Events</div>
          <div className="kpi-value amber">{totalEvents}</div>
          <div className="kpi-sub">All tracked actions</div>
        </div>
        <div className="kpi-card green">
          <div className="kpi-icon green"><Clock /></div>
          <div className="kpi-label">Last Activity</div>
          <div className="kpi-value green" style={{ fontSize: 16 }}>
            {lastEvent ? (lastEvent.time_ago || formatDateIST(lastEvent.performed_at)) : 'Never'}
          </div>
          <div className="kpi-sub">{lastEvent ? (EVENT_LABELS[lastEvent.event_type] || lastEvent.event_type) : 'No events'}</div>
        </div>
        <div className="kpi-card blue">
          <div className="kpi-icon blue"><FileSpreadsheet /></div>
          <div className="kpi-label">Modules Affected</div>
          <div className="kpi-value blue">{Object.keys(moduleSummary).length}</div>
          <div className="kpi-sub">{Object.keys(moduleSummary).map(m => MODULE_LABELS[m] || m).join(', ') || 'None'}</div>
        </div>
        <div className="kpi-card purple">
          <div className="kpi-icon purple"><Upload /></div>
          <div className="kpi-label">Last Updated By</div>
          <div className="kpi-value purple" style={{ fontSize: 16 }}>
            {lastEvent?.performed_by_name || 'System'}
          </div>
          <div className="kpi-sub">{lastEvent ? formatDateIST(lastEvent.performed_at) : '—'}</div>
        </div>
      </div>

      {/* Module Summary Cards */}
      {Object.keys(moduleSummary).length > 0 && (
        <div className="section-card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={16} color="var(--amber)" /> Module Activity Summary
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(Object.keys(moduleSummary).length, 4)}, 1fr)`, gap: 12 }}>
            {Object.entries(moduleSummary).map(([mod, info]) => (
              <div
                key={mod}
                onClick={() => setFilterModule(filterModule === mod ? 'all' : mod)}
                style={{
                  padding: '12px 16px',
                  background: filterModule === mod ? 'var(--surface-hover)' : 'var(--surface-dark)',
                  borderRadius: 'var(--radius)',
                  border: `1px solid ${filterModule === mod ? (MODULE_COLORS[mod] || 'var(--amber)') : 'var(--border-dark)'}`,
                  cursor: 'pointer',
                  transition: 'var(--transition)',
                }}
              >
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: MODULE_COLORS[mod] || 'var(--text-muted)', marginBottom: 4 }}>
                  {MODULE_LABELS[mod] || mod}
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'Rajdhani,sans-serif', color: 'var(--text-primary)' }}>
                  {info.count}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  Last: {info.time_ago || formatDateIST(info.last_updated)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="section-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Filter size={14} color="var(--text-muted)" />
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Filter:</span>
          </div>

          {/* Module filter */}
          <select
            className="form-select"
            value={filterModule}
            onChange={e => setFilterModule(e.target.value)}
            style={{ width: 'auto', padding: '5px 10px', fontSize: 12 }}
          >
            <option value="all">All Modules</option>
            {uniqueModules.map(m => (
              <option key={m} value={m}>{MODULE_LABELS[m] || m}</option>
            ))}
          </select>

          {/* Type filter */}
          <select
            className="form-select"
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            style={{ width: 'auto', padding: '5px 10px', fontSize: 12 }}
          >
            <option value="all">All Types</option>
            {uniqueTypes.map(t => (
              <option key={t} value={t}>{EVENT_LABELS[t] || t}</option>
            ))}
          </select>

          {(filterModule !== 'all' || filterType !== 'all') && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => { setFilterModule('all'); setFilterType('all'); }}
              style={{ fontSize: 11, padding: '4px 10px' }}
            >
              Clear Filters
            </button>
          )}

          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
            Showing {filtered.length} of {totalEvents} events
          </span>
        </div>

        {/* Timeline */}
        {filtered.length === 0 ? (
          <div className="empty-state">
            <Clock size={48} />
            <h3>No Activity Recorded</h3>
            <p>
              {totalEvents === 0
                ? 'This project has no tracked events yet. Import an Excel file, add BOQ items, or record expenses to start tracking.'
                : 'No events match your current filters. Try adjusting the module or type filter.'}
            </p>
          </div>
        ) : (
          <div className="history-timeline">
            {Object.entries(grouped).map(([dateKey, group]) => (
              <div key={dateKey} className="history-date-group">
                <div className="history-date-label">{group.label}</div>
                {group.events.map((event, i) => {
                  const Icon = EVENT_ICONS[event.event_type] || Clock;
                  const moduleColor = MODULE_COLORS[event.affected_module] || 'var(--text-muted)';
                  const hasAmountChange = event.amount_before != null && event.amount_after != null
                    && parseFloat(event.amount_before) !== parseFloat(event.amount_after);
                  const hasQtyChange = event.quantity_before != null && event.quantity_after != null
                    && parseFloat(event.quantity_before) !== parseFloat(event.quantity_after);

                  return (
                    <div className="history-event" key={event.event_id || i}>
                      <div className="history-event-icon" style={{ background: `${moduleColor}15`, color: moduleColor }}>
                        <Icon size={14} />
                      </div>
                      <div className="history-event-body">
                        <div className="history-event-top">
                          <div className="history-event-title">
                            <span className="history-event-type">{EVENT_LABELS[event.event_type] || event.event_type}</span>
                            <span className="history-event-module" style={{ color: moduleColor, borderColor: `${moduleColor}40` }}>
                              {MODULE_LABELS[event.affected_module] || event.affected_module}
                            </span>
                          </div>
                          <div className="history-event-time">
                            {new Date(event.performed_at).toLocaleTimeString('en-IN', {
                              timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit',
                            })}
                          </div>
                        </div>
                        <div className="history-event-desc">{event.description || 'No description'}</div>
                        <div className="history-event-meta">
                          <span className="history-event-user">
                            👤 {event.performed_by_name || 'System'}
                          </span>
                          <span className="history-event-date">
                            {formatDateIST(event.performed_at)}
                          </span>
                        </div>

                        {/* Amount Change */}
                        {hasAmountChange && (
                          <div className="history-event-change">
                            <span style={{ color: 'var(--text-muted)' }}>Amount: ₹{fmtFull(event.amount_before)}</span>
                            <span style={{ color: 'var(--text-muted)', margin: '0 4px' }}>→</span>
                            <span style={{ color: parseFloat(event.amount_after) >= parseFloat(event.amount_before) ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                              ₹{fmtFull(event.amount_after)}
                            </span>
                          </div>
                        )}

                        {/* Quantity Change */}
                        {hasQtyChange && (
                          <div className="history-event-change">
                            <span style={{ color: 'var(--text-muted)' }}>Qty: {event.quantity_before}</span>
                            <span style={{ color: 'var(--text-muted)', margin: '0 4px' }}>→</span>
                            <span style={{ color: 'var(--green)', fontWeight: 600 }}>{event.quantity_after}</span>
                          </div>
                        )}

                        {/* File name */}
                        {event.file_name && (
                          <div className="history-event-file">
                            <Upload size={10} /> {event.file_name}
                          </div>
                        )}

                        {/* RA Bill number */}
                        {event.ra_bill_number && (
                          <span className="badge badge-amber" style={{ marginTop: 4, fontSize: 10 }}>
                            RA-{String(event.ra_bill_number).padStart(2, '0')}
                          </span>
                        )}

                        {/* BOQ item code */}
                        {event.boq_item_code && (
                          <span className="badge badge-blue" style={{ marginTop: 4, marginLeft: 4, fontSize: 10 }}>
                            {event.boq_item_code}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
