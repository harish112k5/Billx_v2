import { useState } from 'react';
import { Clock, History } from 'lucide-react';
import DataHistoryPanel from './DataHistoryPanel';

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
  project_created: 'Project Created',
};

/**
 * Compute freshness level based on data age.
 * @returns {'green' | 'amber' | 'red' | 'neutral'}
 */
function getFreshnessLevel(dateStr) {
  if (!dateStr) return 'neutral';
  const now = new Date();
  const then = new Date(dateStr);
  const diffDays = Math.floor((now - then) / 86400000);
  if (diffDays <= 7) return 'green';
  if (diffDays <= 30) return 'amber';
  return 'red';
}

function formatDateIST(dateStr) {
  if (!dateStr) return 'No activity recorded';
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

/**
 * DataFreshnessIndicator
 * 
 * Compact bar (max 32px) showing when chart data was last updated.
 * 
 * Props:
 * - lastUpdatedAt: datetime string (null = no data, undefined = still loading)
 * - lastEventType: string like 'excel_import'
 * - updatedBy: string like 'Super Admin'
 * - eventCount: number
 * - module: display name like 'RA Bills'
 * - events: array of event objects for the history panel
 * - loaded: boolean (true once the API call has finished)
 */
export default function DataFreshnessIndicator({
  lastUpdatedAt,
  lastEventType,
  updatedBy,
  eventCount,
  module: moduleName = 'Data',
  events = [],
  loaded = true,
}) {
  const [showHistory, setShowHistory] = useState(false);

  const freshness = getFreshnessLevel(lastUpdatedAt);
  const eventLabel = EVENT_LABELS[lastEventType] || lastEventType || 'Not tracked yet';
  const displayDate = !loaded ? 'Loading...' : formatDateIST(lastUpdatedAt);
  const displayUser = updatedBy || 'System';
  const displayCount = eventCount ?? 0;

  return (
    <>
      <div className="data-freshness-bar">
        <div className="dfb-left">
          <span className={`freshness-dot dot-${freshness}`} title={`Data freshness: ${freshness}`} />
          <div className="dfb-info">
            <span className="dfb-date">
              <Clock size={10} style={{ marginRight: 3 }} />
              Last updated: {displayDate}
            </span>
            <span className="dfb-meta">
              {displayUser} via {eventLabel} · {displayCount} update{displayCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        {events.length > 0 && (
          <button className="dfb-history-btn" onClick={() => setShowHistory(true)}>
            <History size={14} /> View History
          </button>
        )}
      </div>

      <DataHistoryPanel
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        events={events}
        moduleName={moduleName}
      />
    </>
  );
}
