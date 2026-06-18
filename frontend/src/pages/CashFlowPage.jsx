import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/axios';
import { fmt, fmtFull } from '../components/KPICard';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Activity } from 'lucide-react';

export default function CashFlowPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/analytics/project/${id}/cashflow`).then(r => setData(r.data.data)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div style={{ padding: 32, textAlign: 'center' }}><div className="loader" /></div>;
  if (!data) return null;

  const { total_inflow, total_outflow, net_position, events } = data;

  // Build timeline
  let running = 0;
  const timelineData = events.map(e => {
    const amt = parseFloat(e.amount) || 0;
    if (e.type === 'inflow') running += amt;
    else running -= amt;
    return {
      date:     e.payment_date,
      label:    e.label,
      inflow:   e.type === 'inflow' ? amt : 0,
      outflow:  e.type === 'outflow' ? amt : 0,
      net:      running,
    };
  });

  const TooltipStyle = {
    contentStyle: { background: '#12121A', border: '1px solid #1E1E2E', borderRadius: 8 },
    labelStyle: { color: '#94A3B8' }, itemStyle: { color: '#F1F5F9' }
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div className="page-title">Cash Flow</div>
      </div>

      <div className="kpi-grid kpi-grid-3 mb-24">
        <div className="kpi-card green">
          <div className="kpi-icon green"><TrendingUp /></div>
          <div className="kpi-label">Total Inflow</div>
          <div className="kpi-value green">{fmt(total_inflow)}</div>
          <div className="kpi-sub">Payments received</div>
        </div>
        <div className="kpi-card red">
          <div className="kpi-icon red"><TrendingDown /></div>
          <div className="kpi-label">Total Outflow</div>
          <div className="kpi-value red">{fmt(total_outflow)}</div>
          <div className="kpi-sub">Expenses paid</div>
        </div>
        <div className={`kpi-card ${net_position >= 0 ? 'amber' : 'red'}`}>
          <div className={`kpi-icon ${net_position >= 0 ? 'amber' : 'red'}`}><DollarSign /></div>
          <div className="kpi-label">Net Position</div>
          <div className={`kpi-value ${net_position >= 0 ? 'amber' : 'red'}`}>{fmt(net_position)}</div>
          <div className="kpi-sub">Inflow minus outflow</div>
        </div>
      </div>

      {timelineData.length > 0 ? (
        <>
          <div className="section-card mb-16">
            <div className="section-title mb-16"><Activity /> Cash Inflow vs Outflow</div>
            <div className="chart-container">
              <ResponsiveContainer>
                <BarChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E1E2E" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={{ stroke: '#1E1E2E' }} tickLine={false} />
                  <YAxis tickFormatter={v => fmt(v)} tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip {...TooltipStyle} formatter={v => fmtFull(v)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="inflow"  fill="#10B981" radius={[4,4,0,0]} name="Inflow" />
                  <Bar dataKey="outflow" fill="#EF4444" radius={[4,4,0,0]} name="Outflow" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="section-card">
            <div className="section-title mb-16"><TrendingUp /> Net Position Over Time</div>
            <div className="chart-container">
              <ResponsiveContainer>
                <LineChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E1E2E" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={{ stroke: '#1E1E2E' }} tickLine={false} />
                  <YAxis tickFormatter={v => fmt(v)} tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip {...TooltipStyle} formatter={v => fmtFull(v)} />
                  <Line type="monotone" dataKey="net" stroke="#F59E0B" strokeWidth={2} dot={{ r: 4, fill: '#F59E0B' }} name="Net Position" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      ) : (
        <div className="empty-state section-card">
          <Activity />
          <h3>No cash flow data yet</h3>
          <p>Record payments and expenses to see the cash flow timeline</p>
        </div>
      )}
    </div>
  );
}
