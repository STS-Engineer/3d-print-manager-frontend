import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { StatusBadge, PriorityBadge, formatDate, formatDateTime } from '../utils/statusHelpers';
import Sidebar from '../components/common/Sidebar';
import { DatePicker } from '../components/common/DatePicker';
import { DashboardDataTable } from '../components/common/DashboardShell';
import { isProductionTechnician } from '../utils/roles';

const BOARD_COLUMNS = [
  { key: 'overdue', label: 'Overdue', color: 'var(--red)' },
  { key: 'approved', label: 'Approved', color: 'var(--green)' },
  { key: 'prioritized', label: 'Prioritized', color: 'var(--accent)' },
  { key: 'planned', label: 'Planned', color: 'var(--cyan)' },
  { key: 'assigned', label: 'Assigned', color: 'var(--purple)' },
  { key: 'in_progress', label: 'In Progress', color: 'var(--blue)' },
  { key: 'printed', label: 'Printed', color: 'var(--green)' },
  { key: 'quality_check', label: 'Quality Check', color: 'var(--yellow)' },
  { key: 'ready_for_pickup', label: 'Completed Awaiting Confirmation', color: 'var(--green)' },
  { key: 'blocked', label: 'Blocked', color: 'var(--red)' },
  { key: 'on_hold', label: 'On Hold', color: 'var(--yellow)' },
];

const FILTER_STATUSES = BOARD_COLUMNS.filter(c => c.key !== 'overdue');
const PLANNING_KPI_STATUSES = ['planned', 'assigned', 'in_progress', 'printed', 'quality_check'];
const ACTIVE_JOB_STATUSES = ['in_progress', 'printed', 'quality_check'];
const FORECAST_PERIODS = [
  { key: 7, label: 'Next 7 Days' },
  { key: 30, label: 'Next 30 Days' },
  { key: 90, label: 'Next 90 Days' },
];
const DAILY_RESOURCE_HOURS = 8;

const KpiGrid = ({ items }) => (
  <div className="grid-4" style={{ marginBottom: '1rem' }}>
    {items.map(([label, value, color]) => (
      <div className="card" key={label} style={{ padding: '1rem' }}>
        <div style={{ color: color || 'var(--text-primary)', fontSize: '1.35rem', fontWeight: 800 }}>{value}</div>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      </div>
    ))}
  </div>
);

const uniqueRequestsFromBoard = (board) => {
  const seen = new Set();
  return Object.values(board)
    .flatMap(column => Array.isArray(column) ? column : [])
    .filter(request => {
      if (!request?.id || seen.has(request.id)) return false;
      seen.add(request.id);
      return true;
    });
};

const percent = (part, total) => (total > 0 ? Math.round((part / total) * 100) : 0);

const hours = (value) => Math.round((Number(value || 0)) * 10) / 10;

const plannedDurationHours = (request = {}) => {
  if (request.planned_duration_hours !== undefined && request.planned_duration_hours !== null) {
    return hours(request.planned_duration_hours);
  }
  if (!request.planned_start_date || !request.planned_end_date) return 0;
  const start = new Date(request.planned_start_date);
  const end = new Date(request.planned_end_date);
  const duration = (end.getTime() - start.getTime()) / 3600000;
  return Number.isFinite(duration) && duration > 0 ? hours(duration) : 0;
};

const todayKey = () => toDateKey(new Date());

const periodEndKey = (days) => toDateKey(addDays(new Date(), days - 1));

const forecastQuery = (filters, days) => {
  const start = todayKey();
  const end = periodEndKey(days);
  const entries = Object.entries(filters).filter(([key, value]) => value && !['date_from', 'date_to', 'month', 'year'].includes(key));
  const dateFrom = filters.date_from && filters.date_from > start ? filters.date_from : start;
  const dateTo = filters.date_to && filters.date_to < end ? filters.date_to : end;
  return new URLSearchParams([...entries, ['date_from', dateFrom], ['date_to', dateTo]]).toString();
};

const capacityRisk = (utilization) => {
  if (utilization >= 90) return { label: 'High', color: 'var(--red)' };
  if (utilization >= 70) return { label: 'Medium', color: 'var(--yellow)' };
  return { label: 'Low', color: 'var(--green)' };
};

const PlanningOperationalKpis = ({ items }) => (
  <div className="dashboard-kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', marginBottom: '1rem' }}>
    {items.map(item => (
      <div
        key={item.label}
        className="dashboard-kpi-card"
        onClick={item.onClick}
        style={{
          '--kpi-tone': item.color || 'var(--accent)',
          cursor: item.onClick ? 'pointer' : 'default',
        }}
      >
        <div className="dashboard-kpi-value">{item.value}</div>
        <div className="dashboard-kpi-label">{item.label}</div>
        <div className="dashboard-kpi-helper">{item.description}</div>
      </div>
    ))}
  </div>
);

const PriorityDot = ({ priority }) => {
  const colors = { critical: '#ef4444', high: '#f59e0b', normal: '#3b82f6', low: '#64748b' };
  return <span style={{ width: 8, height: 8, borderRadius: '50%', display: 'inline-block', background: colors[priority] || '#64748b', flexShrink: 0 }} />;
};

