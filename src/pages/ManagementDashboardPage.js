import React, { useEffect, useMemo, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import api from '../utils/api';
import Sidebar from '../components/common/Sidebar';
import GlobalFilterToolbar from '../components/common/GlobalFilterToolbar';
import { DashboardDataTable } from '../components/common/DashboardShell';
import { useGlobalFilters } from '../context/GlobalFilterContext';
import { buildDashboardQuery } from '../utils/dashboardFilters';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 6, padding: '0.6rem 0.85rem', fontSize: '0.8rem' }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || 'var(--accent)', marginBottom: '0.15rem' }}>
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
};

const number = (value, decimals = 0) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n.toFixed(decimals) : (0).toFixed(decimals);
};

const money = (value) => `${number(value, 2)} EUR`;
const grams = (value) => `${number(value, 0)} g`;

const ExecutiveMetric = ({ label, value, color = 'var(--text-primary)', sub }) => (
  <div className="kpi-card">
    <div className="kpi-value" style={{ color }}>{value}</div>
    <div className="kpi-label">{label}</div>
    {sub && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{sub}</div>}
  </div>
);

export default function ManagementDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { filters } = useGlobalFilters();
  const query = useMemo(() => buildDashboardQuery(filters), [filters]);

  useEffect(() => {
    setLoading(true);
    const suffix = query ? `?${query}` : '';
    api.get(`/dashboard/management${suffix}`)
      .then(r => { setData(r.data); setLoading(false); })
      .catch(err => {
        setError(err.response?.data?.error || 'Failed to load dashboard');
        setLoading(false);
      });
  }, [query]);

  const trendData = (data?.demandTrend || []).map(d => ({
    month: new Date(d.month).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
    submitted: parseInt(d.submitted || 0, 10),
    completed: parseInt(d.completed || 0, 10),
    rejected: parseInt(d.rejected || 0, 10),
  }));

  const sl = data?.serviceLevel || {};
  const capacity = data?.capacityOverview || {};
  const forecast = data?.forecast || {};
  const satisfaction = data?.satisfaction || {};
  const completionRate = (parseInt(sl.total || 0, 10) > 0)
    ? Math.round((parseInt(sl.completed || 0, 10) / parseInt(sl.total || 0, 10)) * 100)
    : 0;

  return (
    <div className="page">
      <Sidebar />
      <div className="main-content">
        <div className="page-header">
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginBottom: '0.25rem' }}>
              Dashboards / Management Dashboard
            </div>
            <h1 style={{ fontSize: '1.3rem', fontFamily: 'var(--font-heading)' }}>Management Dashboard</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
              Strategic KPIs, capacity, costs, and forecast indicators.
            </p>
          </div>
          <GlobalFilterToolbar dashboard="management" />
        </div>

        <div className="page-body">
          {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
              <span className="spinner" style={{ width: 32, height: 32 }}/>
            </div>
          ) : (
            <>
              <div className="dashboard-kpi-grid">
                <ExecutiveMetric label="Total Requests" value={sl.total || 0} color="var(--blue)" sub="Filtered request population" />
                <ExecutiveMetric label="Completed Requests" value={sl.completed || 0} color="var(--green)" sub="Includes archived completions" />
                <ExecutiveMetric label="Completion Rate" value={`${completionRate}%`} color={completionRate >= 80 ? 'var(--green)' : completionRate >= 60 ? 'var(--yellow)' : 'var(--red)'} />
                <ExecutiveMetric label="Capacity Usage" value={`${number(Math.max(parseFloat(capacity.printer_utilization || 0), parseFloat(capacity.technician_utilization || 0)), 1)}%`} color="var(--yellow)" />
                <ExecutiveMetric label="Forecast Requests" value={number(forecast.forecast_requests, 0)} color="var(--blue)" sub="Monthly average" />
                <ExecutiveMetric label="Forecast Cost" value={money(forecast.forecast_cost)} color="var(--accent)" />
                <ExecutiveMetric label="Customer Satisfaction" value={`${number(satisfaction.customer_satisfaction, 2)} / 5`} color="var(--green)" />
                <ExecutiveMetric label="Recommendation Rate" value={`${number(satisfaction.recommendation_rate, 1)}%`} color="var(--accent)" />
                <ExecutiveMetric label="Survey Participation" value={`${number(satisfaction.survey_participation, 1)}%`} color="var(--blue)" />
              </div>

              <div className="dashboard-chart-grid" style={{ marginBottom: '1.5rem' }}>
                <div className="dashboard-panel">
                  <div className="dashboard-panel-header"><h3>Completion Trend</h3><p>Submitted vs completed requests</p></div>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
                      <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false}/>
                      <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={28} allowDecimals={false}/>
                      <Tooltip content={<CustomTooltip/>}/>
                      <Legend wrapperStyle={{ fontSize: '0.78rem' }}/>
                      <Line type="monotone" dataKey="submitted" stroke="var(--blue)" strokeWidth={2} name="Submitted"/>
                      <Line type="monotone" dataKey="completed" stroke="var(--green)" strokeWidth={2} name="Completed"/>
                      <Line type="monotone" dataKey="rejected" stroke="var(--red)" strokeWidth={1} strokeDasharray="4 2" name="Rejected"/>
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="dashboard-panel">
                  <div className="dashboard-panel-header"><h3>Cost by Category</h3><p>Business category spend</p></div>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={(data?.costByCategory || []).slice(0, 6).map(c => ({ category: c.category || 'Other', cost: parseFloat(c.total_cost || 0) }))} layout="vertical" barSize={16}>
                      <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false}/>
                      <YAxis type="category" dataKey="category" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} width={120}/>
                      <Tooltip content={<CustomTooltip/>}/>
                      <Bar dataKey="cost" fill="var(--accent)" radius={[0,4,4,0]} name="Cost"/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="dashboard-chart-grid" style={{ marginBottom: '1.5rem' }}>
                <DashboardDataTable
                  title="Cost by Site"
                  rows={data?.costBySite || []}
                  filename="management-cost-by-site.csv"
                  columns={[
                    { label: 'Site', key: 'site' },
                    { label: 'Requests', key: 'requests' },
                    { label: 'Actual Cost', key: 'actual_cost', render: row => money(row.actual_cost) },
                    { label: 'Variance', key: 'variance', render: row => <span style={{ color: parseFloat(row.variance || 0) > 0 ? 'var(--red)' : 'var(--green)', fontWeight: 700 }}>{money(row.variance)}</span> },
                  ]}
                />
                <DashboardDataTable
                  title="Cost by Department"
                  rows={data?.costByDepartment || []}
                  filename="management-cost-by-department.csv"
                  columns={[
                    { label: 'Department', key: 'department' },
                    { label: 'Total Cost', key: 'total_cost', render: row => money(row.total_cost) },
                    { label: 'Request Count', key: 'request_count' },
                  ]}
                />
              </div>

              <div className="dashboard-chart-grid">
                <div className="dashboard-panel">
                  <div className="dashboard-panel-header"><h3>Capacity Overview</h3></div>
                  <div className="grid-3">
                    <ExecutiveMetric label="Printer Utilization" value={`${number(capacity.printer_utilization, 1)}%`} color="var(--yellow)" />
                    <ExecutiveMetric label="Technician Utilization" value={`${number(capacity.technician_utilization, 1)}%`} color="var(--yellow)" />
                    <ExecutiveMetric label="Open Capacity" value={`${number(capacity.open_capacity, 1)}%`} color="var(--blue)" />
                  </div>
                </div>
                <div className="dashboard-panel">
                  <div className="dashboard-panel-header"><h3>Forecast</h3></div>
                  <div className="grid-3">
                    <ExecutiveMetric label="Requests" value={number(forecast.forecast_requests, 0)} color="var(--blue)" />
                    <ExecutiveMetric label="Material" value={grams(forecast.forecast_material_consumption)} color="var(--yellow)" />
                    <ExecutiveMetric label="Cost" value={money(forecast.forecast_cost)} color="var(--accent)" />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
