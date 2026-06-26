import React, { useEffect, useMemo, useState } from 'react';
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

const number = (value, decimals = 0) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n.toFixed(decimals) : (0).toFixed(decimals);
};
const grams = (value) => `${number(value, 0)} g`;
const hours = (value) => `${number(value, 1)}\u00a0h`;

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 6, padding: '0.6rem 0.85rem', fontSize: '0.8rem' }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{label}</div>
      {payload.map((p, i) => <div key={i} style={{ color: p.color || 'var(--accent)' }}>{p.name}: <strong>{p.value}</strong></div>)}
    </div>
  );
};

export default function ResourceDashboardPage() {
  const [data, setData] = useState(null);
  const [maintenance, setMaintenance] = useState(null);
  const [inventory, setInventory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { filters } = useGlobalFilters();
  const query = useMemo(() => buildDashboardQuery(filters), [filters]);

  useEffect(() => {
    setLoading(true);
    setError('');
    const suffix = query ? `?${query}` : '';
    Promise.all([
      api.get(`/dashboard/resources${suffix}`),
      api.get(`/inventory/analytics${suffix}`).catch(() => ({ data: null })),
      api.get(`/maintenance/summary${suffix}`).catch(() => ({ data: null })),
    ])
      .then(([resourceRes, inventoryRes, maintenanceRes]) => {
        setData(resourceRes.data);
        setInventory(inventoryRes.data);
        setMaintenance(maintenanceRes.data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.response?.data?.error || 'Failed to load resource dashboard');
        setLoading(false);
      });
  }, [query]);

  const materialTrend = (data?.materialConsumption?.trend || []).map(row => ({
    month: row.month ? new Date(row.month).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }) : '?',
    consumed: parseFloat(row.consumed || 0),
  }));
  const materialByType = data?.materialConsumption?.byMaterial || [];
  const forecast = data?.capacityForecast || {};
  const summary = data?.summary || {};
  const inventoryKpis = inventory?.kpis || {};

  return (
    <div className="page">
      <Sidebar />
      <div className="main-content">
        <DashboardHeader
          title="Resource Dashboard"
          description="Do we have enough capacity. Monitor printer load, technician load, material availability, and forecast demand."
          dashboard="resource"
        />

        <div className="page-body">
          {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
              <span className="spinner" style={{ width: 32, height: 32 }}/>
            </div>
          ) : (
            <>
              <DashboardKpiGrid>
                <DashboardKpiCard label="Printer Utilization" value={`${number(summary.printerUtilization, 1)}%`} helper="Used printer capacity" tone="info" />
                <DashboardKpiCard label="Technician Utilization" value={`${number(summary.technicianUtilization, 1)}%`} helper="Used technician capacity" tone="good" />
                <DashboardKpiCard label="Material Availability" value={summary.lowStockMaterials || 0} helper="Low stock materials" tone={(summary.lowStockMaterials || 0) > 0 ? 'danger' : 'good'} />
                <DashboardKpiCard label="Forecast Requests" value={summary.forecastRequests || 0} helper="Monthly average demand" tone="warning" />
              </DashboardKpiGrid>

              <DashboardSection title="Inventory KPIs" description="Stock, reservation, consumption, value, and coverage indicators.">
                <DashboardKpiGrid>
                  <DashboardKpiCard label="Total Materials" value={inventoryKpis.total_materials || 0} helper="Active material catalog" tone="neutral" />
                  <DashboardKpiCard label="Low Stock Materials" value={inventoryKpis.low_stock_materials || 0} helper="At or below minimum threshold" tone={(inventoryKpis.low_stock_materials || 0) > 0 ? 'danger' : 'good'} />
                  <DashboardKpiCard label="Reserved Material" value={grams(inventoryKpis.reserved_material_quantity)} helper="Reserved for planned work" tone="warning" />
                  <DashboardKpiCard label="Consumed This Month" value={grams(inventoryKpis.consumed_material_this_month)} helper="Posted inventory consumption" tone="info" />
                  <DashboardKpiCard label="Inventory Value" value={`${number(inventoryKpis.inventory_value, 2)} EUR`} helper="Configured material value" tone="neutral" />
                  <DashboardKpiCard label="Avg Coverage" value={inventoryKpis.average_days_of_coverage ? `${number(inventoryKpis.average_days_of_coverage, 1)} days` : 'N/A'} helper="Available stock / daily usage" tone="good" />
                </DashboardKpiGrid>
              </DashboardSection>

              <DashboardSection title="Maintenance" description="Preventive printer maintenance readiness and event history.">
                <DashboardKpiGrid>
                  <DashboardKpiCard label="Total Printers" value={maintenance?.totalPrinters || 0} helper="Active printer fleet" tone="neutral" />
                  <DashboardKpiCard label="Printers Due Soon" value={maintenance?.dueSoon || 0} helper="Maintenance due soon" tone={(maintenance?.dueSoon || 0) > 0 ? 'warning' : 'good'} />
                  <DashboardKpiCard label="Printers Overdue" value={maintenance?.overdue || 0} helper="Maintenance required" tone={(maintenance?.overdue || 0) > 0 ? 'danger' : 'good'} />
                  <DashboardKpiCard label="Maintenance Events" value={maintenance?.totalMaintenanceEvents || 0} helper="Total recorded events" tone="info" />
                </DashboardKpiGrid>
              </DashboardSection>

              <DashboardSection title="Capacity Charts" description="Workload and material trends updated by active filters.">
                <div className="dashboard-chart-grid">
                  <ChartPanel title="Printer Workload" description="Print hours by printer">
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={(data?.printerUtilization || []).map(row => ({ name: row.printer, hours: parseFloat(row.print_hours || 0) }))} layout="vertical" barSize={16}>
                        <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false}/>
                        <YAxis type="category" dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} width={130}/>
                        <Tooltip content={<CustomTooltip/>}/>
                        <Bar dataKey="hours" fill="var(--blue)" name="Print Hours" radius={[0,4,4,0]}/>
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartPanel>

                  <ChartPanel title="Technician Workload" description="Print hours by technician">
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={(data?.technicianUtilization || []).map(row => ({ name: row.technician, hours: parseFloat(row.print_hours || 0) }))} layout="vertical" barSize={16}>
                        <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false}/>
                        <YAxis type="category" dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} width={130}/>
                        <Tooltip content={<CustomTooltip/>}/>
                        <Bar dataKey="hours" fill="var(--green)" name="Print Hours" radius={[0,4,4,0]}/>
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartPanel>

                  <ChartPanel title="Material Consumption" description="Consumption by material">
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={materialByType.map(row => ({ name: row.material, consumed: parseFloat(row.consumed || 0) }))} layout="vertical" barSize={16}>
                        <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false}/>
                        <YAxis type="category" dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} width={130}/>
                        <Tooltip content={<CustomTooltip/>}/>
                        <Bar dataKey="consumed" fill="var(--yellow)" name="Material Used (g)" radius={[0,4,4,0]}/>
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartPanel>

                  <ChartPanel title="Capacity Forecast" description="Monthly material trend">
                    <ResponsiveContainer width="100%" height={240}>
                      <LineChart data={materialTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
                        <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false}/>
                        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={44}/>
                        <Tooltip content={<CustomTooltip/>}/>
                        <Line type="monotone" dataKey="consumed" stroke="var(--accent)" strokeWidth={2} name="Material Used (g)" dot={{ r: 4, fill: 'var(--accent)' }}/>
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartPanel>

                  <ChartPanel title="Consumption By Type" description="Material usage grouped by type">
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={(inventory?.consumptionByMaterialType || []).map(row => ({ name: row.material_type, consumed: parseFloat(row.consumed || 0) }))} layout="vertical" barSize={16}>
                        <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false}/>
                        <YAxis type="category" dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} width={120}/>
                        <Tooltip content={<CustomTooltip/>}/>
                        <Bar dataKey="consumed" fill="var(--blue)" name="Material Used (g)" radius={[0,4,4,0]}/>
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartPanel>

                  <ChartPanel title="Consumption By Site" description="Material usage grouped by site">
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={(inventory?.consumptionBySite || []).map(row => ({ name: row.site, consumed: parseFloat(row.consumed || 0) }))} layout="vertical" barSize={16}>
                        <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false}/>
                        <YAxis type="category" dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} width={120}/>
                        <Tooltip content={<CustomTooltip/>}/>
                        <Bar dataKey="consumed" fill="var(--green)" name="Material Used (g)" radius={[0,4,4,0]}/>
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartPanel>
                </div>
              </DashboardSection>

              <DashboardSection title="Resource Details" description="Search, sort, paginate, and export resource tables.">
                <div className="dashboard-chart-grid">
                  <DashboardDataTable
                    title="Printer Utilization"
                    rows={data?.printerUtilization || []}
                    filename="printer-utilization.csv"
                    columns={[
                      { label: 'Printer', key: 'printer' },
                      { label: 'Utilization', key: 'utilization', render: row => `${number(row.utilization, 1)}%` },
                      { label: 'Print Hours', key: 'print_hours', render: row => hours(row.print_hours) },
                      { label: 'Active Jobs', key: 'active_jobs' },
                    ]}
                  />
                  <DashboardDataTable
                    title="Technician Utilization"
                    rows={data?.technicianUtilization || []}
                    filename="technician-utilization.csv"
                    columns={[
                      { label: 'Technician', key: 'technician' },
                      { label: 'Utilization', key: 'utilization', render: row => `${number(row.utilization, 1)}%` },
                      { label: 'Assigned Requests', key: 'assigned_requests' },
                      { label: 'Print Hours', key: 'print_hours', render: row => hours(row.print_hours) },
                    ]}
                  />
                  <DashboardDataTable
                    title="Stock Risk"
                    rows={data?.stockRisk || []}
                    filename="stock-risk.csv"
                    columns={[
                      { label: 'Material', key: 'material' },
                      { label: 'Remaining Quantity', key: 'remaining_quantity', render: row => `${number(row.remaining_quantity, 0)} ${row.unit}` },
                      { label: 'Risk', key: 'risk_level', render: row => row.risk_level || 'red' },
                      { label: 'Avg Daily Usage', key: 'avg_daily_consumption', render: row => `${number(row.avg_daily_consumption, 1)} ${row.unit}/day` },
                      { label: 'Days of Coverage', key: 'days_of_coverage', render: row => row.days_of_coverage === null ? 'No usage history' : `${number(row.days_of_coverage, 1)} days` },
                    ]}
                  />
                  <div className="dashboard-panel">
                    <div className="dashboard-panel-header"><h3>Capacity Forecast</h3></div>
                    <DashboardKpiGrid className="capacity-forecast-kpi-grid">
                      <DashboardKpiCard label="Printer Capacity" value={hours(forecast.availablePrinterCapacity)} helper="Available Capacity" tone="info" />
                      <DashboardKpiCard label="Technician Capacity" value={hours(forecast.availableTechnicianCapacity)} helper="Available Capacity" tone="good" />
                      <DashboardKpiCard label="Resource Demand" value={hours(forecast.forecastResourceDemand)} helper="Forecast Demand" tone="warning" />
                      <DashboardKpiCard label="Forecast Requests" value={parseInt(forecast.forecastRequests || 0, 10)} helper="Monthly Forecast" tone="neutral" />
                    </DashboardKpiGrid>
                  </div>
                </div>
              </DashboardSection>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
