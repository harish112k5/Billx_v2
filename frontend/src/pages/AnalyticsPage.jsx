import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/axios';
import { fmt, fmtFull } from '../components/KPICard';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell
} from 'recharts';
import { BarChart3, TrendingUp, Activity, AlertTriangle, Wallet } from 'lucide-react';
import DataFreshnessIndicator from '../components/DataFreshnessIndicator';

const TooltipStyle = {
  contentStyle: { background: '#12121A', border: '1px solid #1E1E2E', borderRadius: 8 },
  labelStyle: { color: '#94A3B8' },
  itemStyle: { color: '#F1F5F9' }
};

const EXPENSE_TYPE_COLORS = {
  material: '#4E79A7',   // Blue
  manpower: '#F28E2B',   // Orange
  machinery: '#E15759',  // Red
  movement: '#76B7B2',   // Teal
  misc: '#B07AA1'        // Purple
};

export default function AnalyticsPage() {
  const { id } = useParams();
  const [analytics, setAnalytics] = useState(null);
  const [overrunData, setOverrunData] = useState(null);
  const [freqData, setFreqData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get(`/analytics/project/${id}`),
      api.get(`/projects/${id}/budget-overrun`).catch(() => ({ data: { data: null } })),
      api.get(`/projects/${id}/data-frequency`).catch(() => ({ data: { data: null } })),
    ]).then(([res, overrunRes, freqRes]) => {
      setAnalytics(res.data.data);
      setOverrunData(overrunRes.data.data);
      setFreqData(freqRes.data.data);
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div style={{ padding: 32, textAlign: 'center' }}><div className="loader" /></div>;
  if (!analytics) return null;

  const { ra_progression, category_breakdown, planning, billing, variance, budget_health, expense_breakdown } = analytics;

  const raTrendData = (ra_progression || []).map(r => ({
    name: r.ra_code || `RA-${r.ra}`,
    Basic:     parseFloat(r.cumulative_basic) || 0,
    Payable:   parseFloat(r.net_payable) || 0,
    Received:  parseFloat(r.received) || 0,
  }));

  const catData = (category_breakdown || []).slice(0, 8).map(c => ({
    name: c.category || 'Other',
    Planned:   parseFloat(c.planned) || 0,
    Executed:  parseFloat(c.executed) || 0,
  }));

  const boqStatusData = [
    { name: 'Completed',    value: planning?.completed_items   || 0, color: '#10B981' },
    { name: 'In Progress',  value: planning?.in_progress_items || 0, color: '#F59E0B' },
    { name: 'Not Started',  value: planning?.not_started_items || 0, color: '#64748B' },
    { name: 'Exceeded BOQ', value: planning?.exceeded_boq_items || 0, color: '#EF4444' },
  ].filter(d => d.value > 0);

  // Budget vs Actual chart data
  const budgetActualData = budget_health ? [
    { name: 'Planned Budget',   value: budget_health.planned_budget,  fill: '#4E79A7' },
    { name: 'Actual Cost',      value: budget_health.total_expenses,  fill: budget_health.total_expenses > budget_health.planned_budget ? '#E15759' : '#59A14F' },
    { name: 'Revenue Received', value: budget_health.total_received,  fill: '#59A14F' },
    { name: 'Planned Profit',   value: budget_health.planned_profit,  fill: '#B07AA1' },
  ] : [];

  // Expense type pie data
  const expenseTypeData = Object.entries(expense_breakdown || {}).map(([type, data]) => ({
    type: type.charAt(0).toUpperCase() + type.slice(1),
    amount: data.amount || 0,
    count: data.count || 0,
  })).filter(d => d.amount > 0);

  // Top variance BOQ items from overrun data
  const topVarianceItems = (overrunData?.overrun_items || []).slice(0, 10);

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Analytics</div>
          <div className="page-subtitle">Deep-dive into project execution performance</div>
        </div>
      </div>

      {/* Variance KPIs */}
      <div className="kpi-grid kpi-grid-3 mb-24">
        <div className={`kpi-card ${(variance?.planned_vs_executed_percent || 0) >= 0 ? 'green' : 'red'}`}>
          <div className="kpi-label">Planned vs Executed (Δ)</div>
          <div className={`kpi-value ${(variance?.planned_vs_executed_percent || 0) >= 0 ? 'green' : 'red'}`}>
            {(variance?.planned_vs_executed_percent || 0) >= 0 ? '+' : ''}{(variance?.planned_vs_executed_percent || 0).toFixed(2)}%
          </div>
          <div className="kpi-sub">{fmtFull(Math.abs(variance?.planned_vs_executed_amount || 0))} {variance?.planned_vs_executed_amount >= 0 ? 'over' : 'under'} plan</div>
        </div>
        <div className="kpi-card blue">
          <div className="kpi-label">Total Planned</div>
          <div className="kpi-value blue">{fmt(planning?.total_planned_amount)}</div>
          <div className="kpi-sub">{planning?.total_boq_items} BOQ items</div>
        </div>
        <div className="kpi-card amber">
          <div className="kpi-label">Total Executed</div>
          <div className="kpi-value amber">{fmt(analytics?.execution?.amount_upto_date)}</div>
          <div className="kpi-sub">Certified upto date</div>
        </div>
      </div>

      {/* Budget vs Actual vs Revenue Chart */}
      {budgetActualData.length > 0 && (
        <div className="section-card" style={{ marginBottom: 16 }}>
          <div className="section-title mb-16"><Wallet /> Budget vs Actual Cost vs Revenue</div>
          <DataFreshnessIndicator
            lastUpdatedAt={freqData?.module_summary?.ra_bill?.last_updated}
            lastEventType={freqData?.module_summary?.ra_bill?.last_event}
            updatedBy={freqData?.last_updated_by}
            eventCount={(freqData?.module_summary?.ra_bill?.count || 0) + (freqData?.module_summary?.expenses?.count || 0)}
            module="Budget & Revenue"
            events={(freqData?.events || []).filter(e => ['ra_bill', 'expenses', 'boq'].includes(e.affected_module))}
            loaded={freqData !== null}
          />
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8 }}>Data combines BOQ entries, expenses, and RA Bills</div>
          <div style={{ height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={budgetActualData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1E1E2E" horizontal={false} />
                <XAxis type="number" tickFormatter={v => fmt(v)} tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" width={130} tick={{ fill: '#94A3B8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip {...TooltipStyle} formatter={v => fmtFull(v)} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {budgetActualData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Expense Breakdown + BOQ Status */}
      <div className="grid-2" style={{ marginBottom: 16 }}>
        {/* Expense Type Donut */}
        <div className="section-card">
          <div className="section-title mb-16"><Activity /> Expense Breakdown by Type</div>
          <DataFreshnessIndicator
            lastUpdatedAt={freqData?.module_summary?.expenses?.last_updated}
            lastEventType={freqData?.module_summary?.expenses?.last_event}
            updatedBy={freqData?.last_updated_by}
            eventCount={freqData?.module_summary?.expenses?.count || 0}
            module="Expenses"
            events={(freqData?.events || []).filter(e => e.affected_module === 'expenses')}
            loaded={freqData !== null}
          />
          {expenseTypeData.length > 0 ? (
            <div style={{ height: 280, display: 'flex', alignItems: 'center', gap: 24 }}>
              <ResponsiveContainer width={180} height="100%">
                <PieChart>
                  <Pie data={expenseTypeData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={4} dataKey="amount" nameKey="type">
                    {expenseTypeData.map((entry, index) => (
                      <Cell key={index} fill={EXPENSE_TYPE_COLORS[entry.type.toLowerCase()] || '#64748B'} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip {...TooltipStyle} formatter={v => [fmtFull(v), 'Amount']} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1 }}>
                {expenseTypeData.map((d, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: EXPENSE_TYPE_COLORS[d.type.toLowerCase()] || '#64748B' }} />
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{d.type}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({d.count})</span>
                    </div>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Rajdhani,sans-serif' }}>{fmtFull(d.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <div className="empty-state" style={{ padding: 24 }}><Activity /><h3>No expense data</h3></div>}
        </div>

        {/* BOQ Status Donut */}
        <div className="section-card">
          <div className="section-title mb-16"><TrendingUp /> BOQ Item Status Distribution</div>
          <DataFreshnessIndicator
            lastUpdatedAt={freqData?.module_summary?.boq?.last_updated}
            lastEventType={freqData?.module_summary?.boq?.last_event}
            updatedBy={freqData?.last_updated_by}
            eventCount={freqData?.module_summary?.boq?.count || 0}
            module="BOQ"
            events={(freqData?.events || []).filter(e => e.affected_module === 'boq')}
            loaded={freqData !== null}
          />
          {boqStatusData.length > 0 ? (
            <div style={{ height: 280, display: 'flex', alignItems: 'center', gap: 24 }}>
              <ResponsiveContainer width={180} height="100%">
                <PieChart>
                  <Pie data={boqStatusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                    {boqStatusData.map((e, i) => <Cell key={i} fill={e.color} stroke="none" />)}
                  </Pie>
                  <Tooltip {...TooltipStyle} formatter={(v,n) => [v + ' items', n]} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1 }}>
                {boqStatusData.map((d, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: d.color }} />
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{d.name}</span>
                    </div>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <div className="empty-state" style={{ padding: 24 }}><TrendingUp /><h3>No data</h3></div>}
        </div>
      </div>

      {/* RA Trend Chart */}
      <div className="section-card" style={{ marginBottom: 16 }}>
        <div className="section-title mb-16"><BarChart3 /> RA Bill Trend — Cumulative vs Received</div>
        <DataFreshnessIndicator
          lastUpdatedAt={freqData?.module_summary?.ra_bill?.last_updated}
          lastEventType={freqData?.module_summary?.ra_bill?.last_event}
          updatedBy={freqData?.last_updated_by}
          eventCount={freqData?.module_summary?.ra_bill?.count || 0}
          module="RA Bills"
          events={(freqData?.events || []).filter(e => e.affected_module === 'ra_bill')}
          loaded={freqData !== null}
        />
        {raTrendData.length > 0 ? (
          <div className="chart-container">
            <ResponsiveContainer>
              <BarChart data={raTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E1E2E" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 12 }} axisLine={{ stroke: '#1E1E2E' }} tickLine={false} />
                <YAxis tickFormatter={v => fmt(v)} tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip {...TooltipStyle} formatter={v => fmtFull(v)} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#94A3B8' }} />
                <Bar dataKey="Basic"    fill="#F59E0B" radius={[4,4,0,0]} name="Cumulative Basic" />
                <Bar dataKey="Payable"  fill="#8B5CF6" radius={[4,4,0,0]} name="Net Payable" />
                <Bar dataKey="Received" fill="#10B981" radius={[4,4,0,0]} name="Received" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <div className="empty-state"><BarChart3 /><h3>No RA Bills data</h3></div>}
      </div>

      {/* Category Breakdown Chart */}
      {catData.length > 0 && (
        <div className="section-card" style={{ marginBottom: 16 }}>
          <div className="section-title mb-16"><Activity /> BOQ by Category (Planned vs Executed)</div>
          <div style={{ height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={catData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1E1E2E" horizontal={false} />
                <XAxis type="number" tickFormatter={v => fmt(v)} tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} width={80} />
                <Tooltip {...TooltipStyle} formatter={v => fmtFull(v)} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#94A3B8' }} />
                <Bar dataKey="Planned"  fill="#3B82F6" radius={[0,4,4,0]} name="Planned" />
                <Bar dataKey="Executed" fill="#F59E0B" radius={[0,4,4,0]} name="Executed" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Budget Overrun Alerts */}
      {overrunData?.overrun_items?.length > 0 && (
        <div className="section-card">
          <div className="section-title mb-16">
            <AlertTriangle /> Budget Overrun Alerts
            <span className="badge badge-red" style={{ marginLeft: 8 }}>{overrunData.overrun_boq_count} items</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {overrunData.overrun_items.map(item => (
              <div key={item.boq_id} className={`overrun-alert overrun-${item.alert_level}`}>
                <div className="overrun-alert-header">
                  <span className={`overrun-badge ${item.alert_level}`}>{item.alert_level.toUpperCase()}</span>
                  <strong>{item.item_code} — {item.description}</strong>
                </div>
                <div className="overrun-alert-body">
                  <span>Planned: {fmtFull(item.planned_amount)}</span>
                  <span>Actual: {fmtFull(item.actual_cost)}</span>
                  <span style={{ color: 'var(--red)', fontWeight: 600 }}>
                    Overrun: {fmtFull(Math.abs(item.variance))} ({item.overrun_percent}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text-muted)' }}>
            Total overrun: <strong style={{ color: 'var(--red)' }}>{fmtFull(overrunData.total_overrun_amount)}</strong> across {overrunData.overrun_boq_count} of {overrunData.total_boq_count} BOQ items
          </div>
        </div>
      )}
    </div>
  );
}
