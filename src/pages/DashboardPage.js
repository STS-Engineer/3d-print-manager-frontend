import React, { useEffect, useMemo, useState } from 'react';
import {
  Bar, BarChart, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import api from '../utils/api';
import { STATUS_CONFIG, StatusBadge, PriorityBadge, formatDate } from '../utils/statusHelpers';
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

const toNumber = (value) => parseInt(value || 0, 10);
const grams = (value) => `${(Number(value || 0)).toLocaleString(undefined, { maximumFractionDigits: 1 })} g`;
const hours = (value) => `${(Number(value || 0)).toLocaleString(undefined, { maximumFractionDigits: 1 })} h`;
const money = (value) => `${(Number(value || 0)).toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })} EUR`;

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 6, padding: '0.6rem 0.85rem', fontSize: '0.8rem' }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.fill || p.color || 'var(--accent)' }}>{p.name}: <strong>{p.value}</strong></div>
      ))}
    </div>
  );
};

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [recentRequests, setRecentRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const { filters } = useGlobalFilters();
  const query = useMemo(() => buildDashboardQuery(filters), [filters]);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const suffix = query ? `?${query}` : '';
        const requestSuffix = query ? `&${query}` : '';
        const [dashRes, reqRes] = await Promise.all([
          api.get(`/dashboard/operational${suffix}`),
          api.get(`/requests?limit=8&sort=created_at&order=DESC${requestSuffix}`),
        ]);
        setData(dashRes.data);
        setRecentRequests(reqRes.data.requests || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [query]);

  const pieData = data?.statusSplit?.map(r => ({
    name: STATUS_CONFIG[r.status]?.label || r.status,
    value: toNumber(r.count),
    color: STATUS_CONFIG[r.status]?.color || '#64748b',
  })) || [];

  const priorityData = data?.prioritySplit?.map(r => ({
    name: r.priority ? r.priority.charAt(0).toUpperCase() + r.priority.slice(1) : 'Unknown',
    count: toNumber(r.count),
    fill: r.priority === 'critical' ? 'var(--red)' : r.priority === 'high' ? 'var(--yellow)' : r.priority === 'normal' ? 'var(--blue)' : 'var(--text-muted)',
  })) || [];

  if (loading && !data) {
    return (
      <div className="page"><Sidebar/>
        <div className="main-content" style={{ display:'flex', alignItems:'center', justifyContent:'center' }}>
          <span className="spinner" style={{ width: 36, height: 36 }}/>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <Sidebar />
      <div className="main-content">
        <DashboardHeader
          title="Operational Dashboard"
          description="What requires action today. Monitor open workload, overdue items, approvals, rework, and daily production schedules."
          dashboard="operational"
        />

        <div className="page-body">
          <DashboardKpiGrid>
            <DashboardKpiCard label="Open Requests" value={data?.kpiSummary?.open_count ?? 0} helper="Active workflow load" tone="info" />
            <DashboardKpiCard label="Overdue Requests" value={data?.overdueCount ?? 0} helper={(data?.overdueCount ?? 0) > 0 ? 'Requires action' : 'All on track'} tone={(data?.overdueCount ?? 0) > 0 ? 'danger' : 'good'} />
            <DashboardKpiCard label="Blocked Requests" value={data?.blockedCount ?? 0} helper="Waiting for intervention" tone={(data?.blockedCount ?? 0) > 0 ? 'danger' : 'good'} />
            <DashboardKpiCard label="Awaiting Approval" value={data?.awaitingApprovalCount ?? 0} helper="Needs production review" tone={(data?.awaitingApprovalCount ?? 0) > 0 ? 'warning' : 'good'} />
            <DashboardKpiCard label="Awaiting Confirmation" value={data?.awaitingRequesterConfirmationCount ?? 0} helper="Waiting requester response" tone={(data?.awaitingRequesterConfirmationCount ?? 0) > 0 ? 'warning' : 'good'} />
            <DashboardKpiCard label="Rework Required" value={data?.reworkRequiredCount ?? 0} helper="Quality loop active" tone={(data?.reworkRequiredCount ?? 0) > 0 ? 'danger' : 'good'} />
            <DashboardKpiCard label="Information Required" value={data?.informationRequiredCount ?? 0} helper="Waiting for requester input" tone={(data?.informationRequiredCount ?? 0) > 0 ? 'warning' : 'good'} />
            <DashboardKpiCard label="Rejected" value={data?.rejectedCount ?? 0} helper="Rejected workflow outcomes" tone={(data?.rejectedCount ?? 0) > 0 ? 'danger' : 'good'} />
          </DashboardKpiGrid>

          <DashboardSection title="Operations Overview" description="Status and priority mix for the active workload.">
            <div className="dashboard-chart-grid">
              <ChartPanel title="Status Distribution" description="Current open request distribution">
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={pieData} cx="45%" cy="50%" innerRadius={58} outerRadius={88} dataKey="value" paddingAngle={2}>
                        {pieData.map((entry, i) => <Cell key={i} fill={entry.color}/>)}
                      </Pie>
                      <Tooltip content={<CustomTooltip/>}/>
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '0.75rem' }}/>
                    </PieChart>
                  </ResponsiveContainer>
                ) : <div className="empty-state"><p>No data yet</p></div>}
              </ChartPanel>

              <ChartPanel title="Priority Requests" description="Request priority split">
                {priorityData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={priorityData} barSize={28}>
                      <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false}/>
                      <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={28}/>
                      <Tooltip content={<CustomTooltip/>}/>
                      <Bar dataKey="count" radius={[4,4,0,0]} name="Requests">
                        {priorityData.map((entry, i) => <Cell key={i} fill={entry.fill}/>)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div className="empty-state"><p>No data yet</p></div>}
              </ChartPanel>
            </div>
          </DashboardSection>

          <DashboardSection title="Execution Schedules" description="Resource schedules with search, sorting, pagination, and export.">
            <div className="dashboard-chart-grid">
              <DashboardDataTable
                title="Technician Schedule"
                rows={data?.technicianSchedule || []}
                filename="technician-schedule.csv"
                columns={[
                  { label: 'Technician', key: 'technician' },
                  { label: 'Assigned', key: 'assigned_requests', render: row => toNumber(row.assigned_requests) },
                  { label: 'In Progress', key: 'in_progress_requests', render: row => toNumber(row.in_progress_requests) },
                  { label: 'Planned', key: 'planned_requests', render: row => toNumber(row.planned_requests) },
                ]}
              />
              <DashboardDataTable
                title="Printer Schedule"
                rows={data?.printerSchedule || []}
                filename="printer-schedule.csv"
                columns={[
                  { label: 'Printer', key: 'printer' },
                  { label: 'Current Jobs', key: 'current_jobs', render: row => toNumber(row.current_jobs) },
                  { label: 'Planned Jobs', key: 'planned_jobs', render: row => toNumber(row.planned_jobs) },
                  { label: 'Availability', key: 'availability', render: row => {
                    const availability = row.availability || 'unknown';
                    const color = availability === 'available' ? 'var(--green)' : availability === 'maintenance' ? 'var(--yellow)' : availability === 'offline' ? 'var(--red)' : 'var(--text-secondary)';
                    return <span style={{ color, fontWeight: 700, textTransform: 'uppercase', fontSize: '0.72rem' }}>{availability.replace(/_/g, ' ')}</span>;
                  } },
                ]}
              />
            </div>
          </DashboardSection>

          <DashboardDataTable
            title="Priority Requests"
            rows={recentRequests}
            filename="priority-requests.csv"
            columns={[
              { label: 'ID', key: 'request_number', render: r => <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{r.request_number}</span> },
              { label: 'Title', key: 'title' },
              { label: 'Status', key: 'status', render: r => <StatusBadge status={r.status}/> },
              { label: 'Priority', key: 'priority', render: r => <PriorityBadge priority={r.priority}/> },
              { label: 'Requester', key: 'requester_name', render: r => r.requester_name || '-' },
              { label: 'Due Date', key: 'approved_due_date', render: r => formatDate(r.approved_due_date) },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
