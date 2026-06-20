import { fmtFull } from './KPICard';
import { AlertTriangle, Info } from 'lucide-react';

/**
 * SandwichView — Side-by-side main contractor vs subcontractor comparison
 */
export default function SandwichView({ sandwich, projectId }) {
  if (!sandwich || sandwich.mode === 'none') return null;

  if (sandwich.mode === 'main_only') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
        <div style={{
          background: 'var(--surface-dark)',
          border: '1px solid var(--border-dark)',
          borderRadius: 'var(--radius)',
          padding: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--amber)' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: 1 }}>
              Main Contractor Analytics
            </span>
          </div>
          {sandwich.main_contracts.map(c => (
            <div key={c.contract_id}>
              <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600 }}>{c.org_name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Full project scope</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (sandwich.mode === 'sub_only') {
    return (
      <div style={{
        padding: '12px 16px',
        background: 'var(--surface-dark)',
        border: '1px solid var(--border-dark)',
        borderRadius: 'var(--radius)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        color: 'var(--text-muted)',
        fontSize: 13
      }}>
        <Info size={14} color="var(--amber)" />
        Parent contractor data not linked. Analytics for allocated scope only.
      </div>
    );
  }

  // Full mode — show both
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      {/* Main Contractor */}
      <div style={{
        background: 'var(--surface-dark)',
        border: '1px solid var(--border-dark)',
        borderRadius: 'var(--radius)',
        padding: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--amber)' }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: 1 }}>
            Main Contractor (Outer)
          </span>
        </div>
        {sandwich.main_contracts.map(c => (
          <div key={c.contract_id}>
            <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600 }}>{c.org_name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Full project scope</div>
          </div>
        ))}
      </div>

      {/* Subcontractor */}
      <div style={{
        background: 'var(--surface-dark)',
        border: '1px solid var(--border-dark)',
        borderLeft: '3px solid var(--blue)',
        borderRadius: 'var(--radius)',
        padding: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--blue)' }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: 1 }}>
            Subcontractor (Inner)
          </span>
        </div>
        {sandwich.sub_contracts.map(c => (
          <div key={c.contract_id}>
            <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600 }}>{c.org_name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {c.alloc_count} BOQ items allocated
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
