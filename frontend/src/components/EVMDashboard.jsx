import React from 'react';
import { TrendingUp, TrendingDown, Activity, DollarSign, Clock, Target, AlertTriangle, CheckCircle } from 'lucide-react';

export default function EVMDashboard({ evm }) {
  if (!evm) return null;

  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy': case 'on_track': case 'on_budget': return 'var(--green)';
      case 'at_risk': return 'var(--orange)';
      case 'critical': case 'behind': case 'over_budget': return 'var(--red)';
      default: return 'var(--text-muted)';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'on_track': case 'on_budget': return <CheckCircle size={14} />;
      case 'at_risk': return <AlertTriangle size={14} />;
      case 'behind': case 'over_budget': return <TrendingDown size={14} />;
      default: return <Activity size={14} />;
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'on_track': return 'On Track';
      case 'on_budget': return 'On Budget';
      case 'at_risk': return 'At Risk';
      case 'behind': return 'Behind';
      case 'over_budget': return 'Over Budget';
      default: return 'Unknown';
    }
  };

  const fmt = (v) => {
    const n = Number(v) || 0;
    if (Math.abs(n) >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
    if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
    if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
    return `₹${n.toFixed(0)}`;
  };

  const cards = [
    { label: 'Planned Value', value: fmt(evm.PV), sub: 'PV', icon: <Target size={18} />, color: 'var(--blue)' },
    { label: 'Earned Value', value: fmt(evm.EV), sub: 'EV', icon: <TrendingUp size={18} />, color: 'var(--green)' },
    { label: 'Actual Cost', value: fmt(evm.AC), sub: 'AC', icon: <DollarSign size={18} />, color: 'var(--orange)' },
    { label: 'Schedule Variance', value: fmt(evm.SV), sub: 'SV', icon: <Clock size={18} />, color: evm.SV >= 0 ? 'var(--green)' : 'var(--red)' },
    { label: 'Cost Variance', value: fmt(evm.CV), sub: 'CV', icon: <DollarSign size={18} />, color: evm.CV >= 0 ? 'var(--green)' : 'var(--red)' },
    {
      label: 'SPI', value: evm.SPI, sub: getStatusLabel(evm.status?.schedule),
      icon: getStatusIcon(evm.status?.schedule),
      color: getStatusColor(evm.status?.schedule)
    },
    {
      label: 'CPI', value: evm.CPI, sub: getStatusLabel(evm.status?.cost),
      icon: getStatusIcon(evm.status?.cost),
      color: getStatusColor(evm.status?.cost)
    },
    { label: 'Est. at Completion', value: fmt(evm.EAC), sub: 'EAC', icon: <Target size={18} />, color: 'var(--purple)' },
    { label: 'Est. to Complete', value: fmt(evm.ETC), sub: 'ETC', icon: <Activity size={18} />, color: 'var(--teal)' },
  ];

  return (
    <div className="evm-dashboard">
      <div className="evm-grid">
        {cards.map((card, i) => (
          <div key={i} className="evm-card" style={{ borderLeftColor: card.color }}>
            <div className="evm-card-header">
              <span className="evm-card-icon" style={{ color: card.color }}>{card.icon}</span>
              <span className="evm-card-label">{card.label}</span>
            </div>
            <div className="evm-card-value" style={{ color: card.color }}>{card.value}</div>
            <div className="evm-card-sub">{card.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
