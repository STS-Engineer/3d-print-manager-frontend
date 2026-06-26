import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, LineChart, Line, Legend
} from 'recharts';
import api from '../utils/api';
import Sidebar from '../components/common/Sidebar';
import GlobalFilterToolbar from '../components/common/GlobalFilterToolbar';
import { DashboardDataTable } from '../components/common/DashboardShell';
import { useGlobalFilters } from '../context/GlobalFilterContext';
import { buildDashboardQuery } from '../utils/dashboardFilters';

const COLORS = ['#ff6b35','#3b82f6','#22c55e','#f59e0b','#a855f7','#06b6d4','#ef4444','#10b981'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 6, padding: '0.6rem 0.85rem', fontSize: '0.8rem' }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || 'var(--accent)' }}>
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
};

const GaugeBar = ({ value, fillValue = value, max = 100, color, label, displayValue }) => (
  <div style={{ marginBottom: '1.25rem' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.82rem' }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ color, fontWeight: 700, fontFamily: 'var(--font-heading)' }}>{displayValue || `${value}%`}</span>
    </div>
    <div style={{ height: 10, background: 'var(--bg-hover)', borderRadius: 5, overflow: 'hidden', border: '1px solid var(--border)' }}>
      <div style={{
        height: '100%', borderRadius: 5,
        background: color,
        width: `${Math.min(Math.max(fillValue, 0), max)}%`,
        transition: 'width 0.6s ease',
      }}/>
    </div>
  </div>
);

const number = (value, decimals = 0) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n.toFixed(decimals) : (0).toFixed(decimals);
};

const money = (value) => `${number(value, 2)} EUR`;
const grams = (value) => `${number(value, 0)} g`;
const hours = (value) => `${number(value, 1)}h`;

const MiniMetric = ({ label, value, color = 'var(--text-primary)' }) => (
  <div style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.85rem 1rem' }}>
    <div style={{ fontSize: '1.25rem', fontFamily: 'var(--font-heading)', fontWeight: 800, color }}>{value}</div>
    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '0.25rem' }}>{label}</div>
  </div>
);

