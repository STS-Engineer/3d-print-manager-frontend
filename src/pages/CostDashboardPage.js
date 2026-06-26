import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import api from '../utils/api';
import Sidebar from '../components/common/Sidebar';
import GlobalFilterToolbar from '../components/common/GlobalFilterToolbar';
import { DashboardDataTable } from '../components/common/DashboardShell';
import { useGlobalFilters } from '../context/GlobalFilterContext';
import { buildDashboardQuery } from '../utils/dashboardFilters';

const money = (value) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? `${n.toFixed(2)} €` : '0.00 €';
};

const percent = (value) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? `${n.toFixed(2)}%` : '0.00%';
};

const grams = (value) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? `${n.toFixed(0)} g` : '0 g';
};

const hours = (value) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? `${n.toFixed(1)}h` : '0.0h';
};

function KpiCard({ label, value, tone }) {
  return (
    <div className="card" style={{ padding: '1rem' }}>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>{label}</div>
      <div style={{ fontSize: '1.35rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: tone || 'var(--text-primary)' }}>{value}</div>
    </div>
  );
}

function MetricBox({ label, value, tone }) {
  return (
    <div style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem' }}>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>{label}</div>
      <div style={{ fontSize: '1.15rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: tone || 'var(--text-primary)' }}>{value}</div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 6, padding: '0.6rem 0.85rem', fontSize: '0.8rem' }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || 'var(--accent)', marginBottom: '0.15rem' }}>
          {p.name}: <strong>{money(p.value)}</strong>
        </div>
      ))}
    </div>
  );
};

function BreakdownSection({ title, rows }) {
  const max = Math.max(...rows.map(r => parseFloat(r.actualCostTotal || 0)), 1);
  return (
    <div className="card" style={{ padding: 0 }}>
      <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)' }}>
        <h3 style={{ fontSize: '0.9rem', fontFamily: 'var(--font-heading)' }}>{title}</h3>
      </div>
      <div style={{ padding: '1rem', display: 'grid', gridTemplateColumns: '1fr 1.25fr', gap: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {rows.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>No data</div>
          ) : rows.slice(0, 8).map(row => {
            const width = Math.max(4, (parseFloat(row.actualCostTotal || 0) / max) * 100);
            return (
              <div key={row.id || row.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.2rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{row.label}</span>
                  <strong>{money(row.actualCostTotal)}</strong>
                </div>
                <div style={{ height: 8, background: 'var(--bg-hover)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${width}%`, height: '100%', background: row.variance >= 0 ? 'var(--red)' : 'var(--green)' }}/>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>{title.replace('Cost per ', '')}</th>
                <th>Actual Cost Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id || row.label}>
                  <td style={{ fontWeight: 600 }}>{row.label}</td>
                  <td>{money(row.actualCostTotal)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan="4" style={{ color: 'var(--text-muted)' }}>No matching requests</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function CostDashboardPage() {
  const { filters } = useGlobalFilters();
  const [summary, setSummary] = useState(null);
  const [breakdowns, setBreakdowns] = useState({ bySite: [], byMaterial: [], byPrinter: [], byTechnician: [] });
  const [monthlyTrend, setMonthlyTrend] = useState([]);
  const [reworkCost, setReworkCost] = useState(null);
  const [costBreakdown, setCostBreakdown] = useState(null);
  const [topCostDrivers, setTopCostDrivers] = useState([]);
  const [loading, setLoading] = useState(true);

  const query = useMemo(() => buildDashboardQuery(filters), [filters]);
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const suffix = query ? `?${query}` : '';
      const [sum, site, material, printer, technician, trend, rework, components, drivers] = await Promise.all([
        api.get(`/dashboard/costs/summary${suffix}`),
        api.get(`/dashboard/costs/by-site${suffix}`),
        api.get(`/dashboard/costs/by-material${suffix}`),
        api.get(`/dashboard/costs/by-printer${suffix}`),
        api.get(`/dashboard/costs/by-technician${suffix}`),
        api.get(`/dashboard/costs/monthly-trend${suffix}`),
        api.get(`/dashboard/costs/rework${suffix}`),
        api.get(`/dashboard/costs/breakdown${suffix}`),
        api.get(`/dashboard/costs/top-drivers${suffix}`),
      ]);
      setSummary(sum.data);
      setBreakdowns({
        bySite: site.data,
        byMaterial: material.data,
        byPrinter: printer.data,
        byTechnician: technician.data,
      });
      setMonthlyTrend(trend.data || []);
      setReworkCost(rework.data || null);
      setCostBreakdown(components.data || null);
      setTopCostDrivers(drivers.data || []);
    } catch (err) {
      console.error('[Cost Dashboard] Fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const monthlyTrendData = monthlyTrend.map(row => ({
    month: row.month
      ? new Date(row.month).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
      : '?',
    actualCost: parseFloat(row.actualCostTotal || 0),
  }));

  return (
    <div className="page">
      <Sidebar />
      <div className="main-content">
        <div className="page-header">
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginBottom: '0.25rem' }}>
              Dashboards / Cost Dashboard
            </div>
            <h1 style={{ fontSize: '1.3rem', fontFamily: 'var(--font-heading)' }}>Cost Dashboard</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
              Actual production costs, including cumulative reworks
            </p>
          </div>
          <GlobalFilterToolbar dashboard="cost" />
        </div>

        <div className="page-body">
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
              <span className="spinner" style={{ width: 30, height: 30 }}/>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                <KpiCard label="Actual Cost Total" value={money(summary?.actualCostTotal)} />
                <KpiCard label="Avg Cost / Request" value={money(summary?.averageCostPerRequest)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                <KpiCard label="Average Material Cost" value={money(summary?.averageMaterialCost)} tone="var(--cyan)" />
                <KpiCard label="Average Machine Cost" value={money(summary?.averageMachineCost)} tone="var(--blue)" />
                <KpiCard label="Average Total Cost" value={money(summary?.averageTotalCost)} tone="var(--accent)" />
              </div>

              <div className="card" style={{ marginBottom: '1rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                <span>Last updated: <strong style={{ color: 'var(--text-primary)' }}>{summary?.lastUpdated ? new Date(summary.lastUpdated).toLocaleString('fr-FR') : '-'}</strong></span>
                <span>Requests analyzed: <strong style={{ color: 'var(--text-primary)' }}>{summary?.requestCount || 0}</strong></span>
                <span>Reworks included: <strong style={{ color: 'var(--text-primary)' }}>{summary?.reworkCount || 0}</strong></span>
              </div>

              <div className="card" style={{ marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '0.9rem', fontFamily: 'var(--font-heading)', marginBottom: '1rem' }}>Monthly Cost Trend</h3>
                {monthlyTrendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={monthlyTrendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
                      <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false}/>
                      <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={48}/>
                      <Tooltip content={<CustomTooltip/>}/>
                      <Legend wrapperStyle={{ fontSize: '0.78rem' }}/>
                      <Line type="monotone" dataKey="actualCost" stroke="var(--accent)" strokeWidth={2} name="Actual Cost" dot={{ r: 4, fill: 'var(--accent)' }}/>
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="empty-state" style={{ padding: '2rem' }}><p>No monthly cost trend data</p></div>
                )}
              </div>

              <div className="grid-2" style={{ marginBottom: '1rem' }}>
                <div className="card">
                  <h3 style={{ fontSize: '0.9rem', fontFamily: 'var(--font-heading)', marginBottom: '1rem' }}>Rework Cost</h3>
                  <div className="grid-3">
                    <MetricBox label="Total Rework Cost" value={money(reworkCost?.totalReworkCost)} tone="var(--red)" />
                    <MetricBox label="Rework Material Used" value={grams(reworkCost?.reworkMaterialUsed)} tone="var(--yellow)" />
                    <MetricBox label="Rework Print Hours" value={hours(reworkCost?.reworkPrintHours)} tone="var(--blue)" />
                  </div>
                </div>

                <div className="card">
                  <h3 style={{ fontSize: '0.9rem', fontFamily: 'var(--font-heading)', marginBottom: '1rem' }}>Cost Breakdown</h3>
                  <div className="grid-3">
                    <MetricBox label="Material Cost" value={money(costBreakdown?.materialCost)} tone="var(--cyan)" />
                    <MetricBox label="Print Time Cost" value={money(costBreakdown?.printTimeCost)} tone="var(--blue)" />
                    <MetricBox label="Fixed Cost" value={money(costBreakdown?.fixedCost)} tone="var(--purple)" />
                  </div>
                  <div
                    title={costBreakdown?.fixedCostSource || ''}
                    style={{ marginTop: '0.85rem', color: 'var(--text-muted)', fontSize: '0.76rem', lineHeight: 1.45 }}
                  >
                    Fixed Cost = {money(costBreakdown?.fixedCostUnit)} per request cost formula. {costBreakdown?.fixedCostFormula || ''}
                  </div>
                </div>
              </div>

              <div className="grid-2" style={{ marginBottom: '1rem' }}>
                <DashboardDataTable
                  title="Top Cost Materials"
                  rows={summary?.topCostMaterials || []}
                  filename="top-cost-materials.csv"
                  columns={[
                    { label: 'Material', key: 'label' },
                    { label: 'Cost', key: 'value', render: row => money(row.value) },
                  ]}
                />
                <DashboardDataTable
                  title="Top Cost Printers"
                  rows={summary?.topCostPrinters || []}
                  filename="top-cost-printers.csv"
                  columns={[
                    { label: 'Printer', key: 'label' },
                    { label: 'Cost', key: 'value', render: row => money(row.value) },
                  ]}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <DashboardDataTable
                  title="Top Cost Drivers"
                  rows={topCostDrivers}
                  filename="top-cost-drivers.csv"
                  columns={[
                    { label: 'Request ID', key: 'requestNumber', render: row => <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{row.requestNumber}</span> },
                    { label: 'Title', key: 'title' },
                    { label: 'Actual Cost', key: 'actualCost', render: row => money(row.actualCost) },
                  ]}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <BreakdownSection title="Cost per Site" rows={breakdowns.bySite} />
                <BreakdownSection title="Cost per Material" rows={breakdowns.byMaterial} />
                <BreakdownSection title="Cost per Printer" rows={breakdowns.byPrinter} />
                <BreakdownSection title="Cost per Technician" rows={breakdowns.byTechnician} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
