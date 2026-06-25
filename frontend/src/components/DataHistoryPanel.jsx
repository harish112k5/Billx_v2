import { useEffect } from 'react';
import {
  X, Upload, Pencil, CreditCard, ArrowRightLeft,
  FileSpreadsheet, Ruler, Clock
} from 'lucide-react';
import { fmtFull } from './KPICard';

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
  manual_boq_entry: 'Manual Entry',
  manual_ra_bill: 'Manual Entry',
  manual_measurement: 'Manual Entry',
  manual_expense: 'Manual Entry',
  payment_recorded: 'Payment Update',
  stage_changed: 'Stage Update',
  boq_updated: 'BOQ Update',
  measurement_added: 'Measurement Entry',
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

export default function DataHistoryPanel({ isOpen, onClose, events = [], moduleName = 'Data' }) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop overlay */}
      <div className="data-history-overlay" onClick={onClose} />
      
      {/* Panel */}
      <div className="data-history-panel">
        <div className="dhp-header">
          <div>
            <div className="dhp-title">
              <Clock size={16} /> Data History — {moduleName}
            </div>
            <div className="dhp-subtitle">{events.length} event{events.length !== 1 ? 's' : ''} recorded</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        <div className="dhp-timeline">
          {events.length === 0 ? (
            <div className="dhp-empty">
              <Clock size={24} />
              <div>No data events recorded yet</div>
            </div>
          ) : (
            events.map((event, i) => {
              const Icon = EVENT_ICONS[event.event_type] || Clock;
              const label = EVENT_LABELS[event.event_type] || event.event_type;
              const hasAmountChange = event.amount_before != null && event.amount_after != null
                && (parseFloat(event.amount_before) !== parseFloat(event.amount_after));
              const hasQtyChange = event.quantity_before != null && event.quantity_after != null
                && (parseFloat(event.quantity_before) !== parseFloat(event.quantity_after));

              return (
                <div className="timeline-item" key={event.event_id || i}>
                  <div className="timeline-dot-line">
                    <div className={`timeline-dot ${event.event_type === 'excel_import' ? 'dot-amber' : 'dot-blue'}`}>
                      <Icon size={10} />
                    </div>
                    {i < events.length - 1 && <div className="timeline-line" />}
                  </div>
                  <div className="timeline-content">
                    <div className="timeline-header">
                      <span className="timeline-label">{label}</span>
                      <span className="timeline-time">{event.time_ago || formatDateIST(event.performed_at)}</span>
                    </div>
                    <div className="timeline-desc">{event.description || 'No description'}</div>
                    <div className="timeline-meta">
                      <span>{event.performed_by_name || 'System'}</span>
                      <span>{formatDateIST(event.performed_at)}</span>
                    </div>
                    {hasAmountChange && (
                      <div className="timeline-change">
                        <span style={{ color: 'var(--text-muted)' }}>₹{fmtFull(event.amount_before)}</span>
                        <span style={{ color: 'var(--text-muted)' }}> → </span>
                        <span style={{ color: parseFloat(event.amount_after) >= parseFloat(event.amount_before) ? 'var(--green)' : 'var(--red)' }}>
                          ₹{fmtFull(event.amount_after)}
                        </span>
                      </div>
                    )}
                    {hasQtyChange && (
                      <div className="timeline-change">
                        <span style={{ color: 'var(--text-muted)' }}>Qty: {event.quantity_before}</span>
                        <span style={{ color: 'var(--text-muted)' }}> → </span>
                        <span style={{ color: 'var(--green)' }}>{event.quantity_after}</span>
                      </div>
                    )}
                    {event.file_name && (
                      <div className="timeline-file">
                        <Upload size={10} /> {event.file_name}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