export default function PerformanceDashboardPage() {
  const [data, setData] = useState(null);
  const { filters } = useGlobalFilters();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const query = useMemo(() => buildDashboardQuery(filters), [filters]);

  useEffect(() => {
    setLoading(true);
    setError('');
    api.get(`/dashboard/performance?${query}`)
      .then(r => { setData(r.data); setLoading(false); })
      .catch(err => {
        setError(err.response?.data?.error || 'Failed to load dashboard');
        setLoading(false);
      });
  }, [query]);

  // Format completed-by-week data
  const weeklyData = (data?.completedByWeek || []).map(w => ({
    week: w.week
      ? new Date(w.week).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
      : '?',
    completed: parseInt(w.count || 0),
  }));

  const agingData = data?.backlogAging || [];

  // Tech performance
  const techData = (data?.techPerformance || []).filter(t => parseInt(t.completed) > 0);
  const productionTechData = data?.technicianProductionPerformance || [];
  const printerPerformance = data?.printerPerformance || [];
  const materialByType = data?.materialConsumption?.byType || [];
  const costTrendData = (data?.costTrend || []).map(row => ({
    month: row.month
      ? new Date(row.month).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
      : '?',
    actualCost: parseFloat(row.actual_cost || 0),
  }));
  const satisfaction = data?.requesterSatisfaction || {};
  const satisfactionSummary = satisfaction.summary || {};
  const satisfactionTrend = (satisfaction.trend || []).map(row => ({
    month: row.month
      ? new Date(row.month).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
      : '?',
    average: parseFloat(row.average_satisfaction || 0),
  }));
  const satisfactionDistribution = (satisfaction.distribution || []).map(row => ({
    rating: `${row.rating} Star`,
    count: parseInt(row.count || 0, 10),
  }));

  const onTimeColor = (rate) =>
    rate >= 80 ? 'var(--green)' : rate >= 60 ? '#f97316' : 'var(--red)';
  const qualityColor = (rate) =>
    rate >= 90 ? 'var(--green)' : rate >= 75 ? '#f97316' : 'var(--red)';
  const inverseQualityColor = (rate) =>
    rate <= 5 ? 'var(--green)' : rate <= 10 ? '#f97316' : 'var(--red)';
  const qualityScore = Math.round(((parseFloat(satisfactionSummary.average_quality_rating || 0) || 0) / 5) * 100);
  const firstPassYield = Math.max(0, 100 - (data?.reworkRate ?? 0));
  const printSuccessRate = Math.max(0, 100 - (data?.failedPrintRate ?? 0));

  return (
    <div className="page">
      <Sidebar />
      <div className="main-content">
        <div className="page-header">
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginBottom: '0.25rem' }}>
              Dashboards / Performance Dashboard
            </div>
            <h1 style={{ fontSize: '1.3rem', fontFamily: 'var(--font-heading)' }}>Performance Dashboard</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
              Archived requests are included in historical KPI calculations and are considered completed requests.
            </p>
          </div>
          <GlobalFilterToolbar dashboard="performance" />
        </div>

        <div className="page-body">
          {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
              <span className="spinner" style={{ width: 32, height: 32 }}/>
            </div>
          ) : (
            <>
              {/* KPI row */}
              <div className="grid-4" style={{ marginBottom: '1.5rem' }}>
                <div className="kpi-card">
                  <div className="kpi-value" style={{ color: 'var(--green)' }}>
                    {data?.completedRequests ?? 0}
                  </div>
                  <div className="kpi-label">Completed Requests</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    Including archived requests
                  </div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-value" style={{ color: 'var(--blue)' }}>
                    {data?.avgLeadTimeHours
                      ? `${data.avgLeadTimeHours}h`
                      : <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>No data</span>}
                  </div>
                  <div className="kpi-label">Avg. Lead Time</div>
                  {data?.avgLeadTimeHours > 0 && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      Approximately {(data.avgLeadTimeHours / 24).toFixed(1)} days
                    </div>
                  )}
                </div>

                <div className="kpi-card">
                  <div className="kpi-value" style={{ color: onTimeColor(data?.onTimeRate ?? 0) }}>
                    {data?.onTimeRate ?? 0}%
                  </div>
                  <div className="kpi-label">On-Time Delivery</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    vs approved/requested due date
                  </div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-value" style={{
                    color: (data?.reworkRate ?? 0) > 10 ? 'var(--red)' : 'var(--green)'
                  }}>
                    {data?.reworkRate ?? 0}%
                  </div>
                  <div className="kpi-label">Rework Rate</div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-value" style={{
                    color: (data?.failedPrintRate ?? 0) > 5 ? 'var(--red)' : 'var(--green)'
                  }}>
                    {data?.failedPrintRate ?? 0}%
                  </div>
                  <div className="kpi-label">Failed Print Rate</div>
                </div>
              </div>

              {/* Charts row */}
              <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
                {/* Completed per week */}
                <div className="card">
                  <h3 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1rem' }}>
                    Completed Requests per Week
                    <span style={{ fontSize: '0.7rem', fontWeight: 400, marginLeft: '0.5rem', color: 'var(--accent)' }}>
                      (includes archived)
                    </span>
                  </h3>
                  {weeklyData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={weeklyData} barSize={24}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
                        <XAxis dataKey="week" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false}/>
                        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={28} allowDecimals={false}/>
                        <Tooltip content={<CustomTooltip/>}/>
                        <Bar dataKey="completed" fill="var(--accent)" radius={[4,4,0,0]} name="Completed (including archived)"/>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="empty-state" style={{ padding: '2rem' }}>
                      <p>No completed requests in this period</p>
                      <p style={{ fontSize: '0.75rem', marginTop: '0.35rem', color: 'var(--text-muted)' }}>
                        Complete requests to see data here
                      </p>
                    </div>
                  )}
                </div>

                {/* Quality metrics gauges */}
                <div className="card">
                  <h3 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1.25rem' }}>
                    Quality Metrics
                  </h3>
                  <GaugeBar
                    value={data?.onTimeRate ?? 0}
                    label="On-Time Delivery Rate"
                    color={onTimeColor(data?.onTimeRate ?? 0)}
                  />
                  <GaugeBar
                    value={qualityScore}
                    label="Quality Score"
                    color={qualityColor(qualityScore)}
                  />
                  <GaugeBar
                    value={firstPassYield}
                    label="First-Pass Yield"
                    color={qualityColor(firstPassYield)}
                  />
                  <GaugeBar
                    value={data?.reworkRate ?? 0}
                    fillValue={Math.max(0, 100 - (data?.reworkRate ?? 0))}
                    label="Rework Rate"
                    color={inverseQualityColor(data?.reworkRate ?? 0)}
                  />
                  <GaugeBar
                    value={data?.failedPrintRate ?? 0}
                    fillValue={Math.max(0, 100 - (data?.failedPrintRate ?? 0))}
                    label="Defect Rate"
                    color={inverseQualityColor(data?.failedPrintRate ?? 0)}
                  />
                  <GaugeBar
                    value={printSuccessRate}
                    label="Print Success Rate"
                    color={qualityColor(printSuccessRate)}
                  />
                </div>
              </div>

              <div className="card" style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1rem' }}>
                  Requester Satisfaction
                </h3>
                <div className="grid-3" style={{ marginBottom: '1.25rem' }}>
                  <MiniMetric label="Average Satisfaction" value={`${number(satisfactionSummary.average_satisfaction_score, 2)} / 5`} color="var(--green)" />
                  <MiniMetric label="Quality Rating" value={`${number(satisfactionSummary.average_quality_rating, 2)} / 5`} color="var(--blue)" />
                  <MiniMetric label="Delivery Rating" value={`${number(satisfactionSummary.average_delivery_rating, 2)} / 5`} color="var(--yellow)" />
                  <MiniMetric label="Communication Rating" value={`${number(satisfactionSummary.average_communication_rating, 2)} / 5`} color="var(--cyan)" />
                  <MiniMetric label="Recommendation Rate" value={`${number(satisfactionSummary.recommendation_rate, 1)}%`} color="var(--accent)" />
                  <MiniMetric label="Survey Participation" value={`${number(satisfactionSummary.survey_participation_rate, 1)}%`} color="var(--text-primary)" />
                </div>
                <div className="grid-2">
                  <div>
                    <h4 style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Satisfaction Trend</h4>
                    <ResponsiveContainer width="100%" height={210}>
                      <LineChart data={satisfactionTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
                        <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false}/>
                        <YAxis domain={[0, 5]} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={28}/>
                        <Tooltip content={<CustomTooltip/>}/>
                        <Line type="monotone" dataKey="average" stroke="var(--green)" strokeWidth={2} name="Avg Satisfaction"/>
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div>
                    <h4 style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Satisfaction Distribution</h4>
                    <ResponsiveContainer width="100%" height={210}>
                      <BarChart data={satisfactionDistribution} barSize={26}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
                        <XAxis dataKey="rating" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false}/>
                        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={28} allowDecimals={false}/>
                        <Tooltip content={<CustomTooltip/>}/>
                        <Bar dataKey="count" fill="var(--accent)" radius={[4,4,0,0]} name="Responses"/>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
                <DashboardDataTable
                  title="Satisfaction by Site"
                  rows={satisfaction.bySite || []}
                  filename="satisfaction-by-site.csv"
                  columns={[
                    { label: 'Site', key: 'site' },
                    { label: 'Average Satisfaction', key: 'average_satisfaction', render: row => `${number(row.average_satisfaction, 2)} / 5` },
                    { label: 'Responses', key: 'responses' },
                  ]}
                />
                <DashboardDataTable
                  title="Satisfaction by Technician"
                  rows={satisfaction.byTechnician || []}
                  filename="satisfaction-by-technician.csv"
                  columns={[
                    { label: 'Technician', key: 'technician' },
                    { label: 'Average Satisfaction', key: 'average_satisfaction', render: row => `${number(row.average_satisfaction, 2)} / 5` },
                    { label: 'Responses', key: 'responses' },
                  ]}
                />
              </div>

              <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
                <div className="card">
                  <h3 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1rem' }}>
                    Rework Analysis
                  </h3>
                  <div className="grid-2">
                    <MiniMetric label="Rework Requests" value={parseInt(data?.reworkAnalysis?.rework_requests || 0, 10)} color="var(--accent)" />
                    <MiniMetric label="Rework Cost" value={money(data?.reworkAnalysis?.rework_cost)} color="var(--red)" />
                    <MiniMetric label="Rework Material Used" value={grams(data?.reworkAnalysis?.rework_material_used)} color="var(--yellow)" />
                    <MiniMetric label="Rework Print Time" value={hours(data?.reworkAnalysis?.rework_print_time)} color="var(--blue)" />
                  </div>
                </div>

                <div className="card">
                  <h3 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1rem' }}>
                    Material Consumption
                  </h3>
                  <div className="grid-2" style={{ marginBottom: '1rem' }}>
                    <MiniMetric label="Total Material Used" value={grams(data?.materialConsumption?.total_material_used)} color="var(--cyan)" />
                    <MiniMetric label="Avg Material / Request" value={grams(data?.materialConsumption?.average_material_per_request)} color="var(--green)" />
                  </div>
                  {materialByType.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                      {materialByType.map((row, i) => {
                        const max = Math.max(...materialByType.map(x => parseFloat(x.material_used || 0)), 1);
                        const width = Math.max(4, (parseFloat(row.material_used || 0) / max) * 100);
                        return (
                          <div key={row.material_type || i}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.25rem' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>{row.material_type}</span>
                              <strong>{grams(row.material_used)}</strong>
                            </div>
                            <div style={{ height: 7, background: 'var(--bg-hover)', borderRadius: 4, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${width}%`, background: COLORS[i % COLORS.length] }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="empty-state" style={{ padding: '1rem' }}><p>No material consumption in this period</p></div>
                  )}
                </div>
              </div>

              <div className="card" style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1rem' }}>
                  Cost Trend
                </h3>
                {costTrendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={costTrendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
                      <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false}/>
                      <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={48}/>
                      <Tooltip content={<CustomTooltip/>}/>
                      <Legend wrapperStyle={{ fontSize: '0.78rem' }}/>
                      <Line type="monotone" dataKey="actualCost" stroke="var(--accent)" strokeWidth={2} name="Actual Cost" dot={{ r: 4, fill: 'var(--accent)' }}/>
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="empty-state" style={{ padding: '2rem' }}><p>No cost trend data in this period</p></div>
                )}
              </div>

              <div className="dashboard-chart-grid" style={{ marginBottom: '1.5rem' }}>
                <DashboardDataTable
                  title="Printer Performance"
                  rows={printerPerformance}
                  filename="printer-performance.csv"
                  columns={[
                    { label: 'Printer', key: 'printer' },
                    { label: 'Requests Completed', key: 'requests_completed' },
                    { label: 'Print Hours', key: 'print_hours', render: row => hours(row.print_hours) },
                    { label: 'Failed Prints', key: 'failed_prints', render: row => <span style={{ color: parseInt(row.failed_prints || 0, 10) > 0 ? 'var(--red)' : 'var(--text-secondary)' }}>{parseInt(row.failed_prints || 0, 10)}</span> },
                    { label: 'Success Rate', key: 'success_rate', render: row => <span style={{ color: row.success_rate >= 90 ? 'var(--green)' : row.success_rate >= 75 ? 'var(--yellow)' : 'var(--red)', fontWeight: 700 }}>{row.success_rate}%</span> },
                    { label: 'Rework Rate', key: 'rework_rate', render: row => `${row.rework_rate || 0}%` },
                  ]}
                />
                <DashboardDataTable
                  title="Technician Performance"
                  rows={productionTechData}
                  filename="technician-performance.csv"
                  columns={[
                    { label: 'Technician', key: 'technician' },
                    { label: 'Actual Print Hours', key: 'actual_print_hours', render: row => hours(row.actual_print_hours) },
                    { label: 'Material Consumed', key: 'material_consumed', render: row => grams(row.material_consumed) },
                    { label: 'Actual Cost Managed', key: 'actual_cost_managed', render: row => money(row.actual_cost_managed) },
                  ]}
                />
              </div>

              {/* Backlog aging */}
              {agingData.length > 0 && (
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1rem' }}>
                    Open Backlog Aging
                  </h3>
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    {agingData.map((bucket, i) => {
                      const colors = ['var(--green)', 'var(--yellow)', 'var(--accent)', 'var(--red)'];
                      return (
                        <div key={i} style={{
                          flex: '1 1 160px', background: 'var(--bg-hover)',
                          borderRadius: 8, padding: '1rem 1.25rem',
                          border: '1px solid var(--border)',
                          borderTop: `3px solid ${colors[i % colors.length]}`,
                        }}>
                          <div style={{ fontSize: '1.8rem', fontFamily: 'var(--font-heading)', fontWeight: 800, color: colors[i % colors.length] }}>
                            {bucket.count}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                            {bucket.age_bucket}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Technician performance table */}
              {techData.length > 0 && (
                <div className="card">
                  <h3 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1rem' }}>
                    Technician Performance
                  </h3>
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Technician</th>
                          <th>Completed</th>
                          <th>On-Time</th>
                          <th>On-Time %</th>
                          <th>Avg Duration</th>
                          <th>Rework</th>
                        </tr>
                      </thead>
                      <tbody>
                        {techData.map((t, i) => {
                          const otPct = t.completed > 0
                            ? Math.round((parseInt(t.on_time || 0) / parseInt(t.completed)) * 100)
                            : 0;
                          return (
                            <tr key={i}>
                              <td style={{ fontWeight: 600 }}>{t.technician}</td>
                              <td style={{ color: 'var(--green)', fontWeight: 600 }}>{t.completed}</td>
                              <td>{t.on_time || 0}</td>
                              <td>
                                <span style={{
                                  color: otPct >= 80 ? 'var(--green)' : otPct >= 60 ? 'var(--yellow)' : 'var(--red)',
                                  fontWeight: 600,
                                }}>{otPct}%</span>
                              </td>
                              <td style={{ color: 'var(--text-secondary)' }}>
                                {t.avg_duration_h ? `${t.avg_duration_h}h` : '—'}
                              </td>
                              <td style={{ color: t.rework > 0 ? 'var(--yellow)' : 'var(--text-muted)' }}>
                                {t.rework || 0}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