const PlanningFilterBar = ({ filters, setFilter, options }) => (
  <div className="card" style={{ marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.65rem', alignItems: 'center' }}>
    <select className="form-select" value={filters.site_id} onChange={e => setFilter('site_id', e.target.value)} style={{ width: 160 }}>
      <option value="">All sites</option>
      {(options.sites || []).map(site => <option key={site.id} value={site.id}>{site.name}</option>)}
    </select>
    <select className="form-select" value={filters.status} onChange={e => setFilter('status', e.target.value)} style={{ width: 170 }}>
      <option value="">All statuses</option>
      {FILTER_STATUSES.map(status => <option key={status.key} value={status.key}>{status.label}</option>)}
    </select>
    <select className="form-select" value={filters.priority} onChange={e => setFilter('priority', e.target.value)} style={{ width: 140 }}>
      <option value="">All priorities</option>
      {['critical', 'high', 'normal', 'low'].map(priority => <option key={priority} value={priority}>{priority}</option>)}
    </select>
    <select className="form-select" value={filters.technician_id} onChange={e => setFilter('technician_id', e.target.value)} style={{ width: 190 }}>
      <option value="">All technicians</option>
      {(options.technicians || []).map(tech => <option key={tech.id} value={tech.id}>{tech.first_name} {tech.last_name}</option>)}
    </select>
    <select className="form-select" value={filters.printer_id} onChange={e => setFilter('printer_id', e.target.value)} style={{ width: 170 }}>
      <option value="">All printers</option>
      {(options.printers || []).map(printer => <option key={printer.id} value={printer.id}>{printer.name}</option>)}
    </select>
    <DatePicker value={filters.date_from} onChange={value => setFilter('date_from', value)} placeholder="From" />
    <DatePicker value={filters.date_to} onChange={value => setFilter('date_to', value)} placeholder="To" />
    <button
      className="btn btn-ghost btn-sm"
      onClick={() => ['site_id', 'status', 'priority', 'technician_id', 'printer_id', 'date_from', 'date_to', 'month', 'year'].forEach(key => setFilter(key, ''))}
    >
      Clear filters
    </button>
  </div>
);

const RequestCard = ({ request, onClick }) => {
  const overdue = Boolean(request.is_overdue);
  const dueDate = request.approved_due_date || request.requested_due_date;
  return (
    <div
      onClick={() => onClick(request.id)}
      style={{
        background: 'var(--bg-secondary)',
        border: `1px solid ${overdue ? 'rgba(239,68,68,0.4)' : 'var(--border)'}`,
        borderRadius: 8,
        padding: '0.75rem',
        cursor: 'pointer',
        marginBottom: '0.5rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
        <PriorityDot priority={request.priority} />
        <span style={{ fontSize: '0.7rem', color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{request.request_number}</span>
        {overdue && <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: 'var(--red)', fontWeight: 700 }}>LATE</span>}
      </div>
      <div style={{ fontSize: '0.82rem', fontWeight: 600, lineHeight: 1.3, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>{request.title}</div>
      {request.technician_name && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Technician: {request.technician_name}</div>}
      {request.printer_name && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Printer: {request.printer_name}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{request.requester_department}</span>
        {dueDate && <span style={{ fontSize: '0.7rem', color: overdue ? 'var(--red)' : 'var(--text-muted)' }}>Due: {formatPlanningDateTime(dueDate)}</span>}
      </div>
      {(request.planned_start_date && request.planned_end_date) && (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: '0.35rem' }}>
          Planned Duration: {plannedDurationHours(request)} h
        </div>
      )}
    </div>
  );
};

const resourceTone = (jobs = [], emptyTone = 'var(--text-muted)') => {
  if (!jobs.length) return emptyTone;
  if (jobs.some(job => job.status === 'blocked')) return 'var(--red)';
  if (jobs.some(job => job.status === 'in_progress')) return 'var(--blue)';
  if (jobs.some(job => ['planned', 'assigned'].includes(job.status))) return 'var(--orange, #f97316)';
  return 'var(--green)';
};

const resourceStatusLabel = (jobs = [], emptyLabel = 'No Assignments') => {
  if (!jobs.length) return emptyLabel;
  if (jobs.some(job => job.status === 'blocked')) return 'Blocked';
  if (jobs.some(job => job.status === 'in_progress')) return 'Busy';
  if (jobs.some(job => ['planned', 'assigned'].includes(job.status))) return 'Planned';
  return 'Active';
};

const ResourceJobCard = ({ job, navigate, extra }) => {
  const hasPlanningDates = job.planned_start_date || job.planned_end_date;
  return (
    <div
      onClick={() => navigate(`/requests/${job.id}`)}
      style={{
        background: 'var(--bg-secondary)',
        border: `1px solid ${job.is_overdue ? 'rgba(239,68,68,0.45)' : 'var(--border)'}`,
        borderRadius: 6,
        padding: '0.75rem',
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.65rem', marginBottom: '0.4rem' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: 'var(--accent)', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{job.request_number}</div>
          <div style={{ color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 700, lineHeight: 1.3, marginTop: '0.2rem' }}>{job.title}</div>
        </div>
        {job.is_overdue && <span style={{ color: 'var(--red)', fontSize: '0.65rem', fontWeight: 800 }}>LATE</span>}
      </div>
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.55rem' }}>
        <StatusBadge status={job.status} />
        <PriorityBadge priority={job.priority} />
      </div>
      {extra && <div style={{ color: 'var(--text-muted)', fontSize: '0.74rem', marginBottom: '0.35rem' }}>{extra}</div>}
      <div style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>
        {hasPlanningDates
          ? <>Planned: {formatPlanningDateTime(job.planned_start_date)} &rarr; {formatPlanningDateTime(job.planned_end_date)}</>
          : <>Due: {formatPlanningDateTime(job.due_date)}</>}
      </div>
      {hasPlanningDates && (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.74rem', marginTop: '0.25rem' }}>
          Planned Duration: {plannedDurationHours(job)} h
        </div>
      )}
    </div>
  );
};

const ResourcePlanningGrid = ({ resources, getKey, render }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', alignItems: 'start' }}>
    {resources.map(resource => <React.Fragment key={getKey(resource)}>{render(resource)}</React.Fragment>)}
  </div>
);

const PrinterResourceCard = ({ printer, navigate }) => {
  const jobs = printer.jobs || [];
  const tone = resourceTone(jobs, 'var(--green)');
  return (
    <div className="card" style={{ padding: '1rem', borderTop: `3px solid ${tone}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.8rem', alignItems: 'flex-start', marginBottom: '0.8rem' }}>
        <div>
          <h3 style={{ color: 'var(--text-primary)', fontSize: '1rem', marginBottom: '0.25rem' }}>{printer.printer_name}</h3>
          {printer.technology && <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{printer.technology}</div>}
        </div>
        <span className="badge" style={{ color: tone, border: `1px solid ${tone}`, background: 'var(--bg-hover)' }}>
          {resourceStatusLabel(jobs, 'Available')}
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '0.78rem', marginBottom: '0.85rem' }}>
        <span>Assigned Requests</span>
        <strong style={{ color: 'var(--text-primary)' }}>{jobs.length}</strong>
      </div>
      <div style={{ display: 'grid', gap: '0.65rem' }}>
        {jobs.length ? jobs.map(job => (
          <ResourceJobCard key={job.id} job={job} navigate={navigate} extra={job.technician_name ? `Technician: ${job.technician_name}` : null} />
        )) : (
          <div style={{ border: '1px dashed var(--border)', borderRadius: 6, padding: '0.85rem', color: 'var(--text-muted)', fontSize: '0.78rem', textAlign: 'center' }}>
            No active jobs
          </div>
        )}
      </div>
    </div>
  );
};

const TechnicianResourceCard = ({ technician, navigate }) => {
  const requests = technician.requests || [];
  const tone = resourceTone(requests);
  return (
    <div className="card" style={{ padding: '1rem', borderTop: `3px solid ${tone}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.8rem', alignItems: 'flex-start', marginBottom: '0.8rem' }}>
        <div>
          <h3 style={{ color: 'var(--text-primary)', fontSize: '1rem', marginBottom: '0.25rem' }}>{technician.technicianName}</h3>
          {technician.technicianEmail && <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{technician.technicianEmail}</div>}
        </div>
        <span className="badge" style={{ color: tone, border: `1px solid ${tone}`, background: 'var(--bg-hover)' }}>
          {resourceStatusLabel(requests)}
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '0.78rem', marginBottom: '0.85rem' }}>
        <span>Assigned Requests</span>
        <strong style={{ color: 'var(--text-primary)' }}>{technician.assignedRequests || requests.length}</strong>
      </div>
      <div style={{ display: 'grid', gap: '0.65rem' }}>
        {requests.length ? requests.map(request => (
          <ResourceJobCard key={request.id} job={request} navigate={navigate} extra={request.printer_name ? `Printer: ${request.printer_name}` : null} />
        )) : (
          <div style={{ border: '1px dashed var(--border)', borderRadius: 6, padding: '0.85rem', color: 'var(--text-muted)', fontSize: '0.78rem', textAlign: 'center' }}>
            No assigned requests
          </div>
        )}
      </div>
    </div>
  );
};

const mergePrinterSchedule = (schedule, printers, selectedPrinterId) => {
  const byId = new Map(schedule.map(printer => [printer.printer_id, printer]));
  const basePrinters = selectedPrinterId
    ? printers.filter(printer => printer.id === selectedPrinterId)
    : printers;
  const merged = basePrinters.map(printer => ({
    printer_id: printer.id,
    printer_name: printer.name,
    technology: printer.technology,
    jobs: [],
    plannedHours: 0,
    actualHours: 0,
    overdueJobs: 0,
    ...(byId.get(printer.id) || {}),
  }));
  schedule.forEach(printer => {
    if (!merged.some(item => item.printer_id === printer.printer_id)) merged.push(printer);
  });
  return merged.sort((a, b) => String(a.printer_name || '').localeCompare(String(b.printer_name || '')));
};

const parseCalendarDate = (value) => {
  if (!value) return '';
  if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const toDateKey = (value) => {
  const date = parseCalendarDate(value);
  if (!date) return '';
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
};

const formatCalendarDate = (value) => {
  const date = parseCalendarDate(value);
  if (!date) return '-';
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatPlanningDateTime = (value) => {
  if (!value) return '-';
  return formatDateTime(value);
};

const startOfDay = (date) => {
  return parseCalendarDate(date);
};

const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const startOfWeek = (date) => addDays(startOfDay(date), -startOfDay(date).getDay());

const sameDay = (a, b) => toDateKey(a) === toDateKey(b);

const requestOccursOn = (request, date) => {
  const start = parseCalendarDate(request.planned_start_date || request.planned_end_date);
  const end = parseCalendarDate(request.planned_end_date || request.planned_start_date);
  const current = parseCalendarDate(date);
  if (!start || !end || !current) return false;
  return current >= start && current <= end;
};

const requestSegmentPosition = (request, date) => {
  const start = parseCalendarDate(request.planned_start_date || request.planned_end_date);
  const end = parseCalendarDate(request.planned_end_date || request.planned_start_date);
  const current = parseCalendarDate(date);
  if (!start || !end || !current) return 'single';
  const starts = current.getTime() === start.getTime();
  const ends = current.getTime() === end.getTime();
  if (starts && ends) return 'single';
  if (starts) return 'start';
  if (ends) return 'end';
  return 'middle';
};

const calendarRequestsFromBoard = (board) => {
  const seen = new Set();
  return Object.values(board)
    .flatMap(column => Array.isArray(column) ? column : [])
    .filter(request => {
      if (!request?.id || seen.has(request.id)) return false;
      seen.add(request.id);
      return request.planned_start_date || request.planned_end_date;
    });
};

const calendarStatusColor = (status) => ({
  in_progress: 'var(--blue)',
  planned: 'var(--orange, #f97316)',
  completed: 'var(--green)',
  ready_for_pickup: 'var(--green)',
  requester_confirmation: 'var(--green)',
  blocked: 'var(--red)',
  on_hold: '#64748b',
}[status] || 'var(--text-muted)');

const calendarTooltip = (request) => [
  `Request ID: ${request.request_number || request.id}`,
  `Title: ${request.title || '-'}`,
  `Printer: ${request.printer_name || '-'}`,
  `Technician: ${request.technician_name || '-'}`,
  `Planned Start: ${formatPlanningDateTime(request.planned_start_date)}`,
  `Planned End: ${formatPlanningDateTime(request.planned_end_date)}`,
  `Planned Duration: ${plannedDurationHours(request)} h`,
  `Priority: ${request.priority || '-'}`,
  `Status: ${request.status || '-'}`,
].join('\n');

const ganttStatusColor = (status) => ({
  in_progress: 'var(--blue)',
  planned: 'var(--orange, #f97316)',
  assigned: 'var(--orange, #f97316)',
  completed: 'var(--green)',
  ready_for_pickup: 'var(--green)',
  requester_confirmation: 'var(--green)',
  printed: 'var(--green)',
  blocked: 'var(--red)',
  on_hold: '#64748b',
  quality_check: 'var(--purple)',
}[status] || 'var(--text-muted)');

const ganttScaleConfig = {
  day: { days: 14, columnWidth: 92 },
  week: { days: 42, columnWidth: 44 },
  month: { days: 180, columnWidth: 28 },
};

const ganttRequestsFromBoard = (board) => uniqueRequestsFromBoard(board)
  .filter(request => request.planned_start_date || request.planned_end_date);

const earliestPlannedDate = (requests) => {
  const dates = requests
    .map(request => parseCalendarDate(request.planned_start_date || request.planned_end_date))
    .filter(Boolean)
    .sort((a, b) => a - b);
  return dates[0] || new Date();
};

const dayDiff = (start, end) => {
  const a = parseCalendarDate(start);
  const b = parseCalendarDate(end);
  if (!a || !b) return 0;
  return Math.round((b - a) / 86400000);
};

const buildGanttGroups = (requests, viewMode) => {
  const groups = new Map();
  requests.forEach(request => {
    const key = viewMode === 'printer'
      ? request.printer_name || 'Unassigned Printer'
      : request.technician_name || 'Unassigned Technician';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(request);
  });
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, items]) => ({
      name,
      lanes: buildGanttLanes(items),
      requests: items,
    }));
};

const buildGanttLanes = (requests) => {
  const lanes = [];
  requests
    .slice()
    .sort((a, b) => String(a.planned_start_date || a.planned_end_date || '').localeCompare(String(b.planned_start_date || b.planned_end_date || '')))
    .forEach(request => {
      const start = parseCalendarDate(request.planned_start_date || request.planned_end_date);
      const end = parseCalendarDate(request.planned_end_date || request.planned_start_date);
      if (!start || !end) return;
      const lane = lanes.find(existing => existing.end < start);
      if (lane) {
        lane.items.push(request);
        lane.end = end;
      } else {
        lanes.push({ end, items: [request] });
      }
    });
  return lanes;
};

const ganttHeaderLabel = (day, mode) => {
  if (mode === 'month') {
    if (day.getDate() === 1) return day.toLocaleDateString('fr-FR', { month: 'short' });
    return day.getDay() === 1 ? day.toLocaleDateString('fr-FR', { day: '2-digit' }) : '';
  }
  if (mode === 'week') return day.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  return day.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit' });
};

const GanttBar = ({ request, timelineStart, totalDays, columnWidth, laneIndex, conflictRequestIds, navigate }) => {
  const start = parseCalendarDate(request.planned_start_date || request.planned_end_date);
  const end = parseCalendarDate(request.planned_end_date || request.planned_start_date);
  if (!start || !end) return null;
  const leftDays = Math.max(dayDiff(timelineStart, start), 0);
  const rightDays = Math.min(dayDiff(timelineStart, end), totalDays - 1);
  if (rightDays < 0 || leftDays >= totalDays) return null;
  const color = ganttStatusColor(request.status);
  const hasConflict = conflictRequestIds.has(request.id);
  const width = Math.max((rightDays - leftDays + 1) * columnWidth - 8, 34);
  const shortTitle = request.title?.length > 28 ? `${request.title.slice(0, 28)}...` : request.title;
  return (
    <button
      type="button"
      title={calendarTooltip(request)}
      onClick={() => navigate(`/requests/${request.id}`)}
      style={{
        position: 'absolute',
        left: leftDays * columnWidth + 4,
        top: laneIndex * 36 + 8,
        width,
        minWidth: 34,
        height: 28,
        borderRadius: 6,
        border: hasConflict ? '2px solid var(--yellow)' : `1px solid ${color}`,
        background: `linear-gradient(90deg, ${color}, color-mix(in srgb, ${color} 65%, var(--bg-secondary)))`,
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        gap: '0.35rem',
        padding: '0 0.55rem',
        cursor: 'pointer',
        overflow: 'hidden',
        boxShadow: hasConflict ? '0 0 0 3px rgba(245,158,11,0.18)' : 'none',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.72rem',
        fontWeight: 800,
        textAlign: 'left',
      }}
    >
      {hasConflict && <span style={{ flexShrink: 0, color: 'var(--yellow)' }}>!</span>}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {request.request_number} | {shortTitle} | {request.status}
      </span>
    </button>
  );
};

function GanttView({ board, filters, setFilter, options, navigate, operationalKpis, conflictRequestIds }) {
  const [resourceView, setResourceView] = useState('printer');
  const [scale, setScale] = useState('week');
  const requests = useMemo(() => ganttRequestsFromBoard(board), [board]);
  const [cursor, setCursor] = useState(() => earliestPlannedDate(requests));
  const config = ganttScaleConfig[scale];
  const timelineStart = scale === 'month'
    ? new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    : scale === 'week'
      ? startOfWeek(cursor)
      : startOfDay(cursor);
  const days = useMemo(
    () => Array.from({ length: config.days }, (_, index) => addDays(timelineStart, index)),
    [timelineStart, config.days]
  );
  const groups = useMemo(() => buildGanttGroups(requests, resourceView), [requests, resourceView]);
  const timelineWidth = config.days * config.columnWidth;
  const move = (direction) => {
    if (scale === 'month') setCursor(prev => new Date(prev.getFullYear(), prev.getMonth() + direction, 1));
    else setCursor(prev => addDays(prev, direction * (scale === 'week' ? 14 : 7)));
  };

  useEffect(() => {
    if (requests.length) setCursor(earliestPlannedDate(requests));
  }, [requests]);

  return (
    <div className="page-body">
      <PlanningFilterBar filters={filters} setFilter={setFilter} options={options} />
      <PlanningOperationalKpis items={operationalKpis} />
      <div className="card" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>Gantt View</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{requests.length} planned request{requests.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => move(-1)}>Previous</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setCursor(earliestPlannedDate(requests))}>Fit Schedule</button>
          <button className="btn btn-ghost btn-sm" onClick={() => move(1)}>Next</button>
          {['printer', 'technician'].map(item => (
            <button key={item} className={`btn btn-sm ${resourceView === item ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setResourceView(item)}>
              {item === 'printer' ? 'Printer View' : 'Technician View'}
            </button>
          ))}
          {['day', 'week', 'month'].map(item => (
            <button key={item} className={`btn btn-sm ${scale === item ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setScale(item)}>
              {item.charAt(0).toUpperCase() + item.slice(1)}
            </button>
          ))}
        </div>
      </div>
      {requests.length === 0 ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          No planned production within the selected period.
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: timelineWidth + 220 }}>
              <div style={{ display: 'grid', gridTemplateColumns: `220px ${timelineWidth}px`, position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
                <div style={{ padding: '0.75rem', color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Resource</div>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${config.days}, ${config.columnWidth}px)` }}>
                  {days.map(day => (
                    <div key={toDateKey(day)} style={{ padding: '0.75rem 0.3rem', borderLeft: '1px solid var(--border)', color: sameDay(day, new Date()) ? 'var(--accent)' : 'var(--text-muted)', fontSize: '0.68rem', minHeight: 42, overflow: 'hidden' }}>
                      {ganttHeaderLabel(day, scale)}
                    </div>
                  ))}
                </div>
              </div>
              {groups.map(group => {
                const rowHeight = Math.max(58, group.lanes.length * 36 + 16);
                return (
                  <div key={group.name} style={{ display: 'grid', gridTemplateColumns: `220px ${timelineWidth}px`, borderBottom: '1px solid var(--border)' }}>
                    <div style={{ padding: '0.85rem', background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)', minHeight: rowHeight }}>
                      <strong style={{ color: 'var(--text-primary)', fontSize: '0.82rem' }}>{group.name}</strong>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '0.25rem' }}>{group.requests.length} request{group.requests.length !== 1 ? 's' : ''}</div>
                    </div>
                    <div style={{ position: 'relative', minHeight: rowHeight, backgroundImage: `repeating-linear-gradient(to right, transparent 0, transparent ${config.columnWidth - 1}px, var(--border) ${config.columnWidth}px)` }}>
                      {group.lanes.flatMap((lane, laneIndex) => lane.items.map(request => (
                        <GanttBar
                          key={`${group.name}-${request.id}-${laneIndex}`}
                          request={request}
                          timelineStart={timelineStart}
                          totalDays={config.days}
                          columnWidth={config.columnWidth}
                          laneIndex={laneIndex}
                          conflictRequestIds={conflictRequestIds}
                          navigate={navigate}
                        />
                      )))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const buildForecastSnapshot = ({ printerSchedule, technicians, options, filters, days }) => {
  const printerResources = mergePrinterSchedule(printerSchedule, options.printers || [], filters.printer_id);
  const technicianResources = technicians || [];
  const printerCapacity = printerResources.length * days * DAILY_RESOURCE_HOURS;
  const technicianCapacity = technicianResources.length * days * DAILY_RESOURCE_HOURS;
  const printerDemand = printerResources.reduce((sum, printer) => sum + Number(printer.plannedHours || 0), 0);
  const technicianDemand = technicianResources.reduce((sum, tech) => sum + Number(tech.plannedHours || 0), 0);
  const demand = printerDemand || technicianDemand;
  const bottleneckCapacity = Math.min(
    printerCapacity || Number.POSITIVE_INFINITY,
    technicianCapacity || Number.POSITIVE_INFINITY
  );
  const usableCapacity = Number.isFinite(bottleneckCapacity) ? bottleneckCapacity : 0;
  const utilization = percent(demand, usableCapacity);
  const risk = capacityRisk(utilization);
  const printers = printerResources.map(printer => {
    const reserved = hours(printer.plannedHours);
    const capacity = days * DAILY_RESOURCE_HOURS;
    const utilizationValue = percent(reserved, capacity);
    return {
      ...printer,
      reserved,
      available: Math.max(hours(capacity - reserved), 0),
      utilization: utilizationValue,
      overloaded: utilizationValue > 100,
    };
  });
  const techs = technicianResources.map(tech => {
    const assigned = hours(tech.plannedHours);
    const capacity = days * DAILY_RESOURCE_HOURS;
    const utilizationValue = percent(assigned, capacity);
    return {
      ...tech,
      assigned,
      available: Math.max(hours(capacity - assigned), 0),
      utilization: utilizationValue,
      overloaded: utilizationValue > 100,
    };
  });
  return {
    days,
    printerCapacity: hours(printerCapacity),
    technicianCapacity: hours(technicianCapacity),
    availablePrinterHours: Math.max(hours(printerCapacity - printerDemand), 0),
    availableTechnicianHours: Math.max(hours(technicianCapacity - technicianDemand), 0),
    demand: hours(demand),
    capacity: hours(usableCapacity),
    utilization,
    risk,
    printers,
    technicians: techs,
    overloadedPrinters: printers.filter(printer => printer.overloaded),
    overloadedTechnicians: techs.filter(tech => tech.overloaded),
  };
};

const ForecastMiniChart = ({ forecasts }) => (
  <div className="card" style={{ marginBottom: '1rem' }}>
    <h3 style={{ color: 'var(--text-primary)', fontSize: '0.95rem', marginBottom: '0.9rem' }}>Demand vs Capacity</h3>
    <div style={{ display: 'grid', gap: '0.9rem' }}>
      {FORECAST_PERIODS.map(period => {
        const item = forecasts[period.key];
        const max = Math.max(item?.demand || 0, item?.capacity || 0, 1);
        return (
          <div key={period.key}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', color: 'var(--text-secondary)', fontSize: '0.76rem', marginBottom: '0.35rem' }}>
              <strong style={{ color: 'var(--text-primary)' }}>{period.label}</strong>
              <span>{hours(item?.demand)} h demand / {hours(item?.capacity)} h capacity</span>
            </div>
            <div style={{ display: 'grid', gap: '0.3rem' }}>
              <div style={{ height: 10, background: 'var(--bg-secondary)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(((item?.demand || 0) / max) * 100, 100)}%`, height: '100%', background: 'var(--accent)' }} />
              </div>
              <div style={{ height: 10, background: 'var(--bg-secondary)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(((item?.capacity || 0) / max) * 100, 100)}%`, height: '100%', background: 'var(--green)' }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

const ForecastResourceCard = ({ name, subtitle, reservedLabel, reserved, available, utilization, overloaded }) => {
  const tone = overloaded ? 'var(--red)' : utilization >= 80 ? 'var(--yellow)' : 'var(--green)';
  return (
    <div className="card" style={{ padding: '1rem', borderTop: `3px solid ${tone}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start', marginBottom: '0.85rem' }}>
        <div>
          <h3 style={{ color: 'var(--text-primary)', fontSize: '0.95rem', marginBottom: '0.2rem' }}>{name}</h3>
          {subtitle && <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{subtitle}</div>}
        </div>
        <span className="badge" style={{ color: tone, border: `1px solid ${tone}`, background: 'var(--bg-hover)' }}>
          {overloaded ? 'Overloaded' : 'Available'}
        </span>
      </div>
      <div style={{ display: 'grid', gap: '0.45rem', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{reservedLabel}</span><strong style={{ color: 'var(--text-primary)' }}>{reserved} h</strong></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Available</span><strong style={{ color: 'var(--text-primary)' }}>{available} h</strong></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Utilization</span><strong style={{ color: tone }}>{utilization}%</strong></div>
      </div>
    </div>
  );
};

function CapacityForecastView({ filters, setFilter, options, operationalKpis }) {
  const [period, setPeriod] = useState(30);
  const [forecasts, setForecasts] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all(FORECAST_PERIODS.map(async item => {
      const query = forecastQuery(filters, item.key);
      const [printerRes, technicianRes] = await Promise.all([
        api.get(`/planning/printer-schedule${query ? `?${query}` : ''}`),
        api.get(`/planning/technician-schedule${query ? `?${query}` : ''}`),
      ]);
      return [
        item.key,
        buildForecastSnapshot({
          printerSchedule: printerRes.data.printers || [],
          technicians: technicianRes.data.technicians || [],
          options,
          filters,
          days: item.key,
        }),
      ];
    }))
      .then(entries => {
        if (!cancelled) setForecasts(Object.fromEntries(entries));
      })
      .catch(err => {
        console.error('[Planning] Capacity forecast failed:', err);
        if (!cancelled) setForecasts({});
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [filters, options]);

  const selected = forecasts[period] || buildForecastSnapshot({
    printerSchedule: [],
    technicians: [],
    options,
    filters,
    days: period,
  });

  return (
    <div className="page-body">
      <PlanningFilterBar filters={filters} setFilter={setFilter} options={options} />
      <PlanningOperationalKpis items={operationalKpis} />
      <div className="card" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>Capacity Forecast</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Analytical forecast based on calculated planned duration from start and end times</p>
        </div>
        <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
          {FORECAST_PERIODS.map(item => (
            <button key={item.key} className={`btn btn-sm ${period === item.key ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPeriod(item.key)}>
              {item.label}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}><span className="spinner" /></div>
      ) : (
        <>
          <div className="dashboard-kpi-grid capacity-forecast-kpi-grid" style={{ marginBottom: '1rem' }}>
            {[
              ['Available Printer Capacity', `${selected.availablePrinterHours} h`, `${selected.printerCapacity} h total printer capacity`, 'var(--green)'],
              ['Available Technician Capacity', `${selected.availableTechnicianHours} h`, `${selected.technicianCapacity} h total technician capacity`, 'var(--purple)'],
              ['Planned Duration Demand', `${selected.demand} h`, `${period} day forecast demand`, 'var(--accent)'],
              ['Capacity Utilization', `${selected.utilization}%`, `${selected.demand} h demand against ${selected.capacity} h bottleneck capacity`, selected.utilization >= 90 ? 'var(--red)' : 'var(--yellow)'],
              ['Capacity Risk', selected.risk.label, 'Based on forecast utilization thresholds', selected.risk.color],
            ].map(([label, value, helper, color]) => (
              <div key={label} className="dashboard-kpi-card" style={{ '--kpi-tone': color }}>
                <div className="dashboard-kpi-value">{value}</div>
                <div className="dashboard-kpi-label">{label}</div>
                <div className="dashboard-kpi-helper">{helper}</div>
              </div>
            ))}
          </div>
          <ForecastMiniChart forecasts={forecasts} />
          <div className="grid-2" style={{ marginBottom: '1rem' }}>
            <div className="card" style={{ padding: '1rem' }}>
              <h3 style={{ color: 'var(--text-primary)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>Printer Bottlenecks</h3>
              {selected.overloadedPrinters.length ? selected.overloadedPrinters.map(printer => (
                <div key={printer.printer_id} style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', padding: '0.45rem 0', borderTop: '1px solid var(--border)' }}>
                  <strong style={{ color: 'var(--red)' }}>{printer.printer_name}</strong> - {printer.utilization}% utilization
                </div>
              )) : <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>No overloaded printers detected.</div>}
            </div>
            <div className="card" style={{ padding: '1rem' }}>
              <h3 style={{ color: 'var(--text-primary)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>Technician Bottlenecks</h3>
              {selected.overloadedTechnicians.length ? selected.overloadedTechnicians.map(tech => (
                <div key={tech.technicianId} style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', padding: '0.45rem 0', borderTop: '1px solid var(--border)' }}>
                  <strong style={{ color: 'var(--red)' }}>{tech.technicianName}</strong> - {tech.utilization}% utilization
                </div>
              )) : <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>No overloaded technicians detected.</div>}
            </div>
          </div>
          <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>Printer Forecast</h3>
          <ResourcePlanningGrid
            resources={selected.printers}
            getKey={printer => printer.printer_id}
            render={printer => (
              <ForecastResourceCard
                name={printer.printer_name}
                subtitle={printer.technology}
                reservedLabel="Scheduled"
                reserved={printer.reserved}
                available={printer.available}
                utilization={printer.utilization}
                overloaded={printer.overloaded}
              />
            )}
          />
          <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '1.25rem 0 0.75rem' }}>Technician Forecast</h3>
          <ResourcePlanningGrid
            resources={selected.technicians}
            getKey={tech => tech.technicianId}
            render={tech => (
              <ForecastResourceCard
                name={tech.technicianName}
                subtitle={tech.technicianEmail}
                reservedLabel="Scheduled"
                reserved={tech.assigned}
                available={tech.available}
                utilization={tech.utilization}
                overloaded={tech.overloaded}
              />
            )}
          />
        </>
      )}
    </div>
  );
}

const CalendarEvent = ({ request, date, navigate }) => {
  const color = calendarStatusColor(request.status);
  const segment = requestSegmentPosition(request, date);
  const radius = {
    single: 6,
    start: '6px 0 0 6px',
    middle: 0,
    end: '0 6px 6px 0',
  }[segment];
  return (
    <div
      onClick={() => navigate(`/requests/${request.id}`)}
      title={calendarTooltip(request)}
      style={{
        border: '1px solid var(--border)',
        borderLeft: `5px solid ${color}`,
        borderRadius: radius,
        padding: '0.55rem',
        background: `linear-gradient(90deg, ${color}24, var(--bg-secondary) 38%)`,
        boxShadow: segment === 'middle' ? `inset 4px 0 0 ${color}, inset -4px 0 0 ${color}` : 'none',
        cursor: 'pointer',
        marginBottom: '0.45rem',
        position: 'relative',
      }}
    >
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.35rem' }}>
      <strong style={{ color: 'var(--accent)', fontSize: '0.72rem', fontFamily: 'var(--font-mono)' }}>{request.request_number}</strong>
      <PriorityBadge priority={request.priority} />
    </div>
    <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.82rem', lineHeight: 1.3, marginBottom: '0.35rem' }}>{request.title}</div>
    <div style={{ display: 'grid', gap: '0.2rem', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
      <span>Start: {formatPlanningDateTime(request.planned_start_date)}</span>
      <span>End: {formatPlanningDateTime(request.planned_end_date)}</span>
      <span>Printer: {request.printer_name || '-'}</span>
      <span>Technician: {request.technician_name || '-'}</span>
    </div>
    <div style={{ marginTop: '0.45rem' }}><StatusBadge status={request.status} /></div>
  </div>
  );
};

function CalendarView({ board, filters, setFilter, options, navigate, operationalKpis }) {
  const [mode, setMode] = useState('week');
  const [cursor, setCursor] = useState(() => new Date());
  const requests = useMemo(() => calendarRequestsFromBoard(board), [board]);
  const activeRequests = requests.filter(request => ['assigned', 'in_progress', 'printed', 'quality_check'].includes(request.status)).length;
  const printersUsed = new Set(requests.filter(request => request.printer_name).map(request => request.printer_name)).size;
  const techniciansAssigned = new Set(requests.filter(request => request.technician_name).map(request => request.technician_name)).size;

  const visibleDays = useMemo(() => {
    if (mode === 'day') return [startOfDay(cursor)];
    if (mode === 'week') {
      const start = startOfWeek(cursor);
      return Array.from({ length: 7 }, (_, index) => addDays(start, index));
    }
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const gridStart = startOfWeek(first);
    return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  }, [cursor, mode]);

  const move = (direction) => {
    if (mode === 'day') setCursor(prev => addDays(prev, direction));
    if (mode === 'week') setCursor(prev => addDays(prev, direction * 7));
    if (mode === 'month') setCursor(prev => new Date(prev.getFullYear(), prev.getMonth() + direction, 1));
  };

  const title = mode === 'month'
    ? cursor.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    : mode === 'week'
      ? `${formatDate(visibleDays[0])} - ${formatDate(visibleDays[6])}`
      : formatDate(cursor);

  return (
    <div className="page-body">
      <PlanningFilterBar filters={filters} setFilter={setFilter} options={options} />
      <PlanningOperationalKpis items={operationalKpis} />
      <KpiGrid items={[
        ['Planned Requests', requests.length, 'var(--orange, #f97316)'],
        ['Active Requests', activeRequests, 'var(--blue)'],
        ['Printers Used', printersUsed, 'var(--green)'],
        ['Technicians Assigned', techniciansAssigned, 'var(--purple)'],
      ]} />
      <div className="card" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>Calendar View</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{requests.length} planned request{requests.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => move(-1)}>Previous</button>
          <strong style={{ minWidth: 190, textAlign: 'center', color: 'var(--text-primary)' }}>{title}</strong>
          <button className="btn btn-ghost btn-sm" onClick={() => move(1)}>Next</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setCursor(new Date())}>Today</button>
          {['day', 'week', 'month'].map(item => (
            <button key={item} className={`btn btn-sm ${mode === item ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMode(item)}>
              {item.charAt(0).toUpperCase() + item.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: mode === 'day' ? '1fr' : 'repeat(7, minmax(180px, 1fr))',
          gap: '0.75rem',
          overflowX: 'auto',
        }}
      >
        {visibleDays.map(day => {
          const dayRequests = requests.filter(request => requestOccursOn(request, day));
          const outsideMonth = mode === 'month' && day.getMonth() !== cursor.getMonth();
          return (
            <div
              key={toDateKey(day)}
              className="card"
              style={{
                minHeight: mode === 'month' ? 150 : 420,
                minWidth: mode === 'day' ? 0 : 180,
                padding: '0.75rem',
                opacity: outsideMonth ? 0.55 : 1,
                borderColor: sameDay(day, new Date()) ? 'var(--accent)' : 'var(--border)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                <strong style={{ color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                  {day.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' })}
                </strong>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{dayRequests.length}</span>
              </div>
              {dayRequests.length === 0 ? (
                <div style={{ background: 'var(--bg-hover)', border: '1px dashed var(--border)', borderRadius: 6, color: 'var(--text-muted)', fontSize: '0.75rem', padding: '0.75rem', textAlign: 'center' }}>
                  No planned production for this day.
                </div>
              ) : (
                dayRequests.map(request => <CalendarEvent key={`${toDateKey(day)}-${request.id}`} request={request} date={day} navigate={navigate} />)
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const severityColor = (severity) => ({
  High: 'var(--red)',
  Medium: 'var(--orange, #f97316)',
  Low: 'var(--yellow)',
}[severity] || 'var(--text-muted)');

const SeverityBadge = ({ severity }) => (
  <span
    className="badge"
    style={{
      color: severityColor(severity),
      border: `1px solid ${severityColor(severity)}`,
      background: 'var(--bg-hover)',
      fontWeight: 800,
    }}
  >
    {severity}
  </span>
);

const daysBetween = (start, end) => {
  const a = parseCalendarDate(start);
  const b = parseCalendarDate(end);
  if (!a || !b) return null;
  return Math.max(0, Math.round((b - a) / 86400000));
};

const conflictDetails = (conflict) => {
  if (conflict.type === 'Schedule Risk') {
    const request = conflict.requests?.[0] || {};
    const plannedEnd = request.planned_end_date || conflict.date;
    const approvedDue = request.approved_due_date;
    const delay = approvedDue ? daysBetween(approvedDue, plannedEnd) : null;
    return [
      `Planned End: ${formatPlanningDateTime(plannedEnd)}`,
      `Approved Due Date: ${formatPlanningDateTime(approvedDue)}`,
      `Delay: ${delay ?? '-'} day${delay === 1 ? '' : 's'}`,
    ];
  }
  if (conflict.type === 'Printer Conflict') return [`${conflict.resource} assigned to multiple overlapping requests.`];
  if (conflict.type === 'Technician Conflict') return ['Technician assigned to multiple overlapping requests.'];
  if (conflict.type === 'Planning Warning') return [conflict.resource || 'Missing assignment'];
  return [conflict.detail || '-'];
};

const suggestedAction = (conflict) => ({
  'Schedule Risk': 'Review planning dates',
  'Printer Conflict': 'Assign another printer',
  'Technician Conflict': 'Reassign technician',
  'Planning Warning': conflict.resource?.includes('and') ? 'Assign printer and technician' : conflict.resource?.includes('Printer') ? 'Assign printer' : 'Assign technician',
}[conflict.type] || 'Review conflict');

const topByCount = (conflicts, type) => {
  const counts = new Map();
  conflicts.filter(conflict => conflict.type === type).forEach(conflict => {
    if (!conflict.resource || conflict.resource === '-') return;
    counts.set(conflict.resource, (counts.get(conflict.resource) || 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
};

const ConflictSummaryPanel = ({ conflicts }) => {
  const severityRank = { High: 3, Medium: 2, Low: 1 };
  const mostCritical = [...conflicts].sort((a, b) => (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0))[0];
  const nextDueRisk = conflicts
    .filter(conflict => conflict.type === 'Schedule Risk')
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))[0];
  const mostLoadedPrinter = topByCount(conflicts, 'Printer Conflict');
  const mostLoadedTechnician = topByCount(conflicts, 'Technician Conflict');
  const items = [
    ['Most Critical Conflict', mostCritical ? `${mostCritical.type} (${mostCritical.severity})` : '-'],
    ['Next Due Date Risk', nextDueRisk ? `${formatPlanningDateTime(nextDueRisk.date)} - ${nextDueRisk.requestsText}` : '-'],
    ['Most Loaded Printer', mostLoadedPrinter ? `${mostLoadedPrinter[0]} (${mostLoadedPrinter[1]})` : '-'],
    ['Most Loaded Technician', mostLoadedTechnician ? `${mostLoadedTechnician[0]} (${mostLoadedTechnician[1]})` : '-'],
  ];
  return (
    <div className="grid-4" style={{ marginBottom: '1rem' }}>
      {items.map(([label, value]) => (
        <div className="card" key={label} style={{ padding: '1rem' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>{label}</div>
          <strong style={{ color: 'var(--text-primary)', fontSize: '0.9rem', lineHeight: 1.35 }}>{value}</strong>
        </div>
      ))}
    </div>
  );
};

function ConflictCenterView({ filters, setFilter, options, query, navigate, operationalKpis }) {
  const [data, setData] = useState({ summary: {}, conflicts: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/planning/conflicts${query ? `?${query}` : ''}`)
      .then(res => setData({ summary: res.data.summary || {}, conflicts: res.data.conflicts || [] }))
      .catch(err => console.error('[Planning] Conflict center failed:', err))
      .finally(() => setLoading(false));
  }, [query]);

  const summary = data.summary || {};
  const conflicts = data.conflicts || [];

  return (
    <div className="page-body">
      <PlanningFilterBar filters={filters} setFilter={setFilter} options={options} />
      <PlanningOperationalKpis items={operationalKpis} />
      <KpiGrid items={[
        ['Total Conflicts', summary.totalConflicts || 0, 'var(--red)'],
        ['Printer Conflicts', summary.printerConflicts || 0, 'var(--red)'],
        ['Technician Conflicts', summary.technicianConflicts || 0, 'var(--orange, #f97316)'],
        ['Due Date Risks', summary.dueDateRisks || 0, 'var(--orange, #f97316)'],
        ['Missing Assignments', summary.missingAssignments || 0, 'var(--yellow)'],
      ]} />
      {!loading && <ConflictSummaryPanel conflicts={conflicts} />}
      {loading ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}><span className="spinner" /></div>
      ) : (
        <DashboardDataTable
          title="Conflict Center"
          rows={conflicts}
          filename="planning-conflicts.csv"
          pageSize={10}
          columns={[
            { label: 'Date', key: 'date', render: row => formatPlanningDateTime(row.date) },
            { label: 'Conflict Type', key: 'type' },
            { label: 'Resource', key: 'resource' },
            {
              label: 'Requests Involved',
              key: 'requestsText',
              render: row => (
                <div style={{ display: 'grid', gap: '0.3rem' }}>
                  {(row.requests || []).map(request => (
                    <button
                      key={request.id}
                      className="btn btn-ghost btn-sm"
                      style={{ justifyContent: 'flex-start', paddingInline: '0.35rem' }}
                      onClick={event => {
                        event.stopPropagation();
                        navigate(`/requests/${request.id}`);
                      }}
                    >
                      {request.request_number || request.id}
                    </button>
                  ))}
                </div>
              ),
            },
            {
              label: 'Details',
              key: row => conflictDetails(row).join(' '),
              render: row => (
                <div style={{ display: 'grid', gap: '0.2rem', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                  {conflictDetails(row).map(line => <span key={line}>{line}</span>)}
                </div>
              ),
            },
            { label: 'Suggested Action', key: row => suggestedAction(row) },
            { label: 'Severity', key: 'severity', render: row => <SeverityBadge severity={row.severity} /> },
            { label: 'Status', key: 'status' },
          ]}
          onRowClick={row => row.requests?.[0]?.id && navigate(`/requests/${row.requests[0].id}`)}
        />
      )}
    </div>
  );
}

export default function PlanningBoardPage() {
  const navigate = useNavigate();
  const [board, setBoard] = useState({});
  const [boardSummary, setBoardSummary] = useState({});
  const [conflictData, setConflictData] = useState({ summary: {}, conflicts: [] });
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('board');
  const [filters, setFilters] = useState({
    site_id: '', status: '', priority: '', technician_id: '',
    date_from: '', date_to: '', month: '', year: '', printer_id: '',
  });
  const [filterOptions, setFilterOptions] = useState({ sites: [], printers: [], technicians: [] });

  const query = useMemo(() => new URLSearchParams(Object.entries(filters).filter(([, value]) => value)).toString(), [filters]);
  const setFilter = (key, value) => setFilters(prev => ({ ...prev, [key]: value }));

  const fetchBoard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/planning/board${query ? `?${query}` : ''}`);
      setBoard(res.data.board || {});
      setBoardSummary(res.data.summary || {});
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { fetchBoard(); }, [fetchBoard]);

  useEffect(() => {
    api.get(`/planning/conflicts${query ? `?${query}` : ''}`)
      .then(res => setConflictData({ summary: res.data.summary || {}, conflicts: res.data.conflicts || [] }))
      .catch(err => {
        console.error('[Planning] KPI conflicts failed:', err);
        setConflictData({ summary: {}, conflicts: [] });
      });
  }, [query]);

  useEffect(() => {
    Promise.all([api.get('/sites'), api.get('/printers'), api.get('/users')])
      .then(([sites, printers, users]) => {
        setFilterOptions({
          sites: sites.data || [],
          printers: printers.data || [],
          technicians: (users.data || []).filter(user => isProductionTechnician(user.role)),
        });
      })
      .catch(err => console.error('[Planning] Filter options failed:', err));
  }, []);

  const totalCards = Object.values(board).reduce((sum, column) => sum + (Array.isArray(column) ? column.length : 0), 0);
  const planningRequests = uniqueRequestsFromBoard(board).filter(request => PLANNING_KPI_STATUSES.includes(request.status));
  const activeJobs = planningRequests.filter(request => ACTIVE_JOB_STATUSES.includes(request.status));
  const totalPrinters = filters.printer_id ? 1 : (filterOptions.printers || []).length;
  const totalTechnicians = filters.technician_id ? 1 : (filterOptions.technicians || []).length;
  const occupiedPrinters = new Set(activeJobs.map(request => request.printer_name).filter(Boolean)).size;
  const assignedTechnicians = new Set(planningRequests.map(request => request.technician_name).filter(Boolean)).size;
  const availablePrinters = Math.max(totalPrinters - occupiedPrinters, 0);
  const availableTechnicians = Math.max(totalTechnicians - assignedTechnicians, 0);
  const schedulingConflicts = conflictData.summary?.totalConflicts || 0;
  const conflictRequestIds = new Set(
    (conflictData.conflicts || [])
      .flatMap(conflict => conflict.requests || [])
      .map(request => request.id)
  );
  const operationalKpis = [
    {
      value: planningRequests.length,
      label: 'Planned Requests',
      description: 'Planned, assigned, in production, printed or in quality check',
      color: 'var(--cyan)',
    },
    {
      value: activeJobs.length,
      label: 'Active Jobs',
      description: 'In progress, printed or in quality check',
      color: 'var(--blue)',
    },
    {
      value: `${percent(occupiedPrinters, totalPrinters)}%`,
      label: 'Printer Utilization',
      description: `${occupiedPrinters} of ${totalPrinters} printers currently occupied`,
      color: 'var(--green)',
    },
    {
      value: `${percent(assignedTechnicians, totalTechnicians)}%`,
      label: 'Technician Utilization',
      description: `${assignedTechnicians} of ${totalTechnicians} technicians assigned active work`,
      color: 'var(--purple)',
    },
    {
      value: schedulingConflicts,
      label: 'Scheduling Conflicts',
      description: 'Open printer, technician, due date and assignment issues',
      color: schedulingConflicts > 0 ? 'var(--red)' : 'var(--green)',
      onClick: () => setView('conflicts'),
    },
    {
      value: `${availablePrinters} / ${availableTechnicians}`,
      label: 'Available Capacity',
      description: `${availablePrinters} printers available, ${availableTechnicians} technicians available`,
      color: 'var(--accent)',
    },
  ];

  return (
    <div className="page">
      <Sidebar />
      <div className="main-content">
        <div className="page-header">
          <div>
            <h1 style={{ fontSize: '1.3rem', fontFamily: 'var(--font-heading)' }}>Planning Board</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
              {totalCards} active request{totalCards !== 1 ? 's' : ''} in workflow
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button className={`btn btn-sm ${view === 'board' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('board')}>Workflow Planning</button>
            <button className={`btn btn-sm ${view === 'technician' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('technician')}>Technician Planning</button>
            <button className={`btn btn-sm ${view === 'schedule' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('schedule')}>Printer Planning</button>
            <button className={`btn btn-sm ${view === 'calendar' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('calendar')}>Calendar View</button>
            <button className={`btn btn-sm ${view === 'conflicts' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('conflicts')}>Conflict Center</button>
            <button className={`btn btn-sm ${view === 'gantt' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('gantt')}>Gantt View</button>
            <button className={`btn btn-sm ${view === 'capacity' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('capacity')}>Capacity Forecast</button>
            <button className="btn btn-ghost btn-sm" onClick={fetchBoard}>Refresh</button>
          </div>
        </div>

        {loading && ['board', 'calendar', 'gantt'].includes(view) ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
            <span className="spinner" style={{ width: 32, height: 32 }} />
          </div>
        ) : view === 'board' ? (
          <div className="page-body">
            <PlanningFilterBar filters={filters} setFilter={setFilter} options={filterOptions} />
            <PlanningOperationalKpis items={operationalKpis} />
            <KpiGrid items={[
              ['Total Requests', boardSummary.totalRequests || totalCards],
              ['Overdue Requests', boardSummary.overdueRequests || 0, 'var(--red)'],
              ['In Progress', boardSummary.inProgressRequests || 0, 'var(--blue)'],
              ['Blocked', boardSummary.blockedRequests || 0, 'var(--red)'],
              ['High Priority', boardSummary.highPriorityRequests || 0, 'var(--yellow)'],
              ['Planned', boardSummary.plannedRequests || 0, 'var(--cyan)'],
              ['Assigned', boardSummary.assignedRequests || 0, 'var(--purple)'],
              ['Quality Check', boardSummary.qualityCheckRequests || 0, 'var(--yellow)'],
            ]} />
            <div style={{ overflowX: 'auto', display: 'flex', gap: '0.75rem', minHeight: 'calc(100vh - 285px)', alignItems: 'flex-start' }}>
              {BOARD_COLUMNS.map(column => {
                const cards = board[column.key] || [];
                return (
                  <div key={column.key} style={{ minWidth: 240, width: 240, flexShrink: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, borderTop: `3px solid ${column.color}`, display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 140px)' }}>
                    <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{column.label}</span>
                        <span style={{ background: cards.length > 0 ? `${column.color}22` : 'var(--bg-hover)', color: cards.length > 0 ? column.color : 'var(--text-muted)', borderRadius: '10px', padding: '0.1rem 0.5rem', fontSize: '0.72rem', fontWeight: 700 }}>{cards.length}</span>
                      </div>
                    </div>
                    <div style={{ padding: '0.5rem', overflowY: 'auto', flex: 1 }}>
                      {cards.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '1.5rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>Empty</div>
                      ) : (
                        cards.map(request => <RequestCard key={request.id} request={request} onClick={(id) => navigate(`/requests/${id}`)} />)
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : view === 'schedule' ? (
          <PrinterScheduleView navigate={navigate} filters={filters} setFilter={setFilter} options={filterOptions} query={query} operationalKpis={operationalKpis} />
        ) : view === 'calendar' ? (
          <CalendarView board={board} filters={filters} setFilter={setFilter} options={filterOptions} navigate={navigate} operationalKpis={operationalKpis} />
        ) : view === 'conflicts' ? (
          <ConflictCenterView filters={filters} setFilter={setFilter} options={filterOptions} query={query} navigate={navigate} operationalKpis={operationalKpis} />
        ) : view === 'gantt' ? (
          <GanttView
            board={board}
            filters={filters}
            setFilter={setFilter}
            options={filterOptions}
            navigate={navigate}
            operationalKpis={operationalKpis}
            conflictRequestIds={conflictRequestIds}
          />
        ) : view === 'capacity' ? (
          <CapacityForecastView
            filters={filters}
            setFilter={setFilter}
            options={filterOptions}
            operationalKpis={operationalKpis}
          />
        ) : (
          <TechnicianScheduleView navigate={navigate} filters={filters} setFilter={setFilter} options={filterOptions} query={query} operationalKpis={operationalKpis} />
        )}
      </div>
    </div>
  );
}

function PrinterScheduleView({ navigate, filters, setFilter, options, query, operationalKpis }) {
  const [schedule, setSchedule] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/planning/printer-schedule${query ? `?${query}` : ''}`)
      .then(res => {
        setSchedule(res.data.printers || []);
        setSummary(res.data.summary || {});
      })
      .catch(err => console.error('[Planning] Printer schedule failed:', err))
      .finally(() => setLoading(false));
  }, [query]);

  const rows = schedule.flatMap(printer => (printer.jobs || []).map(job => ({ ...job, printer_name: printer.printer_name })));
  const resources = mergePrinterSchedule(schedule, options.printers || [], filters.printer_id);

  return (
    <div className="page-body">
      <PlanningFilterBar filters={filters} setFilter={setFilter} options={options} />
      <PlanningOperationalKpis items={operationalKpis} />
      <KpiGrid items={[
        ['Total Printers', summary.totalPrinters || schedule.length],
        ['Total Jobs', summary.totalJobs || rows.length],
        ['Active Jobs', summary.activeJobs || 0, 'var(--blue)'],
        ['Overdue Jobs', summary.overdueJobs || 0, 'var(--red)'],
      ]} />
      {loading ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}><span className="spinner" /></div>
      ) : (
        <ResourcePlanningGrid
          resources={resources}
          getKey={printer => printer.printer_id}
          render={printer => <PrinterResourceCard printer={printer} navigate={navigate} />}
        />
      )}
    </div>
  );
}

function TechnicianScheduleView({ navigate, filters, setFilter, options, query, operationalKpis }) {
  const [technicians, setTechnicians] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/planning/technician-schedule${query ? `?${query}` : ''}`)
      .then(res => {
        setTechnicians(res.data.technicians || []);
        setSummary(res.data.summary || {});
      })
      .catch(err => console.error('[Planning] Technician schedule failed:', err))
      .finally(() => setLoading(false));
  }, [query]);

  const rows = technicians.flatMap(tech => (tech.requests || []).map(request => ({
    ...request,
    technician_name: tech.technicianName,
  })));

  return (
    <div className="page-body">
      <PlanningFilterBar filters={filters} setFilter={setFilter} options={options} />
      <PlanningOperationalKpis items={operationalKpis} />
      <KpiGrid items={[
        ['Total Technicians', summary.totalTechnicians || technicians.length],
        ['Assigned Requests', summary.totalAssignedRequests || rows.length],
        ['Avg Requests / Technician', summary.averageRequestsPerTechnician || 0],
        ['Overdue Requests', summary.overdueRequests || 0, 'var(--red)'],
      ]} />
      {loading ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}><span className="spinner" /></div>
      ) : (
        <ResourcePlanningGrid
          resources={technicians}
          getKey={technician => technician.technicianId}
          render={technician => <TechnicianResourceCard technician={technician} navigate={navigate} />}
        />
      )}
    </div>
  );
}

