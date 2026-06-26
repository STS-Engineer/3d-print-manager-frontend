import { PRODUCTION_TECHNICIAN, normalizeRole } from './roles';

export const STATUS_CONFIG = {
  draft:                  { label: 'Draft',                color: '#64748b', bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.3)' },
  submitted:              { label: 'Submitted',            color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.3)' },
  completeness_check:     { label: 'Completeness Check',   color: '#06b6d4', bg: 'rgba(6,182,212,0.12)',   border: 'rgba(6,182,212,0.3)' },
  feasibility_review:     { label: 'Feasibility Review',   color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)',  border: 'rgba(139,92,246,0.3)' },
  more_info_required:     { label: 'Info Required',        color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)' },
  approved:               { label: 'Approved',             color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.3)' },
  rejected:               { label: 'Rejected',             color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)' },
  prioritized:            { label: 'Prioritized',          color: '#f97316', bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.3)' },
  planned:                { label: 'Planned',              color: '#06b6d4', bg: 'rgba(6,182,212,0.12)',   border: 'rgba(6,182,212,0.3)' },
  assigned:               { label: 'Assigned',             color: '#a855f7', bg: 'rgba(168,85,247,0.12)',  border: 'rgba(168,85,247,0.3)' },
  in_progress:            { label: 'In Progress',          color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.3)' },
  printed:                { label: 'Printed',              color: '#10b981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.3)' },
  post_processing:        { label: 'Post-Processing',      color: '#06b6d4', bg: 'rgba(6,182,212,0.12)',   border: 'rgba(6,182,212,0.3)' },
  quality_check:          { label: 'Quality Check',        color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)' },
  ready_for_pickup:       { label: 'Completed Awaiting Confirmation', color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.3)' },
  completed:              { label: 'Completed',            color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.3)' },
  archived:               { label: 'Archived',             color: '#475569', bg: 'rgba(71,85,105,0.12)',   border: 'rgba(71,85,105,0.3)' },
  on_hold:                { label: 'On Hold',              color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)' },
  blocked:                { label: 'Blocked',              color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)' },
  cancelled:              { label: 'Cancelled',            color: '#475569', bg: 'rgba(71,85,105,0.12)',   border: 'rgba(71,85,105,0.3)' },
  rework_required:        { label: 'Rework Required',      color: '#f97316', bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.3)' },
  waiting_for_material:   { label: 'Waiting Material',     color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)' },
  waiting_for_machine:    { label: 'Waiting Machine',      color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)' },
  requester_confirmation: { label: 'Waiting Customer Confirmation', color: '#06b6d4', bg: 'rgba(6,182,212,0.12)',   border: 'rgba(6,182,212,0.3)' },
};

export const PRIORITY_CONFIG = {
  critical: { label: 'Critical', className: 'priority-critical' },
  high:     { label: 'High',     className: 'priority-high' },
  normal:   { label: 'Normal',   className: 'priority-normal' },
  low:      { label: 'Low',      className: 'priority-low' },
};

export const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || { label: status, color: '#64748b', bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.3)' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '0.2rem 0.6rem',
      borderRadius: '4px',
      fontSize: '0.72rem',
      fontWeight: 600,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      color: cfg.color,
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  );
};

export const PriorityBadge = ({ priority }) => {
  const cfg = PRIORITY_CONFIG[priority] || { label: priority, className: 'priority-normal' };
  return <span className={`badge ${cfg.className}`}>{cfg.label}</span>;
};

const safeDate = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatDate = (dateStr) => {
  const date = safeDate(dateStr);
  if (!date) return '-';
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const formatDateTime = (dateStr) => {
  const date = safeDate(dateStr);
  if (!date) return '-';
  return date.toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const isOverdue = (request) => {
  const approvedDueDate = safeDate(request.approved_due_date);
  if (!approvedDueDate) return false;
  if (['completed', 'archived', 'requester_confirmation', 'cancelled'].includes(request.status)) return false;
  return approvedDueDate < new Date();
};

// Status transitions per role
export const getAvailableTransitions = (currentStatus, role) => {
  const transitions = {
    [PRODUCTION_TECHNICIAN]: {
      draft: [],
      submitted: ['completeness_check', 'more_info_required', 'rejected'],
      completeness_check: ['feasibility_review', 'more_info_required', 'rejected'],
      feasibility_review: ['approved', 'rejected', 'more_info_required'],
      more_info_required: ['completeness_check'],
      approved: ['prioritized', 'on_hold', 'cancelled'],
      prioritized: ['planned', 'on_hold', 'cancelled'],
      planned: ['assigned', 'on_hold', 'waiting_for_material', 'waiting_for_machine', 'cancelled'],
      assigned: ['in_progress', 'on_hold', 'blocked', 'cancelled'],
      in_progress: ['printed', 'blocked', 'on_hold', 'waiting_for_material', 'waiting_for_machine'],
      printed: ['quality_check'],
      post_processing: ['quality_check', 'rework_required'],
      quality_check: ['ready_for_pickup', 'rework_required'],
      ready_for_pickup: ['requester_confirmation'],
      requester_confirmation: [],
      on_hold: ['approved', 'prioritized', 'planned', 'assigned', 'cancelled'],
      blocked: ['in_progress', 'assigned', 'cancelled', 'on_hold'],
      waiting_for_material: ['planned', 'assigned', 'cancelled'],
      waiting_for_machine: ['planned', 'assigned', 'cancelled'],
      rework_required: ['rework_required', 'in_progress'],
      completed: ['archived'],
      cancelled: ['archived'],
      rejected: ['archived'],
    },
    requester: {
      draft: ['submitted'],
      requester_confirmation: ['completed'],
      more_info_required: ['submitted'],
    },
    manager: {},
    administrator: {
      completed: ['archived'],
      cancelled: ['archived'],
      rejected: ['archived'],
    },
  };

  const roleTransitions = transitions[normalizeRole(role)] || {};
  return roleTransitions[currentStatus] || [];
};
