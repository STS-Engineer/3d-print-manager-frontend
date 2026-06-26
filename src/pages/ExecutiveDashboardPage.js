import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import api from '../utils/api';
import Sidebar from '../components/common/Sidebar';
import {
  ChartPanel,
  DashboardDataTable,
  DashboardHeader,
  DashboardKpiCard,
  DashboardKpiGrid,
  DashboardSection,
} from '../components/common/DashboardShell';
import { useGlobalFilters } from '../context/GlobalFilterContext';
import { buildDashboardQuery } from '../utils/dashboardFilters';

const num = (value, digits = 0) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n.toFixed(digits) : (0).toFixed(digits);
};
const money = (value) => `${num(value, 2)} EUR`;
const pct = (value) => `${num(value, 1)}%`;
const hours = (value) => `${num(value, 1)} h`;
const grams = (value) => `${num(value, 0)} g`;

const TooltipBox = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 6, padding: '0.6rem 0.85rem', fontSize: '0.8rem' }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{label}</div>
      {payload.map((p, i) => <div key={i} style={{ color: p.color || 'var(--accent)' }}>{p.name}: <strong>{p.value}</strong></div>)}
    </div>
  );
};

const download = async (endpoint, filename) => {
  const response = await api.get(endpoint, { responseType: 'blob' });
  const blob = new Blob([response.data], { type: response.headers['content-type'] || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export default function ExecutiveDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState('90d');
  const { filters } = useGlobalFilters();
  const navigate = useNavigate();
  const query = useMemo(() => buildDashboardQuery(filters), [filters]);

  useEffect(() => {
    setLoading(true);
    setError('');
    const suffix = query ? `?${query}` : '';
    api.get(`/dashboard/executive${suffix}`)
      .then(res => { setData(res.data); setLoading(false); })
      .catch(err => {
        setError(err.response?.data?.error || 'Failed to load executive dashboard');
        setLoading(false);
      });
  }, [query]);

  const trend = data?.trends?.[period] || {};
  const requestTrend = (trend.requestVolumeTrend || []).map(row => ({
    bucket: new Date(row.bucket).toLocaleDateString('fr-FR', period === '12m' ? { month: 'short', year: '2-digit' } : { day: '2-digit', month: 'short' }),
    created: parseInt(row.requests_created || 0, 10),
    completed: parseInt(row.requests_completed || 0, 10),
    rejected: parseInt(row.requests_rejected || 0, 10),
  }));
  const costTrend = (trend.costTrend || []).map(row => ({
    bucket: new Date(row.bucket).toLocaleDateString('fr-FR', period === '12m' ? { month: 'short', year: '2-digit' } : { day: '2-digit', month: 'short' }),
    actual: parseFloat(row.actual_cost || 0),
    material: parseFloat(row.material_cost || 0),
    machine: parseFloat(row.machine_cost || 0),
  }));
  const inventoryTrend = (trend.inventoryTrend || []).map(row => ({
    bucket: new Date(row.bucket).toLocaleDateString('fr-FR', period === '12m' ? { month: 'short', year: '2-digit' } : { day: '2-digit', month: 'short' }),
    consumption: parseFloat(row.material_consumption || 0),
    lowStock: parseInt(row.low_stock_events || 0, 10),
  }));
  const capacityTrend = (trend.capacityTrend || []).map(row => ({
    bucket: new Date(row.bucket).toLocaleDateString('fr-FR', period === '12m' ? { month: 'short', year: '2-digit' } : { day: '2-digit', month: 'short' }),
    demand: parseFloat(row.forecast_demand || 0),
    capacity: parseFloat(row.forecast_capacity || 0),
  }));

  const exportSuffix = query ? `?${query}&` : '?';
  const actions = (
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
      <button className="btn btn-secondary btn-sm" onClick={() => download(`/export/executive/report${exportSuffix}format=pdf`, 'executive-report.pdf')}>Report PDF</button>
      <button className="btn btn-secondary btn-sm" onClick={() => download(`/export/executive/report${exportSuffix}format=xlsx`, 'executive-report.xlsx')}>Report Excel</button>
      <button className="btn btn-secondary btn-sm" onClick={() => download(`/export/executive/kpis${query ? `?${query}` : ''}`, 'executive-kpis.xlsx')}>KPI Export</button>
      <button className="btn btn-secondary btn-sm" onClick={() => download(`/export/executive/forecast${query ? `?${query}` : ''}`, 'executive-forecast.xlsx')}>Forecast Export</button>
    </div>
  );

  const p = data?.productionOverview || {};
  const f = data?.financialOverview || {};
  const d = data?.deliveryPerformance || {};
  const c = data?.capacityOverview || {};
  const i = data?.inventoryOverview || {};
  const q = data?.qualityOverview || {};
  const forecast = data?.forecasting || {};

  return (
    <div className="page">
      <Sidebar />
      <div className="main-content">
        <DashboardHeader
          title="Executive Dashboard"
          description="Strategic view of production, cost, delivery, capacity, inventory, quality, risks, and demand forecast."
          dashboard="executive"
          actions={actions}
        />

        <div className="page-body">
          {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
              <span className="spinner" style={{ width: 32, height: 32 }}/>
            </div>
          ) : (
            <>
              <DashboardSection title="Production Overview" actions={<button className="btn btn-ghost btn-sm" onClick={() => navigate('/dashboard')}>Operational Dashboard</button>}>
                <DashboardKpiGrid>
                  <DashboardKpiCard label="Total Requests" value={p.total_requests || 0} tone="neutral" />
                  <DashboardKpiCard label="Completed Requests" value={p.completed_requests || 0} tone="good" />
                  <DashboardKpiCard label="Active Requests" value={p.active_requests || 0} tone="info" />
                  <DashboardKpiCard label="Overdue Requests" value={p.overdue_requests || 0} tone={(p.overdue_requests || 0) > 0 ? 'danger' : 'good'} />
                  <DashboardKpiCard label="Rejected Requests" value={p.rejected_requests || 0} tone="warning" />
                  <DashboardKpiCard label="Blocked Requests" value={p.blocked_requests || 0} tone={(p.blocked_requests || 0) > 0 ? 'danger' : 'neutral'} />
                </DashboardKpiGrid>
              </DashboardSection>

              <DashboardSection title="Financial Overview" actions={<button className="btn btn-ghost btn-sm" onClick={() => navigate('/dashboard/costs')}>Cost Dashboard</button>}>
                <DashboardKpiGrid>
                  <DashboardKpiCard label="Actual Production Cost" value={money(f.actualProductionCost)} tone="info" />
                  <DashboardKpiCard label="Average Cost Per Request" value={money(f.averageCostPerRequest)} tone="neutral" />
                  <DashboardKpiCard label="Material Consumption Cost" value={money(f.materialConsumptionCost)} tone="info" />
                  <DashboardKpiCard label="Labor Cost" value={money(f.laborCost)} tone="neutral" />
                  <DashboardKpiCard label="Machine Cost" value={money(f.machineCost)} tone="info" />
                </DashboardKpiGrid>
              </DashboardSection>

              <DashboardSection title="Delivery, Capacity, Inventory & Quality">
                <DashboardKpiGrid>
                  <DashboardKpiCard label="On-Time Delivery Rate" value={pct(d.on_time_delivery_rate)} helper={`Lead time ${hours(d.average_lead_time)}`} tone={parseFloat(d.on_time_delivery_rate || 0) >= 85 ? 'good' : 'warning'} />
                  <DashboardKpiCard label="Approval Time" value={hours(d.average_approval_time)} helper={`Customer confirmation ${hours(d.average_customer_confirmation_time)}`} tone="info" />
                  <DashboardKpiCard label="Printer Utilization" value={pct(c.printer_utilization)} helper={`Available ${pct(c.available_capacity)}`} tone="info" />
                  <DashboardKpiCard label="Technician Utilization" value={pct(c.technician_utilization)} helper={`Reserved ${grams(c.reserved_capacity)}`} tone="warning" />
                  <DashboardKpiCard label="Low Stock Materials" value={i.low_stock_materials || 0} helper={`Avg coverage ${i.average_days_of_coverage ? `${num(i.average_days_of_coverage, 1)} days` : 'N/A'}`} tone={(i.low_stock_materials || 0) > 0 ? 'danger' : 'good'} />
                  <DashboardKpiCard label="Top Consumed Material" value={i.top_consumed_material || 'N/A'} helper={`${i.total_materials || 0} total materials`} tone="neutral" />
                  <DashboardKpiCard label="Pass Rate" value={pct(q.pass_rate)} helper={`QC success ${pct(q.quality_check_success_rate)}`} tone={parseFloat(q.pass_rate || 0) >= 90 ? 'good' : 'warning'} />
                  <DashboardKpiCard label="Rework Rate" value={pct(q.rework_rate)} helper={`Rejected ${pct(q.rejected_rate)}`} tone={parseFloat(q.rework_rate || 0) > 10 ? 'danger' : 'good'} />
                </DashboardKpiGrid>
              </DashboardSection>

              <DashboardSection
                title="Executive Trends"
                actions={
                  <div className="tabs" style={{ margin: 0 }}>
                    {['30d','90d','12m'].map(key => (
                      <button key={key} className={`tab ${period === key ? 'active' : ''}`} onClick={() => setPeriod(key)}>
                        {key === '30d' ? 'Last 30 Days' : key === '90d' ? 'Last 90 Days' : 'Last 12 Months'}
                      </button>
                    ))}
                  </div>
                }
              >
                <div className="dashboard-chart-grid">
                  <ChartPanel title="Request Volume Trend">
                    <ResponsiveContainer width="100%" height={240}>
                      <LineChart data={requestTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
                        <XAxis dataKey="bucket" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false}/>
                        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false}/>
                        <Tooltip content={<TooltipBox/>}/>
                        <Line type="monotone" dataKey="created" stroke="var(--blue)" name="Created" strokeWidth={2}/>
                        <Line type="monotone" dataKey="completed" stroke="var(--green)" name="Completed" strokeWidth={2}/>
                        <Line type="monotone" dataKey="rejected" stroke="var(--red)" name="Rejected" strokeWidth={2}/>
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartPanel>
                  <ChartPanel title="Cost Trend">
                    <ResponsiveContainer width="100%" height={240}>
                      <LineChart data={costTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
                        <XAxis dataKey="bucket" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false}/>
                        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false}/>
                        <Tooltip content={<TooltipBox/>}/>
                        <Line type="monotone" dataKey="actual" stroke="var(--accent)" name="Actual" strokeWidth={2}/>
                        <Line type="monotone" dataKey="material" stroke="var(--green)" name="Material" strokeWidth={2}/>
                        <Line type="monotone" dataKey="machine" stroke="var(--yellow)" name="Machine" strokeWidth={2}/>
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartPanel>
                  <ChartPanel title="Inventory Trend">
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={inventoryTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
                        <XAxis dataKey="bucket" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false}/>
                        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false}/>
                        <Tooltip content={<TooltipBox/>}/>
                        <Bar dataKey="consumption" fill="var(--green)" name="Material Consumption" radius={[4,4,0,0]}/>
                        <Bar dataKey="lowStock" fill="var(--red)" name="Low Stock Events" radius={[4,4,0,0]}/>
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartPanel>
                  <ChartPanel title="Capacity Trend">
                    <ResponsiveContainer width="100%" height={240}>
                      <LineChart data={capacityTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
                        <XAxis dataKey="bucket" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false}/>
                        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false}/>
                        <Tooltip content={<TooltipBox/>}/>
                        <Line type="monotone" dataKey="demand" stroke="var(--yellow)" name="Forecast Demand" strokeWidth={2}/>
                        <Line type="monotone" dataKey="capacity" stroke="var(--blue)" name="Forecast Capacity" strokeWidth={2}/>
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartPanel>
                </div>
              </DashboardSection>

              <DashboardSection title="Forecasting" actions={<button className="btn btn-ghost btn-sm" onClick={() => navigate('/planning')}>Planning</button>}>
                <DashboardKpiGrid>
                  <DashboardKpiCard label="Next 30 Days Requests" value={forecast.requestForecast?.next30Days?.expectedRequests || 0} helper={`Workload ${hours(forecast.requestForecast?.next30Days?.expectedWorkload)}`} tone="info" />
                  <DashboardKpiCard label="Next 90 Days Requests" value={forecast.requestForecast?.next90Days?.expectedRequests || 0} helper={`Completions ${forecast.requestForecast?.next90Days?.expectedCompletions || 0}`} tone="info" />
                  <DashboardKpiCard label="Next 12 Months Requests" value={forecast.requestForecast?.next12Months?.expectedRequests || 0} helper={`Workload ${hours(forecast.requestForecast?.next12Months?.expectedWorkload)}`} tone="neutral" />
                  <DashboardKpiCard label="Projected Material Consumption" value={grams(forecast.capacityForecast?.projectedMaterialConsumption)} helper={`Risk ${forecast.capacityForecast?.capacityRiskLevel || 'Low'}`} tone={forecast.capacityForecast?.capacityRiskLevel === 'High' ? 'danger' : 'warning'} />
                  <DashboardKpiCard label="Predicted Shortages" value={forecast.inventoryForecast?.predictedShortages || 0} helper={`Stockout ${forecast.inventoryForecast?.daysUntilStockout || 'N/A'} days`} tone={(forecast.inventoryForecast?.predictedShortages || 0) > 0 ? 'danger' : 'good'} />
                </DashboardKpiGrid>
              </DashboardSection>

              <DashboardSection title="Executive Risks" actions={<button className="btn btn-ghost btn-sm" onClick={() => navigate('/dashboard/resources')}>Resource Dashboard</button>}>
                <DashboardDataTable
                  title="Risk Center"
                  rows={data.executiveRisks || []}
                  filename="executive-risks.csv"
                  columns={[
                    { label: 'Severity', key: 'severity' },
                    { label: 'Affected Area', key: 'affectedArea' },
                    { label: 'Metric', key: 'metric' },
                    { label: 'Recommended Action', key: 'recommendedAction' },
                  ]}
                  pageSize={10}
                />
              </DashboardSection>

              <DashboardSection title="Top Lists">
                <div className="dashboard-chart-grid">
                  <DashboardDataTable title="Top 10 Most Expensive Requests" rows={data.topLists?.mostExpensiveRequests || []} filename="top-expensive-requests.csv" onRowClick={row => navigate(`/requests/${row.id}`)} columns={[
                    { label: 'Request', key: 'request_number' },
                    { label: 'Title', key: 'title' },
                    { label: 'Cost', key: 'value', render: row => money(row.value) },
                  ]}/>
                  <DashboardDataTable title="Top 10 Longest Prints" rows={data.topLists?.longestPrints || []} filename="top-longest-prints.csv" onRowClick={row => navigate(`/requests/${row.id}`)} columns={[
                    { label: 'Request', key: 'request_number' },
                    { label: 'Title', key: 'title' },
                    { label: 'Hours', key: 'value', render: row => hours(row.value) },
                  ]}/>
                  <DashboardDataTable title="Top 10 Most Consumed Materials" rows={data.topLists?.mostConsumedMaterials || []} filename="top-consumed-materials.csv" onRowClick={() => navigate('/inventory/transactions')} columns={[
                    { label: 'Material', key: 'label' },
                    { label: 'Quantity', key: 'value', render: row => `${num(row.value, 1)} ${row.unit || 'g'}` },
                  ]}/>
                  <DashboardDataTable title="Top 10 Most Utilized Printers" rows={data.topLists?.mostUtilizedPrinters || []} filename="top-printers.csv" columns={[
                    { label: 'Printer', key: 'label' },
                    { label: 'Requests', key: 'value' },
                  ]}/>
                  <DashboardDataTable title="Top 10 Most Active Technicians" rows={data.topLists?.mostActiveTechnicians || []} filename="top-technicians.csv" columns={[
                    { label: 'Technician', key: 'label' },
                    { label: 'Requests', key: 'value' },
                  ]}/>
                </div>
              </DashboardSection>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
