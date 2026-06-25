import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Calendar, RefreshCw, ArrowLeft, Clock, TrendingUp, CheckCircle } from 'lucide-react';
import api from '../api/axios';
import SCurveChart from '../components/SCurveChart';
import EVMDashboard from '../components/EVMDashboard';
import TimePhaseTable from '../components/TimePhaseTable';
import BurnRateChart from '../components/BurnRateChart';
import WorkCompletionChart from '../components/WorkCompletionChart';

export default function TimeAnalyticsPage() {
  const { id: projectId } = useParams();
  const [timeline, setTimeline] = useState([]);
  const [evm, setEvm] = useState(null);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchData();
  }, [projectId, asOfDate]);

  async function fetchData() {
    setLoading(true);
    try {
      const [timelineRes, evmRes, projectRes] = await Promise.all([
        api.get(`/projects/${projectId}/boq-schedules/timeline?asOfDate=${asOfDate}`),
        api.get(`/projects/${projectId}/boq-schedules/evm?asOfDate=${asOfDate}`),
        api.get(`/projects/${projectId}`)
      ]);
      setTimeline(timelineRes.data.data || []);
      setEvm(evmRes.data.data || null);
      setProject(projectRes.data.data?.project || projectRes.data.data || null);
    } catch (error) {
      console.error('Failed to fetch time analytics:', error);
    }
    setLoading(false);
  }

  const tabs = [
    { key: 'overview', label: 'Overview', icon: <TrendingUp size={14} /> },
    { key: 'completion', label: 'Work Completion', icon: <CheckCircle size={14} /> },
    { key: 'schedule', label: 'Monthly Schedule', icon: <Calendar size={14} /> },
  ];

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <Link to={`/projects/${projectId}`} style={{ color: 'var(--text-muted)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, marginBottom: 8 }}>
            <ArrowLeft size={14} /> Back to Project
          </Link>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Clock size={22} style={{ color: 'var(--amber)' }} />
            3D Time Analytics
          </div>
          <div className="page-subtitle">
            {project?.project_name || 'Loading...'} — Time × Money × Work Completion
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ color: 'var(--text-muted)', fontSize: 13 }}>As of:</label>
            <input
              type="date"
              value={asOfDate}
              onChange={e => setAsOfDate(e.target.value)}
              style={{
                padding: '6px 12px', borderRadius: 6,
                border: '1px solid var(--border-dark)', background: 'var(--surface-dark)',
                color: 'var(--text-primary)', fontSize: 13, outline: 'none'
              }}
            />
          </div>
          <button className="btn btn-secondary" onClick={fetchData} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border-dark)', paddingBottom: 0 }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 20px', background: 'none', border: 'none', cursor: 'pointer',
              color: activeTab === tab.key ? 'var(--amber)' : 'var(--text-muted)',
              borderBottom: activeTab === tab.key ? '2px solid var(--amber)' : '2px solid transparent',
              fontWeight: activeTab === tab.key ? 600 : 400, fontSize: 14,
              display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s'
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 64, textAlign: 'center' }}><div className="loader" /></div>
      ) : (
        <>
          {activeTab === 'overview' && (
            <>
              {/* EVM KPI Cards */}
              <EVMDashboard evm={evm} />

              {/* S-Curve Chart */}
              <div className="section-card" style={{ marginTop: 24 }}>
                <div style={{ padding: '20px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ color: 'var(--text-primary)', margin: 0, fontSize: 16 }}>S-Curve: Planned vs Earned vs Cost</h3>
                    <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: 13 }}>Cumulative values over project timeline</p>
                  </div>
                </div>
                <div style={{ padding: '16px 8px 16px' }}>
                  <SCurveChart data={timeline} />
                </div>
              </div>

              {/* Burn Rate Chart */}
              <div className="section-card" style={{ marginTop: 24 }}>
                <div style={{ padding: '20px 24px 0' }}>
                  <h3 style={{ color: 'var(--text-primary)', margin: 0, fontSize: 16 }}>Burn Rate & Billing Velocity</h3>
                  <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: 13 }}>Monthly planned spend vs actual cost with earned value overlay</p>
                </div>
                <div style={{ padding: '16px 8px 16px' }}>
                  <BurnRateChart data={timeline} />
                </div>
              </div>
            </>
          )}

          {activeTab === 'completion' && (
            <div className="section-card" style={{ marginTop: 0 }}>
              <div style={{ padding: '20px 24px 0' }}>
                <h3 style={{ color: 'var(--text-primary)', margin: 0, fontSize: 16 }}>Work Completion Over Time</h3>
                <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: 13 }}>Cumulative planned vs actual work progress as percentage of total scope</p>
              </div>
              <div style={{ padding: '16px 8px 16px' }}>
                <WorkCompletionChart data={timeline} />
              </div>
            </div>
          )}

          {activeTab === 'schedule' && (
            <div className="section-card">
              <div style={{ padding: '20px 24px 0' }}>
                <h3 style={{ color: 'var(--text-primary)', margin: 0, fontSize: 16 }}>Monthly Schedule Breakdown</h3>
                <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: 13 }}>Planned vs actual quantities and amounts per period per BOQ item</p>
              </div>
              <div style={{ padding: 16 }}>
                <TimePhaseTable projectId={projectId} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
