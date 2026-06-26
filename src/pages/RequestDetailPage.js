import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { StatusBadge, PriorityBadge, formatDate, formatDateTime, getAvailableTransitions, STATUS_CONFIG } from '../utils/statusHelpers';
import { FeasibilityPanel, QualityCheckPanel } from '../components/requests/FeasibilityQualityPanels';
import Sidebar from '../components/common/Sidebar';
import { DatePicker, DateTimePicker } from '../components/common/DatePicker';
import { isProductionTechnician } from '../utils/roles';

const FIXED_COST = 9.86;

const hasValue = (value) => value !== null && value !== undefined && value !== '';
const orStar = (value) => (hasValue(value) ? value : '*');

const formatMinutesAsDuration = (value) => {
  const minutes = parseFloat(value);
  if (!Number.isFinite(minutes) || minutes < 0) return null;
  const wholeMinutes = Math.round(minutes);
  const hours = Math.floor(wholeMinutes / 60);
  const mins = wholeMinutes % 60;
  if (hours > 0 && mins > 0) return `${hours} h ${mins} min`;
  if (hours > 0) return `${hours} h`;
  return `${mins} min`;
};

const calculateDurationMinutes = (startTime, endTime) => {
  if (!startTime || !endTime) return null;
  const start = new Date(startTime);
  const end = new Date(endTime);
  const minutes = (end.getTime() - start.getTime()) / 60000;
  return Number.isFinite(minutes) && minutes >= 0 ? minutes : null;
};

const money = (value) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? `${n.toFixed(2)} €` : null;
};

const calculateActualPrintTimeMinutes = (startTime, endTime = new Date()) => {
  if (!startTime) return null;
  const start = new Date(startTime);
  const end = new Date(endTime);
  const minutes = (end.getTime() - start.getTime()) / 60000;
  return Number.isFinite(minutes) && minutes >= 0 ? minutes : null;
};

const calculateConfiguredCost = (materialQty, materialRate, printTimeMinutes, printerRate) => {
  const qty = parseFloat(materialQty);
  const material = parseFloat(materialRate);
  const minutes = parseFloat(printTimeMinutes);
  const printer = parseFloat(printerRate);
  if (![qty, material, minutes, printer].every(Number.isFinite)) return null;
  return (qty * material) + (minutes * printer) + FIXED_COST;
};

const calculatePlannedDurationHours = (startTime, endTime) => {
  if (!startTime || !endTime) return null;
  const start = new Date(startTime);
  const end = new Date(endTime);
  const hours = (end.getTime() - start.getTime()) / 3600000;
  return Number.isFinite(hours) ? hours : null;
};

const calculatePlannedEndDateTime = (startTime, totalPrintTimeMinutes) => {
  const minutes = parseFloat(totalPrintTimeMinutes);
  if (!startTime || !Number.isFinite(minutes) || minutes <= 0) return '';
  const start = new Date(startTime);
  if (Number.isNaN(start.getTime())) return '';
  return toDateTimeLocal(new Date(start.getTime() + (minutes * 60000)));
};

const calculateEndDateFromPrintTime = (startTime, totalPrintTimeMinutes) => {
  const minutes = parseFloat(totalPrintTimeMinutes);
  if (!startTime || !Number.isFinite(minutes) || minutes < 0) return null;
  const start = new Date(startTime);
  if (Number.isNaN(start.getTime())) return null;
  return new Date(start.getTime() + (minutes * 60000));
};

const toDateTimeLocal = (date) => {
  if (!date || Number.isNaN(date.getTime())) return '';
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const numberOrZero = (value) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
};

const isStlAttachment = (file) => String(file?.file_type || '').toLowerCase() === 'stl'
  || String(file?.original_name || '').toLowerCase().endsWith('.stl');

// ── Authenticated file download via Axios (sends JWT token) ─────────────────
const downloadAttachment = async (requestId, fileId, originalName, setDownloadingId) => {
  if (setDownloadingId) setDownloadingId(fileId);
  try {
    const response = await api.get(
      `/requests/${requestId}/files/${fileId}/download`,
      { responseType: 'blob' }
    );
    // Detect content type from response
    const contentType = response.headers['content-type'] || 'application/octet-stream';
    const blob = new Blob([response.data], { type: contentType });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href  = url;
    link.setAttribute('download', originalName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('[Download] Failed:', err);
    const msg = err.response?.data?.error || err.response?.status === 404
      ? 'File not found on server. It may have been deleted.'
      : 'Download failed. Please try again.';
    alert(msg);
  } finally {
    if (setDownloadingId) setDownloadingId(null);
  }
};

const downloadRequestPdf = async (requestId, requestNumber, setDownloadingPdf) => {
  setDownloadingPdf(true);
  try {
    const response = await api.get(`/requests/${requestId}/pdf`, { responseType: 'blob' });
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Request_${requestNumber || 'request'}.pdf`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('[PDF Download] Failed:', err);
    alert(err.response?.data?.error || 'PDF download failed. Please try again.');
  } finally {
    setDownloadingPdf(false);
  }
};

const DetailRow = ({ label, value }) => (
  value ? (
    <div style={{ display: 'flex', gap: '1rem', padding: '0.6rem 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ width: 180, flexShrink: 0, fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', paddingTop: '0.1rem' }}>{label}</div>
      <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{value}</div>
    </div>
  ) : null
);

const StarRating = ({ value = 0, onChange, readOnly = false }) => {
  const [hoverValue, setHoverValue] = useState(0);
  const activeValue = hoverValue || value || 0;

  return (
    <div
      role="radiogroup"
      onMouseLeave={() => setHoverValue(0)}
      style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}
    >
      {[1, 2, 3, 4, 5].map(star => {
        const isActive = star <= activeValue;
        return (
          <span
            key={star}
            role="radio"
            aria-checked={value === star}
            tabIndex={readOnly ? -1 : 0}
            onClick={() => !readOnly && onChange(star)}
            onMouseEnter={() => !readOnly && setHoverValue(star)}
            onKeyDown={(event) => {
              if (readOnly) return;
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onChange(star);
              }
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              color: isActive ? 'var(--yellow)' : 'var(--border-light)',
              fontSize: '1.45rem',
              cursor: readOnly ? 'default' : 'pointer',
              lineHeight: 1,
              userSelect: 'none',
              pointerEvents: readOnly ? 'none' : 'auto',
              transition: 'color 0.12s ease, transform 0.12s ease',
              transform: hoverValue === star ? 'scale(1.08)' : 'scale(1)',
            }}
            title={`${star} star${star > 1 ? 's' : ''}`}
          >
            ★
          </span>
        );
      })}
    </div>
  );
};

const ratingLabel = (value) => ({
  1: 'Very Dissatisfied',
  2: 'Dissatisfied',
  3: 'Neutral',
  4: 'Satisfied',
  5: 'Very Satisfied',
}[value] || 'Not rated');

const fulfillmentLabel = (value) => ({
  fully_met: 'Fully Met Expectations',
  partially_met: 'Partially Met Expectations',
  not_met: 'Did Not Meet Expectations',
}[value] || value);

const recommendationLabel = (value) => ({
  yes: 'Yes',
  maybe: 'Maybe',
  no: 'No',
}[value] || value);

const auditFieldLabels = {
  status: 'Status',
  priority: 'Priority',
  priority_reason: 'Priority Reason',
  assigned_technician_id: 'Technician',
  technician_id: 'Technician',
  printer_id: 'Printer',
  material_id: 'Material',
  category_id: 'Category',
  site_id: 'Site',
  sla_breach_at: 'SLA Due Date',
  requested_due_date: 'Requested Due Date',
  approved_due_date: 'Approved Due Date',
  approved_at: 'Approval Date',
  planned_start_date: 'Planned Start',
  planned_end_date: 'Planned End',
  production_material_usage_per_part: 'Material Usage Per Part',
  production_print_time_per_part_minutes: 'Print Time Per Part',
  production_total_material_usage: 'Total Material Usage',
  production_total_print_time_minutes: 'Total Print Time',
  submitted_at: 'Submission Date',
  assigned_at: 'Assignment Date',
  ready_at: 'Ready for Pickup Date',
  qc_started_at: 'Quality Check Start',
  print_start: 'Print Start',
  print_end: 'Print End',
  actual_start_time: 'Print Start',
  actual_end_time: 'Print End',
  actual_duration: 'Print Duration',
  actual_cost: 'Actual Cost',
  price_per_kg: 'Material Price',
  material_reserved_qty: 'Reserved Material',
  material_reserved_spool: 'Material Spool',
  material_reserved_at: 'Material Reserved',
  material_reserved: 'Material Reserved',
  material_reserved_by: 'Reserved By',
  material_used_grams: 'Material Used',
  quantity: 'Quantity',
  printed_quantity: 'Printed Quantity',
  rejected_quantity: 'Rejected Quantity',
  reprint_quantity: 'Reprint Quantity',
  final_quantity: 'Final Quantity',
  quality_result: 'Quality Result',
  quality_notes: 'Quality Notes',
  qc_reference: 'Quality Reference',
  dimensional_check: 'Dimensional Check',
  surface_quality_check: 'Surface Quality Check',
  functional_check: 'Functional Check',
  visual_check: 'Visual Check',
  deviation_notes: 'Deviation Notes',
  scrap_count: 'Scrap Count',
  rework_required: 'Rework Required',
  rework_reason: 'Rework Reason',
  rejection_reason: 'Rejection Reason',
  blocking_reason: 'Blocking Reason',
  on_hold_reason: 'On-Hold Reason',
  cancellation_reason: 'Cancellation Reason',
  info_required_reason: 'Information Required',
  reception_comment: 'Reception Comment',
  reception_condition: 'Reception Condition',
  requester_confirmation: 'Customer Confirmation',
  reception_confirmed_by: 'Confirmed By',
  reception_confirmed_at: 'Confirmation Date',
  completion_date: 'Completion Date',
  archive_date: 'Archive Date',
  lessons_learned: 'Lessons Learned',
  original_name: 'File Name',
  file_type: 'File Type',
  file_size: 'File Size',
  attachment_id: 'Attachment',
  comment_id: 'Comment',
  content: 'Comment',
  status_comment: 'Workflow Comment',
};

const majorAuditActions = new Set([
  'request_created',
  'request_submitted',
  'completeness_check',
  'feasibility_review',
  'request_approved',
  'request_rejected',
  'request_prioritized',
  'request_planned',
  'request_assigned',
  'production_started',
  'request_printed',
  'quality_check_started',
  'rework_required',
  'waiting_customer_confirmation',
  'customer_confirmation_received',
  'request_completed',
  'request_archived',
  'request_cancelled',
  'automatic_cost_recalculated',
  'material_changed',
  'printer_changed',
  'quantity_changed',
  'material_changed_during_planning',
  'printer_changed_during_planning',
  'quantity_changed_during_planning',
  'reserved_quantity_adjusted',
  'inventory_risk_detected',
  'planned_end_auto_calculated',
  'planned_end_manually_adjusted',
  'cost_recalculated',
  'production_report_submitted',
]);

const workflowActions = new Set([
  'request_created',
  'request_submitted',
  'completeness_check',
  'feasibility_review',
  'request_approved',
  'request_rejected',
  'request_completed',
  'request_cancelled',
  'request_blocked',
  'request_on_hold',
  'more_info_required',
]);

const statusAuditLabel = (value) => STATUS_CONFIG[value]?.label || String(value || '').replace(/_/g, ' ');

const formatAuditDateValue = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const isIsoDateLike = (value) => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}(T|\s|$)/.test(value)
  && !Number.isNaN(new Date(value).getTime());

const isUuidLike = (value) => typeof value === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const auditDisplayValue = (value, field = '') => {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (field === 'status') return statusAuditLabel(value);
  if (field === 'priority') return String(value).charAt(0).toUpperCase() + String(value).slice(1);
  if (field.includes('cost') || field === 'price_per_kg') {
    const n = parseFloat(value);
    if (Number.isFinite(n)) return `${n.toFixed(2)} EUR`;
  }
  if (field.includes('material') && (field.includes('qty') || field.includes('grams'))) {
    const n = parseFloat(value);
    if (Number.isFinite(n)) return `${n.toFixed(1)} g`;
  }
  if (field.includes('date') || field.endsWith('_at') || isIsoDateLike(value)) {
    return formatAuditDateValue(value) || String(value);
  }
  if (field === 'file_size') {
    const n = parseFloat(value);
    if (Number.isFinite(n)) return `${(n / 1024 / 1024).toFixed(2)} MB`;
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const technicalAuditFields = new Set([
  'approved_at','submitted_at','assigned_at','material_reserved_at','qc_date',
  'reception_confirmed_at','attachment_id','comment_id','lead_time_hours',
  'requester_confirmation','qc_reference','status_comment',
]);

const hiddenInternalAuditFields = new Set(['attachment_id', 'comment_id']);

const preferredBusinessFields = [
  'status','priority','approved_due_date','planned_start_date','planned_end_date',
  'assigned_technician_id','printer_id','material_id','quantity','printed_quantity',
  'rejected_quantity','material_used_grams','actual_duration',
  'production_material_usage_per_part','production_print_time_per_part_minutes',
  'production_total_material_usage','production_total_print_time_minutes',
  'actual_cost','quality_result','rework_required','rework_reason','rejection_reason',
  'blocking_reason','cancellation_reason','original_name','content','archive_date',
  'completion_date','reception_confirmed_by','reception_condition','material_reserved_qty',
  'material_reserved_by','ready_at',
  'qc_started_at','print_start','print_end','sla_breach_at',
];

const getAuditCategory = (log, field = '') => {
  const action = String(log.action || '').toLowerCase();
  const key = String(field || '').toLowerCase();
  if (action === 'request_archived' || log.event_category === 'archive' || action.includes('archive') || key.includes('archive')) {
    return { key: 'archive', label: 'Archive', color: '#64748b', icon: 'BOX', important: true };
  }
  if (['production_started', 'request_printed'].includes(action)) {
    return { key: 'production', label: 'Production', color: 'var(--cyan)', icon: 'PRN', important: true };
  }
  if (['quality_check_started', 'rework_required'].includes(action)) {
    return { key: 'quality', label: 'Quality', color: 'var(--red)', icon: 'QC', important: true };
  }
  if (['waiting_customer_confirmation', 'customer_confirmation_received'].includes(action)) {
    return { key: 'customer', label: 'Customer', color: 'var(--cyan)', icon: 'CUS', important: true };
  }
  if (action === 'request_assigned') {
    return { key: 'assignment', label: 'Assignment', color: 'var(--yellow)', icon: 'USR', important: true };
  }
  if (['request_planned', 'request_prioritized'].includes(action)) {
    return { key: 'planning', label: 'Planning', color: 'var(--accent)', icon: 'PLAN', important: true };
  }
  if (workflowActions.has(action) || log.event_category === 'workflow' || log.event_category === 'status' || key === 'status') {
    return { key: 'workflow', label: 'Workflow', color: 'var(--blue)', icon: action.includes('complete') ? 'OK' : 'WF', important: true };
  }
  if (log.event_category === 'customer' || key.includes('reception') || key.includes('requester_confirmation') || action.includes('customer')) {
    return { key: 'customer', label: 'Customer', color: 'var(--cyan)', icon: 'CUS', important: true };
  }
  if (log.event_category === 'attachment' || action.includes('file') || key.includes('attachment') || key.includes('original_name')) {
    return { key: 'attachment', label: 'Attachment', color: '#38bdf8', icon: 'ATT' };
  }
  if (log.event_category === 'assignment' || key.includes('technician') || key.includes('printer') || key === 'material_id' || action.includes('assign')) {
    return { key: 'assignment', label: 'Assignment', color: 'var(--yellow)', icon: 'USR', important: action.includes('assign') };
  }
  if (key.includes('planned') || key.includes('due_date') || key.includes('sla') || action.includes('reschedule')) {
    return { key: 'planning', label: 'Planning', color: 'var(--accent)', icon: 'PLAN' };
  }
  if (key.includes('cost') || key.includes('price')) {
    return { key: 'cost', label: 'Cost', color: 'var(--orange, #f97316)', icon: 'EUR', important: true };
  }
  if (key.includes('quality') || key.includes('scrap') || key.includes('rework') || key.includes('qc')) {
    return { key: 'quality', label: 'Quality', color: 'var(--red)', icon: 'QC', important: key.includes('rework') || String(log.new_values?.quality_result || '').toLowerCase().includes('fail') };
  }
  if (action.includes('comment') || key.includes('comment') || key === 'content') {
    return { key: 'comment', label: 'Comment', color: 'var(--green)', icon: 'COM' };
  }
  if (key.includes('print') || key.includes('duration') || key.includes('material_used') || key.includes('material_reserved') || key.includes('ready_at')) {
    return { key: 'production', label: 'Production', color: 'var(--cyan)', icon: 'PRN' };
  }
  return { key: 'workflow', label: 'Workflow', color: 'var(--text-muted)', icon: 'WF' };
};

const actionLabel = (log, field = '') => {
  const action = String(log.action || '');
  const category = getAuditCategory(log, field);
  const fieldLabel = auditFieldLabels[field] || field;
  const lifecycleLabels = {
    request_created: 'Request Created',
    request_submitted: 'Request Submitted',
    completeness_check: 'Completeness Check Started',
    feasibility_review: 'Feasibility Review Started',
    request_approved: 'Request Approved',
    request_rejected: 'Request Rejected',
    request_prioritized: 'Request Prioritized',
    request_planned: 'Request Planned',
    request_assigned: 'Request Assigned',
    production_started: 'Printing Started',
    request_printed: 'Printing Completed',
    quality_check_started: 'Quality Check Started',
    rework_required: 'Rework Required',
    waiting_customer_confirmation: 'Waiting Customer Confirmation',
    request_completed: 'Request Completed',
    request_archived: 'Request Archived',
    request_cancelled: 'Request Cancelled',
    request_blocked: 'Request Blocked',
    request_on_hold: 'Request Put On Hold',
    more_info_required: 'More Information Requested',
    file_uploaded: 'File Uploaded',
    file_removed: 'File Removed',
    stl_uploaded: 'STL Uploaded',
    stl_replaced: 'STL Replaced',
    stl_removed: 'STL Removed',
    stl_metadata_generated: 'STL Stored',
    material_changed: 'Material Changed',
    printer_changed: 'Printer Changed',
    quantity_changed: 'Quantity Changed',
    material_changed_during_planning: 'Material Changed During Planning',
    printer_changed_during_planning: 'Printer Changed During Planning',
    quantity_changed_during_planning: 'Quantity Changed During Planning',
    reserved_quantity_adjusted: 'Reserved Quantity Adjusted',
    inventory_risk_detected: 'Inventory Risk Detected',
    planned_end_auto_calculated: 'Planned End Auto Calculated',
    planned_end_manually_adjusted: 'Planned End Manually Adjusted',
    manual_planning_data_entered: 'Planning Data Entered',
    cost_recalculated: 'Cost Recalculated',
    production_report_submitted: 'Production Report Submitted',
    comment_added: 'Comment Added',
    reschedule: 'Planning Updated',
  };
  if (lifecycleLabels[action]) return lifecycleLabels[action];
  if (field === 'assigned_technician_id') return log.old_values?.[field] ? 'Technician Changed' : 'Technician Assigned';
  if (field === 'printer_id') return log.old_values?.[field] ? 'Printer Changed' : 'Printer Assigned';
  if (field === 'material_id') return log.old_values?.[field] ? 'Material Changed' : 'Material Assigned';
  if (field === 'status') return 'Status Changed';
  if (field === 'completion_date') return 'Request Completed';
  if (field === 'archive_date') return 'Request Archived';
  if (field === 'reception_confirmed_by' || field === 'reception_confirmed_at') return 'Customer Confirmation Received';
  if (category.key === 'assignment') return `${fieldLabel || 'Assignment'} Changed`;
  if (category.key === 'planning') return `${fieldLabel || 'Planning'} Updated`;
  if (category.key === 'cost') return `${fieldLabel || 'Cost'} Updated`;
  if (category.key === 'quality') return `${fieldLabel || 'Quality'} Updated`;
  if (category.key === 'attachment') return action.includes('removed') ? 'File Removed' : 'File Uploaded';
  if (category.key === 'comment') return 'Comment Added';
  return fieldLabel ? `${fieldLabel} Changed` : String(log.action || 'Change');
};

const chooseBusinessFields = (log, fields) => {
  if (['request_created', 'comment_added', 'file_uploaded', 'file_removed', 'stl_uploaded', 'stl_replaced', 'stl_removed', 'stl_metadata_generated', 'automatic_cost_recalculated', 'material_changed', 'printer_changed', 'quantity_changed', 'material_changed_during_planning', 'printer_changed_during_planning', 'quantity_changed_during_planning', 'reserved_quantity_adjusted', 'inventory_risk_detected', 'planned_end_auto_calculated', 'planned_end_manually_adjusted', 'manual_planning_data_entered', 'cost_recalculated', 'production_report_submitted'].includes(log.action)) {
    return fields.filter(field => !['comment_id', 'attachment_id'].includes(field));
  }
  const meaningful = fields.filter(field => !technicalAuditFields.has(field));
  if (meaningful.includes('status')) return ['status', ...meaningful.filter(field => field !== 'status')];
  const preferred = preferredBusinessFields.filter(field => meaningful.includes(field));
  return preferred.length ? preferred : meaningful;
};

const buildAuditEntries = (logs = [], displayMode = 'major') => logs.flatMap(log => {
  if (displayMode === 'major' && !majorAuditActions.has(log.action)) return [];
  const oldValues = log.old_values || {};
  const newValues = log.new_values || {};
  let fields = Array.from(new Set([...Object.keys(oldValues), ...Object.keys(newValues)]));
  fields = displayMode === 'major'
    ? chooseBusinessFields(log, fields)
    : fields.filter(field => !hiddenInternalAuditFields.has(field));
  const category = getAuditCategory(log, fields[0]);
  const action = actionLabel(log, fields[0]);

  if (!fields.length) {
    return [{
      id: log.id,
      log,
      field: '',
      fieldLabel: 'Event',
      oldValue: '-',
      newValue: action,
      action,
      category,
      changes: [],
    }];
  }

  const changes = fields.map(field => {
    const displayValues = log.display_values?.[field] || {};
    const oldValue = displayValues.old ?? oldValues[field];
    const newValue = displayValues.new ?? newValues[field];
    return {
      field,
      fieldLabel: auditFieldLabels[field] || field.replace(/_/g, ' '),
      oldValue: auditDisplayValue(oldValue, field),
      newValue: auditDisplayValue(newValue, field),
      technical: isUuidLike(oldValues[field]) || isUuidLike(newValues[field]) || technicalAuditFields.has(field),
    };
  });

  const primaryChange = changes.find(change => change.field === 'status') || changes[0] || {};
  return [{
    id: log.id,
    log,
    field: primaryChange.field || '',
    fieldLabel: primaryChange.fieldLabel || 'Event',
    oldValue: primaryChange.oldValue || '-',
    newValue: primaryChange.newValue || '-',
    action,
    category,
    changes,
  }];
});

const AuditTrailPanel = ({
  requestId,
  user,
  formatDateTime,
}) => {
  const [logs, setLogs] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditError, setAuditError] = useState('');
  const [view, setView] = useState(() => localStorage.getItem('auditTrailView') || 'timeline');
  const [displayMode, setDisplayMode] = useState(() => localStorage.getItem('auditTrailDisplayMode') || 'major');
  const [filters, setFilters] = useState({ user: '', action: '', dateFrom: '', dateTo: '', search: '' });
  const [exporting, setExporting] = useState('');
  const actionTypes = [
    { value: 'workflow', label: 'Workflow Events' },
    { value: 'assignment', label: 'Assignment Changes' },
    { value: 'planning', label: 'Planning Changes' },
    { value: 'production', label: 'Production Events' },
    { value: 'cost', label: 'Cost Changes' },
    { value: 'quality', label: 'Quality Events' },
    { value: 'comment', label: 'Comment Events' },
    { value: 'attachment', label: 'Attachment Events' },
    { value: 'customer', label: 'Customer Events' },
    { value: 'archive', label: 'Archive Events' },
  ];

  const loadAuditLogs = useCallback(async () => {
    setLoadingAudit(true);
    setAuditError('');
    try {
      const params = new URLSearchParams();
      if (filters.user) params.set('performed_by', filters.user);
      if (filters.action) params.set('action_category', filters.action);
      if (filters.dateFrom) params.set('date_from', filters.dateFrom);
      if (filters.dateTo) params.set('date_to', filters.dateTo);
      if (filters.search) params.set('search', filters.search);
      const res = await api.get(`/audit-logs/request/${requestId}${params.toString() ? `?${params}` : ''}`);
      setLogs(res.data || []);
    } catch (err) {
      setAuditError(err.response?.data?.error || 'Unable to load audit trail');
    } finally {
      setLoadingAudit(false);
    }
  }, [requestId, filters]);

  useEffect(() => { loadAuditLogs(); }, [loadAuditLogs]);

  const effectiveDisplayMode = (user?.role === 'administrator' || isProductionTechnician(user?.role)) ? displayMode : 'major';
  const entries = buildAuditEntries(logs, effectiveDisplayMode);
  const detailedEntries = buildAuditEntries(logs, 'detailed');
  const majorEntries = buildAuditEntries(logs, 'major');
  const users = Array.from(new Map(logs.map(log => [
    log.performed_by || log.performed_by_name || log.performer_email || 'system',
    {
      id: log.performed_by || '',
      name: log.performed_by_name || log.performer_email || 'System',
    },
  ])).values()).filter(item => item.id);
  const countByCategory = (key) => detailedEntries.filter(entry => entry.category.key === key).length;

  const setViewPref = (next) => {
    setView(next);
    localStorage.setItem('auditTrailView', next);
  };

  const setDisplayModePref = (next) => {
    setDisplayMode(next);
    localStorage.setItem('auditTrailDisplayMode', next);
  };

  const exportAudit = async (format) => {
    setExporting(format);
    try {
      const params = new URLSearchParams({ format });
      if (filters.user) params.set('performed_by', filters.user);
      if (filters.action) params.set('action_category', filters.action);
      if (filters.dateFrom) params.set('date_from', filters.dateFrom);
      if (filters.dateTo) params.set('date_to', filters.dateTo);
      if (filters.search) params.set('search', filters.search);
      params.set('scope', effectiveDisplayMode === 'major' ? 'major' : 'full');
      const response = await api.get(`/audit-logs/request/${requestId}/export?${params}`, { responseType: 'blob' });
      const type = format === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const blob = new Blob([response.data], { type });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `request-${requestId}-audit-trail.${format === 'pdf' ? 'pdf' : 'xlsx'}`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.response?.data?.error || 'Audit export failed');
    } finally {
      setExporting('');
    }
  };

  return (
    <div className="audit-trail">
      <div className="audit-summary-grid">
        <div className="audit-summary-tile"><span>Total Changes</span><strong>{detailedEntries.length}</strong></div>
        <div className="audit-summary-tile"><span>Major Events</span><strong>{majorEntries.length}</strong></div>
        <div className="audit-summary-tile"><span>Comments</span><strong>{countByCategory('comment')}</strong></div>
        <div className="audit-summary-tile"><span>Attachments</span><strong>{countByCategory('attachment')}</strong></div>
        <div className="audit-summary-tile"><span>Assignments</span><strong>{countByCategory('assignment')}</strong></div>
        <div className="audit-summary-tile"><span>Cost Updates</span><strong>{countByCategory('cost')}</strong></div>
        <div className="audit-summary-tile"><span>Last Modified</span><strong>{logs[0]?.created_at ? formatDateTime(logs[0].created_at) : '-'}</strong></div>
      </div>

      <div className="card audit-toolbar">
        <div className="audit-filters">
          <input className="form-input" placeholder="Search user, field, value, comment" value={filters.search} onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))} />
          <select className="form-select" value={filters.user} onChange={e => setFilters(prev => ({ ...prev, user: e.target.value }))}>
            <option value="">All users</option>
            {users.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select className="form-select" value={filters.action} onChange={e => setFilters(prev => ({ ...prev, action: e.target.value }))}>
            <option value="">All action types</option>
            {actionTypes.map(action => <option key={action.value} value={action.value}>{action.label}</option>)}
          </select>
          <DatePicker value={filters.dateFrom} onChange={value => setFilters(prev => ({ ...prev, dateFrom: value }))} placeholder="From" />
          <DatePicker value={filters.dateTo} onChange={value => setFilters(prev => ({ ...prev, dateTo: value }))} placeholder="To" />
        </div>
        <div className="audit-actions">
          <div className="audit-view-toggle">
            <button className={`btn btn-sm ${effectiveDisplayMode === 'major' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setDisplayModePref('major')}>Major Events</button>
            {(user?.role === 'administrator' || isProductionTechnician(user?.role)) && (
              <button className={`btn btn-sm ${effectiveDisplayMode === 'detailed' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setDisplayModePref('detailed')}>Detailed View</button>
            )}
          </div>
          <div className="audit-view-toggle">
            <button className={`btn btn-sm ${view === 'timeline' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewPref('timeline')}>Timeline</button>
            <button className={`btn btn-sm ${view === 'table' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewPref('table')}>Table</button>
          </div>
          {user?.role === 'administrator' && (
            <>
              <button className="btn btn-secondary btn-sm" disabled={Boolean(exporting)} onClick={() => exportAudit('excel')}>{exporting === 'excel' ? 'Exporting...' : `Excel (${effectiveDisplayMode === 'major' ? 'Major' : 'Full'})`}</button>
              <button className="btn btn-secondary btn-sm" disabled={Boolean(exporting)} onClick={() => exportAudit('pdf')}>{exporting === 'pdf' ? 'Exporting...' : `PDF (${effectiveDisplayMode === 'major' ? 'Major' : 'Full'})`}</button>
            </>
          )}
        </div>
      </div>

      {auditError && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{auditError}</div>}
      {loadingAudit ? (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}><span className="spinner" /></div>
      ) : entries.length === 0 ? (
        <div className="card empty-state"><p>No audit events match the current filters.</p></div>
      ) : view === 'timeline' ? (
        <div className="audit-timeline">
          {entries.map(entry => (
            <div className={`audit-entry ${entry.category.important ? 'audit-entry-important' : ''}`} key={entry.id} style={{ '--audit-color': entry.category.color }}>
              <div className="audit-marker" />
              <div className="audit-entry-card">
                <div className="audit-entry-head">
                  <div>
                    <div className="audit-entry-time">{formatDateTime(entry.log.created_at)}</div>
                    <div className="audit-entry-user">{entry.log.performed_by_name || entry.log.performer_email || 'System'} <span>{entry.log.performer_role || 'Role n/a'}</span></div>
                  </div>
                  <span className="audit-category" style={{ borderColor: entry.category.color, color: entry.category.color }}>{entry.category.label}</span>
                </div>
                <div className="audit-action-title"><span className="audit-event-icon">{entry.category.icon}</span>{entry.action}</div>
                {entry.changes?.length ? (
                  <div className="audit-change-list">
                    <span>Changes</span>
                    {entry.changes.map(change => (
                      <div className="audit-change-line" key={`${entry.id}-${change.field}`}>
                        <strong>{change.fieldLabel}</strong>
                        <span>{change.oldValue !== '-' ? `${change.oldValue} -> ` : ''}{change.newValue}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="audit-change-list">
                    <span>Event</span>
                    <div className="audit-change-line"><strong>{entry.fieldLabel}</strong><span>{entry.newValue}</span></div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card table-container">
          <table>
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>User</th>
                <th>Role</th>
                <th>Event Category</th>
                <th>Event Description</th>
                <th>Field Modified</th>
                <th>Old Value</th>
                <th>New Value</th>
              </tr>
            </thead>
            <tbody>
              {entries.flatMap(entry => (entry.changes?.length ? entry.changes : [entry]).map(change => (
                <tr key={`${entry.id}-${change.field || 'event'}`}>
                  <td>{formatDateTime(entry.log.created_at)}</td>
                  <td>{entry.log.performed_by_name || entry.log.performer_email || 'System'}</td>
                  <td>{entry.log.performer_role || '-'}</td>
                  <td><span className="audit-category" style={{ borderColor: entry.category.color, color: entry.category.color }}>{entry.category.label}</span></td>
                  <td>{entry.action}</td>
                  <td>{change.fieldLabel || entry.fieldLabel}</td>
                  <td>{change.oldValue || entry.oldValue}</td>
                  <td>{change.newValue || entry.newValue}</td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const ReceptionConfirmedBadge = () => (
  <span
    className="badge"
    style={{
      background: 'var(--green-dim)',
      color: 'var(--green)',
      border: '1px solid rgba(34,197,94,0.3)',
      fontWeight: 700,
      whiteSpace: 'nowrap',
    }}
  >
    Reception Confirmed
  </span>
);

export default function RequestDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('details');
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [statusComment, setStatusComment] = useState('');
  const [statusReason, setStatusReason] = useState('');
  const [statusApprovedDate, setStatusApprovedDate] = useState('');
  const [statusTechId, setStatusTechId] = useState('');
  const [statusQuantity, setStatusQuantity] = useState('');
  const [statusPrinterId, setStatusPrinterId] = useState('');
  const [statusMaterialId, setStatusMaterialId] = useState('');
  const [statusPlannedStart, setStatusPlannedStart] = useState('');
  const [statusPlannedEnd, setStatusPlannedEnd] = useState('');
  const [statusPlannedEndManual, setStatusPlannedEndManual] = useState(false);
  const [statusMaterialUsagePerPart, setStatusMaterialUsagePerPart] = useState('');
  const [statusPrintTimePerPart, setStatusPrintTimePerPart] = useState('');
  const [statusMaterialSpool, setStatusMaterialSpool] = useState('');
  const [statusPrintedQty, setStatusPrintedQty] = useState('');
  const [statusRejectedQty, setStatusRejectedQty] = useState('');
  const [statusReceptionComment, setStatusReceptionComment] = useState('');
  const [statusReceptionCondition, setStatusReceptionCondition] = useState('ok');
  const [statusBusinessImpact, setStatusBusinessImpact] = useState('');
  const [statusProductionStop, setStatusProductionStop] = useState(false);
  const [blockingReasonCode, setBlockingReasonCode] = useState('');
  const [blockingReasons, setBlockingReasons] = useState([]);
  const [stockOverview, setStockOverview] = useState([]);
  const [statusMaterialUsed, setStatusMaterialUsed] = useState('');
  const [technicians, setTechnicians] = useState([]);
  const [printers, setPrinters] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [isInternalComment, setIsInternalComment] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [downloadingFileId, setDownloadingFileId] = useState(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => new Date());
  const [showSatisfactionForm, setShowSatisfactionForm] = useState(false);
  const [satisfactionDismissed, setSatisfactionDismissed] = useState(false);
  const [submittingSatisfaction, setSubmittingSatisfaction] = useState(false);
  const [satisfactionForm, setSatisfactionForm] = useState({
    overall_rating: 0,
    quality_rating: 0,
    delivery_rating: 0,
    communication_rating: 0,
    fulfillment_result: 'fully_met',
    recommendation_score: 'yes',
    comment: '',
  });

  const fetchRequest = useCallback(async () => {
    try {
      const res = await api.get(`/requests/${id}`);
      setRequest(res.data);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchRequest();
    if (isProductionTechnician(user?.role) || ['administrator','manager'].includes(user?.role)) {
      api.get('/users').then(r => setTechnicians(r.data.filter(u => isProductionTechnician(u.role))));
      api.get('/printers').then(r => setPrinters(r.data));
      api.get('/materials').then(r => setMaterials(r.data));
      api.get('/blocking-reasons').then(r => setBlockingReasons(r.data)).catch(() => {});
      api.get('/materials/stock-overview').then(r => setStockOverview(r.data)).catch(() => {});
    }
  }, [fetchRequest, user]);

  useEffect(() => {
    if (selectedStatus !== 'printed') return undefined;
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, [selectedStatus]);

  useEffect(() => {
    if (selectedStatus !== 'planned' || !request) return;
    if (!statusQuantity && request.quantity) setStatusQuantity(String(request.quantity));
    if (!statusPrinterId && request.printer_id) setStatusPrinterId(request.printer_id);
    if (!statusMaterialId && request.material_id) setStatusMaterialId(request.material_id);
    if (!statusMaterialUsagePerPart && request.production_material_usage_per_part) {
      setStatusMaterialUsagePerPart(String(request.production_material_usage_per_part));
    }
    if (!statusPrintTimePerPart && request.production_print_time_per_part_minutes) {
      setStatusPrintTimePerPart(String(request.production_print_time_per_part_minutes));
    }
  }, [selectedStatus, request, statusQuantity, statusPrinterId, statusMaterialId, statusMaterialUsagePerPart, statusPrintTimePerPart]);

  useEffect(() => {
    if (selectedStatus !== 'planned' || statusPlannedEndManual) return;
    const quantity = parseFloat(statusQuantity || request?.quantity || 0);
    const printTimePerPart = parseFloat(statusPrintTimePerPart);
    const totalMinutes = quantity * printTimePerPart;
    const nextEnd = calculatePlannedEndDateTime(statusPlannedStart, totalMinutes);
    if (nextEnd && nextEnd !== statusPlannedEnd) {
      setStatusPlannedEnd(nextEnd);
    }
  }, [
    selectedStatus,
    statusPlannedStart,
    statusPrintTimePerPart,
    statusQuantity,
    statusPlannedEnd,
    statusPlannedEndManual,
    request,
  ]);

  // Statuses that require feasibility to be done (frontend pre-check)
  const REQUIRES_FEASIBILITY_FE = ['approved', 'prioritized', 'planned', 'assigned'];
  const REQUIRES_QC_FE = ['ready_for_pickup', 'requester_confirmation', 'completed'];

  const handleStatusUpdate = async () => {
    if (!selectedStatus) return;
    setUpdating(true); setError('');
    try {
      // Block printed if material used > reserved * 1.1
      if (selectedStatus === 'printed' && statusMaterialUsed && request?.material_reserved_qty > 0) {
        const used     = parseFloat(statusMaterialUsed);
        const reserved = parseFloat(request.material_reserved_qty);
        if (used > reserved * 1.1) {
          setError(`Cannot proceed: material used (${used}g) exceeds reserved quantity (${reserved}g) by more than 10%. Adjust the reserved material first.`);
          console.warn('Inventory risk warning shown; planning may continue.');
        }
      }
      if (selectedStatus === 'planned' && !statusMaterialId) {
        setError('Please select the material used in the slicing software.');
        setUpdating(false);
        return;
      }
      if (selectedStatus === 'planned' && !statusPrinterId) {
        setError('Please select the target printer used in the slicing software.');
        setUpdating(false);
        return;
      }
      if (selectedStatus === 'planned' && (!statusMaterialUsagePerPart || parseFloat(statusMaterialUsagePerPart) <= 0)) {
        setError('Please enter Material Usage Per Part from the slicing software.');
        setUpdating(false);
        return;
      }
      if (selectedStatus === 'planned' && (!statusPrintTimePerPart || parseFloat(statusPrintTimePerPart) <= 0)) {
        setError('Please enter Print Time Per Part from the slicing software.');
        setUpdating(false);
        return;
      }
      if (selectedStatus === 'planned' && !statusPlannedStart) {
        setError('Please select Planned Start DateTime.');
        setUpdating(false);
        return;
      }
      if (selectedStatus === 'planned' && statusPlannedEnd) {
        const plannedDuration = calculatePlannedDurationHours(statusPlannedStart, statusPlannedEnd);
        if (plannedDuration === null || plannedDuration <= 0) {
          setError('Planned End DateTime must be greater than Planned Start DateTime.');
          setUpdating(false);
          return;
        }
      }
      if (selectedStatus === 'planned' && statusMaterialId && planningTotalMaterialUsage) {
        const s = stockOverview.find(x => x.id === statusMaterialId);
        const avail = parseFloat(s?.available_quantity ?? 99999);
        if (planningTotalMaterialUsage > avail) {
          console.warn(`Inventory risk. Requested: ${planningTotalMaterialUsage}. Available: ${avail.toFixed(1)}`);
        }
      }

      // Archive is handled by a dedicated endpoint
      if (selectedStatus === 'archived') {
        await api.post(`/archive/${id}`, {
          lessons_learned: statusComment || undefined,
        });
      } else {
        const payload = { status: selectedStatus, comment: statusComment };
        if (statusReason) {
          if (['rejected','more_info_required'].includes(selectedStatus)) payload.rejection_reason = statusReason;
          if (selectedStatus === 'blocked') payload.blocking_reason = blockingReasonCode ? `[${blockingReasonCode}] ${statusReason}` : statusReason;
          if (selectedStatus === 'on_hold') payload.on_hold_reason = statusReason;
          if (selectedStatus === 'cancelled') payload.cancellation_reason = statusReason;
        }
        if (statusApprovedDate)  payload.approved_due_date      = statusApprovedDate;
        if (statusTechId)        payload.assigned_technician_id = statusTechId;
        if (statusQuantity)      payload.quantity               = parseInt(statusQuantity, 10);
        // V3 new fields
        if (statusPrinterId)     payload.printer_id             = statusPrinterId;
        if (statusMaterialId)    payload.material_id            = statusMaterialId;
        if (statusPlannedStart)  payload.planned_start_date     = statusPlannedStart;
        if (statusPlannedEnd)    payload.planned_end_date       = statusPlannedEnd;
        if (selectedStatus === 'planned') payload.planned_end_manually_adjusted = statusPlannedEndManual;
        if (statusMaterialSpool) payload.material_reserved_spool = statusMaterialSpool;
        if (statusMaterialUsagePerPart) payload.production_material_usage_per_part = parseFloat(statusMaterialUsagePerPart);
        if (statusPrintTimePerPart) payload.production_print_time_per_part_minutes = parseFloat(statusPrintTimePerPart);
        if (statusPrintedQty)    payload.printed_quantity        = parseInt(statusPrintedQty);
        if (statusRejectedQty)   payload.rejected_quantity       = parseInt(statusRejectedQty);
        if (statusMaterialUsed)  payload.material_used_grams     = parseFloat(statusMaterialUsed);
        if (statusReceptionComment) payload.reception_comment    = statusReceptionComment;
        if (statusReceptionCondition) payload.reception_condition = statusReceptionCondition;
        if (statusBusinessImpact) payload.business_impact        = statusBusinessImpact;
        // Ensure production_stop_risk is a real boolean
        payload.production_stop_risk = statusProductionStop === true || statusProductionStop === 'true';
        await api.patch(`/requests/${id}/status`, payload);
      }

      setShowStatusModal(false);
      setSelectedStatus(''); setStatusComment(''); setStatusReason('');
      setStatusApprovedDate(''); setStatusTechId('');
      setStatusQuantity('');
      setStatusPrinterId(''); setStatusMaterialId('');
      setStatusPlannedStart(''); setStatusPlannedEnd('');
      setStatusPlannedEndManual(false);
      setStatusMaterialUsagePerPart(''); setStatusPrintTimePerPart('');
      setStatusMaterialSpool('');
      setStatusPrintedQty(''); setStatusRejectedQty('');
      setStatusReceptionComment(''); setStatusReceptionCondition('ok');
      setStatusBusinessImpact(''); setStatusProductionStop(false);
      setBlockingReasonCode(''); setStatusMaterialUsed('');
      await fetchRequest();
    } catch (err) {
      setError(err.response?.data?.error || 'Update failed');
    } finally {
      setUpdating(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    try {
      await api.post(`/requests/${id}/comments`, { content: newComment, is_internal: isInternalComment });
      setNewComment('');
      await fetchRequest();
    } catch (err) { console.error(err); }
  };

  const handleSubmitSatisfaction = async () => {
    const requiredRatings = [
      satisfactionForm.overall_rating,
      satisfactionForm.quality_rating,
      satisfactionForm.delivery_rating,
      satisfactionForm.communication_rating,
    ];
    if (requiredRatings.some(value => !value)) {
      setError('Please select a rating from 1 to 5 stars for each question.');
      return;
    }
    setSubmittingSatisfaction(true);
    setError('');
    try {
      await api.post(`/requests/${id}/satisfaction`, satisfactionForm);
      setShowSatisfactionForm(false);
      setSatisfactionDismissed(false);
      await fetchRequest();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to submit satisfaction survey');
    } finally {
      setSubmittingSatisfaction(false);
    }
  };

  if (loading) return (
    <div className="page"><Sidebar/>
      <div className="main-content" style={{ display:'flex', alignItems:'center', justifyContent:'center' }}>
        <span className="spinner" style={{ width: 32, height: 32 }}/>
      </div>
    </div>
  );

  if (!request) return (
    <div className="page"><Sidebar/>
      <div className="main-content" style={{ padding: '2rem' }}>
        <div className="alert alert-error">Request not found</div>
      </div>
    </div>
  );

  const rawAvailableTransitions = getAvailableTransitions(request.status, user?.role);
  const availableTransitions = request.status === 'quality_check' && request.quality_result === 'fail'
    ? rawAvailableTransitions.filter(status => status === 'rework_required')
    : rawAvailableTransitions;
  const needsReason = ['rejected','more_info_required','blocked','on_hold','cancelled','rework_required'];
  const plannedDurationPreview = calculatePlannedDurationHours(statusPlannedStart, statusPlannedEnd);
  const plannedDurationInvalid = statusPlannedEnd
    ? calculatePlannedDurationHours(statusPlannedStart, statusPlannedEnd) !== null && calculatePlannedDurationHours(statusPlannedStart, statusPlannedEnd) <= 0
    : false;
  const selectedMaterialRate = materials.find(m => m.id === statusMaterialId)?.cost_per_unit;
  const planningMaterial = materials.find(m => m.id === statusMaterialId);
  const planningPrinter = printers.find(p => p.id === statusPrinterId);
  const planningStock = stockOverview.find(x => x.id === statusMaterialId);
  const planningQuantity = parseFloat(statusQuantity || request.quantity || 1);
  const requestQuantity = parseFloat(request.quantity || 1) || 1;
  const planningQuantityFactor = Number.isFinite(planningQuantity) && planningQuantity > 0 ? planningQuantity / requestQuantity : 1;
  const planningMaterialUsagePerPart = parseFloat(statusMaterialUsagePerPart);
  const planningPrintTimePerPart = parseFloat(statusPrintTimePerPart);
  const planningTotalMaterialUsage = Number.isFinite(planningMaterialUsagePerPart) && Number.isFinite(planningQuantity)
    ? planningMaterialUsagePerPart * planningQuantity
    : null;
  const planningTotalPrintTimeMinutes = Number.isFinite(planningPrintTimePerPart) && Number.isFinite(planningQuantity)
    ? planningPrintTimePerPart * planningQuantity
    : null;
  const planningRequiredMaterial = planningTotalMaterialUsage ?? (parseFloat(request.material_reserved_qty || 0) * planningQuantityFactor);
  const planningAvailable = parseFloat(planningStock?.available_quantity ?? planningMaterial?.available_quantity ?? planningMaterial?.stock_quantity ?? 0);
  const planningReservedElsewhere = parseFloat(planningStock?.reserved_quantity ?? planningMaterial?.reserved_quantity ?? 0);
  const planningRemaining = Number.isFinite(planningAvailable) && Number.isFinite(planningRequiredMaterial)
    ? planningAvailable - planningRequiredMaterial
    : null;
  const planningInventoryRisk = planningRemaining !== null && planningRemaining < 0;
  const totalSuccessfulQuantity = Math.max(numberOrZero(request.productionSummary?.total_successful_quantity), 0);
  const missingProductionQuantity = Math.max(numberOrZero(request.productionSummary?.missing_production_quantity), 0);
  const isReworkPrintCycle = Boolean(request.rework_required) && missingProductionQuantity > 0;
  const requestedQtyForPrint = isReworkPrintCycle ? missingProductionQuantity : numberOrZero(request.quantity);
  const printedQtyForPrint = numberOrZero(statusPrintedQty);
  const rejectedQtyForPrint = numberOrZero(statusRejectedQty);
  const reportedQtyForPrint = printedQtyForPrint + rejectedQtyForPrint;
  const printQtyDelta = reportedQtyForPrint - requestedQtyForPrint;
  const productionYield = reportedQtyForPrint > 0
    ? (printedQtyForPrint / reportedQtyForPrint) * 100
    : null;
  const actualPrintTimePreview = calculateActualPrintTimeMinutes(request.actual_start_time, now);
  const cycleProductionCost = calculateConfiguredCost(
    parseFloat(request.production_material_usage_per_part) * requestedQtyForPrint,
    request.material_cost_per_unit,
    parseFloat(request.production_print_time_per_part_minutes) * requestedQtyForPrint,
    request.printer_cost_per_minute
  );
  const plannedPrintTimeDisplay = formatMinutesAsDuration(request.production_total_print_time_minutes);
  const plannedDurationDisplay = formatMinutesAsDuration(calculateDurationMinutes(request.planned_start_date, request.planned_end_date));
  const productionStartTime = request.actual_start_time || request.planned_start_date;
  const productionEndTime = calculateEndDateFromPrintTime(productionStartTime, request.production_total_print_time_minutes);
  const requestMaterialCost = (() => {
    const usage = parseFloat(request.production_total_material_usage);
    const rate = parseFloat(request.material_cost_per_unit);
    if (![usage, rate].every(Number.isFinite)) return null;
    return usage * rate;
  })();
  const reservedMaterial = numberOrZero(request.material_reserved_qty);
  const usedMaterial = numberOrZero(request.productionSummary?.total_material_used ?? request.material_used_grams);
  const inventoryImpact = usedMaterial > 0 ? -usedMaterial : reservedMaterial > 0 ? -reservedMaterial : 0;
  const productionCycles = request.productionCycles || [];
  const totalCycleProductionCost = productionCycles.reduce((sum, cycle) => sum + numberOrZero(cycle.actual_cost), 0);
  const displayedTotalProductionCost = totalCycleProductionCost > 0
    ? totalCycleProductionCost
    : numberOrZero(request.productionSummary?.total_actual_cost ?? request.actual_cost);
  const canSubmitSatisfaction = user?.role === 'requester'
    && request.requester_id === user?.id
    && ['completed', 'archived'].includes(request.status)
    && !request.satisfaction;
  const shouldPromptSatisfaction = canSubmitSatisfaction && !satisfactionDismissed;
  const canViewAuditTrail = isProductionTechnician(user?.role) || ['manager','administrator'].includes(user?.role);
  const detailTabs = [
    { key: 'details', label: 'Overview' },
    { key: 'history', label: 'Workflow History' },
    { key: 'files', label: 'Attachments' },
    { key: 'execution', label: 'Production' },
    { key: 'cost', label: 'Cost' },
    { key: 'quality', label: 'Quality' },
    { key: 'feasibility', label: 'Feasibility' },
    { key: 'comments', label: 'Comments' },
    ...(canViewAuditTrail ? [{ key: 'audit', label: 'Audit Trail' }] : []),
  ];

  return (
    <div className="page">
      <Sidebar />
      <div className="main-content">
        {/* Header */}
        <div className="page-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--accent)', fontWeight: 600 }}>
                {request.request_number}
              </span>
              <StatusBadge status={request.status}/>
              {request.status === 'completed' && (request.requester_confirmation || request.reception_confirmed_at) && (
                <ReceptionConfirmedBadge />
              )}
              <PriorityBadge priority={request.priority}/>
              {request.is_overdue && (
                <span className="badge" style={{ background: 'var(--red-dim)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.3)' }}>⚠ OVERDUE</span>
              )}
            </div>
            <h1 style={{ fontSize: '1.3rem', fontFamily: 'var(--font-heading)', marginTop: '0.35rem' }}>{request.title}</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
              {request.requester_name} · {request.requester_department} · {request.site_name || 'No site'} · Created {formatDate(request.created_at)}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {(isProductionTechnician(user?.role) || ['administrator','requester'].includes(user?.role)) && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => downloadRequestPdf(id, request.request_number, setDownloadingPdf)}
                disabled={downloadingPdf}
              >
                {downloadingPdf ? <span className="spinner" style={{ width: 12, height: 12 }}/> : null}
                {downloadingPdf ? 'Generating...' : 'Generate PDF Report'}
              </button>
            )}
            {['draft','more_info_required'].includes(request.status) && request.requester_id === user?.id && (
              <button
                className="btn btn-sm"
                style={{
                  background: request.status === 'more_info_required' ? 'var(--yellow-dim)' : 'var(--bg-hover)',
                  color: request.status === 'more_info_required' ? 'var(--yellow)' : 'var(--text-primary)',
                  border: `1px solid ${request.status === 'more_info_required' ? 'rgba(245,158,11,0.4)' : 'var(--border-light)'}`,
                }}
                onClick={() => navigate(`/requests/${id}/edit`)}
              >
                {request.status === 'more_info_required' ? '✏ Edit & Resubmit' : 'Edit'}
              </button>
            )}
            {availableTransitions.length > 0 && (
              <button className="btn btn-primary btn-sm" onClick={() => setShowStatusModal(true)}>
                Update Status
              </button>
            )}
          </div>
        </div>

        <div className="page-body">
          {/* Info Required banner */}
          {request.status === 'more_info_required' && request.requester_id === user?.id && (
            <div className="alert alert-warning" style={{ marginBottom: '1.25rem' }}>
              <strong>⚠ Information Required</strong> — Production needs additional information or corrections.
              Click <strong>Edit &amp; Resubmit</strong> to update your request.
              {request.rejection_reason && (
                <div style={{ marginTop: '0.4rem', fontSize: '0.82rem' }}>
                  <strong>Production note:</strong> {request.rejection_reason}
                </div>
              )}
            </div>
          )}

          {/* Quantity comparison banner — shown when request is completed or awaiting confirmation */}
          {['requester_confirmation','completed','archived'].includes(request.status) &&
           request.printed_quantity > 0 && (
            <div style={{
              marginBottom: '1.25rem', padding: '1rem 1.25rem',
              background: request.printed_quantity >= request.quantity ? 'var(--green-dim)' : 'var(--yellow-dim)',
              border: `1px solid ${request.printed_quantity >= request.quantity ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'}`,
              borderRadius: 10,
            }}>
              <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>Requested</div>
                  <div style={{ fontSize: '1.4rem', fontFamily: 'var(--font-heading)', fontWeight: 800 }}>{request.quantity}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>piece{request.quantity !== 1 ? 's' : ''}</div>
                </div>
                <div style={{ fontSize: '1.5rem', color: 'var(--text-muted)' }}>?</div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>Printed</div>
                  <div style={{ fontSize: '1.4rem', fontFamily: 'var(--font-heading)', fontWeight: 800,
                    color: request.printed_quantity >= request.quantity ? 'var(--green)' : 'var(--yellow)' }}>
                    {request.printed_quantity}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>piece{request.printed_quantity !== 1 ? 's' : ''}</div>
                </div>
                {request.rejected_quantity > 0 && (
                  <>
                    <div style={{ fontSize: '1.5rem', color: 'var(--text-muted)' }}>·</div>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>Rejected</div>
                      <div style={{ fontSize: '1.4rem', fontFamily: 'var(--font-heading)', fontWeight: 800, color: 'var(--red)' }}>{request.rejected_quantity}</div>
                    </div>
                  </>
                )}
                <div style={{ marginLeft: 'auto' }}>
                  {request.printed_quantity >= request.quantity ? (
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--green)' }}>? Quantity fulfilled</span>
                  ) : (
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--yellow)' }}>
                      ⚠ {request.quantity - request.printed_quantity} piece(s) short
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {shouldPromptSatisfaction && (
            <div className="card" style={{ marginBottom: '1.25rem', borderLeft: '4px solid var(--accent)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <h3 style={{ fontSize: '0.95rem', marginBottom: '0.25rem' }}>Thank you for confirming reception.</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                    Please take a few seconds to evaluate the service.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-primary btn-sm" onClick={() => setShowSatisfactionForm(true)}>Rate Now</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setSatisfactionDismissed(true)}>Skip</button>
                </div>
              </div>
            </div>
          )}

          {showSatisfactionForm && (
            <div className="card" style={{ marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>How satisfied are you with this 3D printing request?</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '1rem' }}>Your feedback is optional and can be submitted once.</p>
              <div className="grid-2" style={{ gap: '1rem' }}>
                {[
                  ['overall_rating', 'Overall Satisfaction'],
                  ['quality_rating', 'Part Quality'],
                  ['delivery_rating', 'Delivery Time'],
                  ['communication_rating', 'Communication'],
                ].map(([key, label]) => (
                  <div key={key} style={{ padding: '0.75rem', background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 8 }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem' }}>{label}</div>
                    <StarRating
                      value={satisfactionForm[key]}
                      onChange={(value) => setSatisfactionForm(prev => ({ ...prev, [key]: value }))}
                    />
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      {satisfactionForm[key] ? ratingLabel(satisfactionForm[key]) : 'No rating selected'}
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid-2" style={{ gap: '1rem', marginTop: '1rem' }}>
                <label>
                  <span style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.35rem' }}>Did the printed part meet your needs?</span>
                  <select
                    value={satisfactionForm.fulfillment_result}
                    onChange={e => setSatisfactionForm(prev => ({ ...prev, fulfillment_result: e.target.value }))}
                  >
                    <option value="fully_met">Fully Met Expectations</option>
                    <option value="partially_met">Partially Met Expectations</option>
                    <option value="not_met">Did Not Meet Expectations</option>
                  </select>
                </label>
                <label>
                  <span style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.35rem' }}>Would you use this service again?</span>
                  <select
                    value={satisfactionForm.recommendation_score}
                    onChange={e => setSatisfactionForm(prev => ({ ...prev, recommendation_score: e.target.value }))}
                  >
                    <option value="yes">Yes</option>
                    <option value="maybe">Maybe</option>
                    <option value="no">No</option>
                  </select>
                </label>
              </div>
              <label style={{ display: 'block', marginTop: '1rem' }}>
                <span style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.35rem' }}>Additional comments or suggestions</span>
                <textarea
                  rows={4}
                  maxLength={1000}
                  value={satisfactionForm.comment}
                  onChange={e => setSatisfactionForm(prev => ({ ...prev, comment: e.target.value }))}
                  placeholder="Optional feedback..."
                />
                <div style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.72rem' }}>{satisfactionForm.comment.length}/1000</div>
              </label>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowSatisfactionForm(false)}>Cancel</button>
                <button className="btn btn-primary btn-sm" disabled={submittingSatisfaction} onClick={handleSubmitSatisfaction}>
                  {submittingSatisfaction ? 'Submitting...' : 'Submit Feedback'}
                </button>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="tabs">
            {detailTabs.map(t => (
              <button key={t.key} className={`tab ${activeTab === t.key ? 'active' : ''}`} onClick={() => setActiveTab(t.key)}>
                {t.label}
                {t.key === 'files' && request.attachments?.length > 0 && (
                  <span style={{ marginLeft: '0.4rem', background: 'var(--border-light)', borderRadius: '8px', padding: '0 0.4rem', fontSize: '0.7rem' }}>
                    {request.attachments.length}
                  </span>
                )}
                {t.key === 'comments' && request.comments?.length > 0 && (
                  <span style={{ marginLeft: '0.4rem', background: 'var(--border-light)', borderRadius: '8px', padding: '0 0.4rem', fontSize: '0.7rem' }}>
                    {request.comments.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Details tab */}
          {activeTab === 'details' && (
            <div className="grid-2" style={{ gap: '1.5rem' }}>
              <div>
                <div className="card" style={{ marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '0.8rem', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>Request Info</h3>
                  <DetailRow label="Purpose" value={request.purpose}/>
                  <DetailRow label="Part Description" value={request.part_description}/>
                  <DetailRow label="Quantity" value={request.quantity}/>
                  <DetailRow label="Site" value={request.site_name}/>
                  <DetailRow label="Category" value={request.category_name}/>
                  <DetailRow label="Criticality" value={request.criticality}/>
                  <DetailRow label="Use Environment" value={request.use_environment}/>
                  <DetailRow label="Functional Req." value={request.functional_requirement}/>
                  <DetailRow label="Visual Req." value={request.visual_requirement}/>
                  <DetailRow label="Project Ref." value={request.project_reference}/>
                  <DetailRow label="Customer Ref." value={request.customer_reference}/>
                </div>
                <div className="card">
                  <h3 style={{ fontSize: '0.8rem', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>Planning</h3>
                  <DetailRow label="Requested Due Date" value={orStar(formatDateTime(request.requested_due_date))}/>
                  <DetailRow label="Approved Due Date" value={orStar(formatDate(request.approved_due_date))}/>
                  <DetailRow label="Planned Start" value={orStar(formatDateTime(request.planned_start_date))}/>
                  <DetailRow label="Planned End" value={orStar(formatDateTime(request.planned_end_date))}/>
                  <DetailRow label="Planned Duration" value={orStar(plannedDurationDisplay)}/>
                  <DetailRow label="Material Usage Per Part" value={request.production_material_usage_per_part ? `${parseFloat(request.production_material_usage_per_part).toFixed(2)} ${request.material_unit || 'g'}` : null}/>
                  <DetailRow label="Print Time Per Part" value={request.production_print_time_per_part_minutes ? `${parseFloat(request.production_print_time_per_part_minutes).toFixed(2)} min` : null}/>
                  <DetailRow label="Total Material Usage" value={request.production_total_material_usage ? `${parseFloat(request.production_total_material_usage).toFixed(1)} ${request.material_unit || 'g'}` : null}/>
                  <DetailRow label="Total Print Time" value={request.production_total_print_time_minutes ? `${(parseFloat(request.production_total_print_time_minutes) / 60).toFixed(2)} h` : null}/>
                  <DetailRow label="Material Rate" value={request.material_cost_per_unit ? `${parseFloat(request.material_cost_per_unit).toFixed(4)} EUR/${request.material_unit || 'g'}` : null}/>
                  <DetailRow label="Printer Rate" value={request.printer_cost_per_minute ? `${parseFloat(request.printer_cost_per_minute).toFixed(4)} EUR/min` : null}/>
                  <DetailRow label="Priority Reason" value={request.priority_reason}/>
                  {request.rejection_reason && <DetailRow label="Rejection Reason" value={request.rejection_reason}/>}
                  {request.blocking_reason && <DetailRow label="Blocking Reason" value={request.blocking_reason}/>}
                </div>
              </div>
              <div>
                <div className="card" style={{ marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '0.8rem', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>Technical Data</h3>
                  <DetailRow label="Dimensions" value={request.dimensions}/>
                  <DetailRow label="Scale" value={request.scale}/>
                  <DetailRow label="Tolerance" value={request.tolerance}/>
                  <DetailRow label="Surface Finish" value={request.surface_finish}/>
                  <DetailRow label="Strength Req." value={request.strength_requirement}/>
                  <DetailRow label="Color" value={request.color_preference}/>
                  <DetailRow label="Material Pref." value={request.material_preference}/>
                  <DetailRow label="Infill %" value={request.infill_percentage ? `${request.infill_percentage}%` : null}/>
                  <DetailRow label="Layer Height" value={request.layer_height ? `${request.layer_height}mm` : null}/>
                  <DetailRow label="Orientation" value={request.orientation}/>
                </div>
                <div className="card">
                  <h3 style={{ fontSize: '0.8rem', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>Assignment</h3>
                  <DetailRow label="Requester" value={request.requester_full_name}/>
                  <DetailRow label="Technician" value={request.technician_full_name}/>
                  <DetailRow label="Printer" value={request.printer_name}/>
                  <DetailRow label="Material" value={request.material_name}/>
                  <DetailRow label="Batch Ref." value={request.batch_reference}/>
                  <DetailRow label="Submitted Date" value={orStar(formatDateTime(request.submitted_at))}/>
                  <DetailRow label="Approved Date" value={orStar(formatDateTime(request.approved_at))}/>
                </div>
              </div>
              <div className="card" style={{ gridColumn: '1 / -1' }}>
                <h3 style={{ fontSize: '0.8rem', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>Requester Feedback</h3>
                {request.satisfaction ? (
                  <div className="grid-2" style={{ gap: '1rem' }}>
                    <DetailRow label="Overall Satisfaction" value={`${request.satisfaction.overall_rating} / 5 - ${ratingLabel(request.satisfaction.overall_rating)}`}/>
                    <DetailRow label="Quality Rating" value={`${request.satisfaction.quality_rating} / 5`}/>
                    <DetailRow label="Delivery Rating" value={`${request.satisfaction.delivery_rating} / 5`}/>
                    <DetailRow label="Communication Rating" value={`${request.satisfaction.communication_rating} / 5`}/>
                    <DetailRow label="Fulfillment" value={fulfillmentLabel(request.satisfaction.fulfillment_result)}/>
                    <DetailRow label="Recommendation" value={recommendationLabel(request.satisfaction.recommendation_score)}/>
                    <DetailRow label="Submission Date" value={formatDateTime(request.satisfaction.created_at)}/>
                    <DetailRow label="Comment" value={request.satisfaction.comment}/>
                  </div>
                ) : (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                    No requester feedback submitted yet.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Execution tab */}
          {activeTab === 'execution' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="card">
                <h3 style={{ fontSize: '0.8rem', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1rem' }}>Production Summary</h3>
                <div className="grid-2" style={{ gap: '0.75rem' }}>
                  {[
                    ['Total Printed Quantity', `${numberOrZero(request.productionSummary?.total_printed_quantity ?? request.printed_quantity).toFixed(0)} piece(s)`],
                    ['Total Material Used', `${numberOrZero(request.productionSummary?.total_material_used ?? request.material_used_grams).toFixed(1)} g`],
                    ['Total Production Cost', money(displayedTotalProductionCost) || '0.00 €'],
                    ['Number of Reworks', numberOrZero(request.productionSummary?.rework_count).toFixed(0)],
                  ].map(([label, value]) => (
                    <div key={label} style={{ padding: '0.75rem', background: 'var(--bg-hover)', borderRadius: 6 }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>{label}</div>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card">
                <h3 style={{ fontSize: '0.8rem', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1rem' }}>Production Cycle History</h3>
                {productionCycles.length > 0 ? (
                  <table>
                    <thead>
                      <tr>
                        <th>Cycle</th>
                        <th>Type</th>
                        <th>Requested Qty</th>
                        <th>Printed Qty</th>
                        <th>Rejected</th>
                        <th>Successful</th>
                        <th>Validated</th>
                        <th>Material Reserved</th>
                        <th>Material Used</th>
                        <th>Print Time</th>
                        <th>Material Cost</th>
                        <th>Machine Cost</th>
                        <th>Total Cost</th>
                        <th>Start</th>
                        <th>End</th>
                        <th>By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productionCycles.map(cycle => (
                        <tr key={cycle.id}>
                          <td style={{ fontWeight: 700 }}>{cycle.cycle_number}</td>
                          <td>{cycle.cycle_number === 1 ? 'Original' : 'Rework'}</td>
                          <td>{numberOrZero(cycle.requested_quantity).toFixed(0)}</td>
                          <td>{numberOrZero(cycle.printed_quantity).toFixed(0)}</td>
                          <td>{numberOrZero(cycle.rejected_quantity).toFixed(0)}</td>
                          <td>{Math.max(numberOrZero(cycle.printed_quantity) - numberOrZero(cycle.rejected_quantity), 0).toFixed(0)}</td>
                          <td>{numberOrZero(cycle.validated_quantity).toFixed(0)}</td>
                          <td>{numberOrZero(cycle.material_reserved).toFixed(1)} g</td>
                          <td>{numberOrZero(cycle.material_used).toFixed(1)} g</td>
                          <td>{formatMinutesAsDuration(cycle.print_time_minutes) || '*'}</td>
                          <td>{money(cycle.material_cost) || money(0)}</td>
                          <td>{money(cycle.machine_cost) || money(0)}</td>
                          <td>{money(cycle.actual_cost) || money(0)}</td>
                          <td>{formatDateTime(cycle.start_time) || '-'}</td>
                          <td>{formatDateTime(cycle.end_time) || '-'}</td>
                          <td>{cycle.created_by_full_name || cycle.created_by_name || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan="12" style={{ textAlign: 'right', fontWeight: 800 }}>Total Production Cost</td>
                        <td style={{ fontWeight: 800 }}>{money(displayedTotalProductionCost) || money(0)}</td>
                        <td colSpan="3"></td>
                      </tr>
                    </tfoot>
                  </table>
                ) : (
                  <div className="empty-state" style={{ padding: '1.5rem' }}>
                    <p>No production cycle recorded yet.</p>
                  </div>
                )}
              </div>

              <div className="card">
                <h3 style={{ fontSize: '0.8rem', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1rem' }}>Execution Data</h3>
                <DetailRow label="Start Time" value={orStar(formatDateTime(productionStartTime))}/>
                <DetailRow label="End Time" value={orStar(formatDateTime(productionEndTime))}/>
                <DetailRow label="Actual Print Time" value={orStar(plannedPrintTimeDisplay)}/>
                <DetailRow label="Production Cost" value={money(request.actual_cost)}/>
                <DetailRow label="Actual Duration" value={orStar(plannedDurationDisplay)}/>
                <DetailRow label="Post-Processing" value={request.post_processing_details}/>
                <DetailRow label="Quality Result" value={request.quality_result}/>
                <DetailRow label="Quality Notes" value={request.quality_notes}/>
                <DetailRow label="Scrap / Failed" value={request.scrap_count > 0 ? `${request.scrap_count} piece(s)` : null}/>
                <DetailRow label="Rework Required" value={request.rework_required ? 'Yes' : null}/>
                <DetailRow label="Rework Reason" value={request.rework_reason}/>
                <DetailRow label="Completion Date" value={formatDateTime(request.completion_date)}/>
                <DetailRow label="Delivery Confirmed" value={request.delivery_confirmation ? 'Yes' : null}/>
                <DetailRow label="Lessons Learned" value={request.lessons_learned}/>
              </div>
            </div>
          )}

          {/* Feasibility tab */}
          {activeTab === 'feasibility' && (
            <div className="card">
              <FeasibilityPanel
                requestId={id}
                requestStatus={request.status}
                readOnly
                initialReview={request.feasibilityReview}
              />
            </div>
          )}

          {/* Quality Check tab */}
          {activeTab === 'quality' && (
            <div className="card">
              <QualityCheckPanel requestId={id} requestStatus={request.status} request={request}/>
            </div>
          )}

          {/* Cost tab */}
          {activeTab === 'cost' && (
            <div className="grid-2" style={{ gap: '1rem' }}>
              <div className="card">
                <h3 style={{ fontSize: '0.8rem', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>Cost Inputs</h3>
                <DetailRow label="Material Cost Rate" value={request.material_cost_per_unit ? `${parseFloat(request.material_cost_per_unit).toFixed(4)} ${request.material_currency || 'EUR'}/${request.material_unit || 'g'}` : null}/>
                <DetailRow label="Printer Cost Rate" value={request.printer_cost_per_minute ? `${parseFloat(request.printer_cost_per_minute).toFixed(4)} ${request.material_currency || 'EUR'}/min` : null}/>
                <DetailRow label="Material Cost" value={money(requestMaterialCost)}/>
                <DetailRow label="Fixed Cost" value={money(FIXED_COST)}/>
                <DetailRow label="Material Usage Per Part" value={request.production_material_usage_per_part ? `${parseFloat(request.production_material_usage_per_part).toFixed(2)} ${request.material_unit || 'g'}` : null}/>
                <DetailRow label="Print Time Per Part" value={request.production_print_time_per_part_minutes ? `${parseFloat(request.production_print_time_per_part_minutes).toFixed(2)} min` : null}/>
                <DetailRow label="Total Material Usage" value={request.production_total_material_usage ? `${parseFloat(request.production_total_material_usage).toFixed(1)} ${request.material_unit || 'g'}` : null}/>
                <DetailRow label="Total Print Time" value={request.production_total_print_time_minutes ? `${(parseFloat(request.production_total_print_time_minutes) / 60).toFixed(2)} h` : null}/>
                <DetailRow label="Material" value={request.material_name}/>
                <DetailRow label="Spool Ref." value={request.material_reserved_spool}/>
              </div>
              <div className="card">
                <h3 style={{ fontSize: '0.8rem', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>Production Cost</h3>
                <DetailRow label="Production Cost" value={money(request.actual_cost)}/>
                <DetailRow label="Material Used" value={request.productionSummary?.total_material_used || request.material_used_grams ? `${numberOrZero(request.productionSummary?.total_material_used ?? request.material_used_grams).toFixed(1)} g` : null}/>
                <DetailRow label="Actual Duration" value={orStar(plannedDurationDisplay)}/>
                <DetailRow label="Printed Quantity" value={request.productionSummary?.total_printed_quantity || request.printed_quantity ? `${numberOrZero(request.productionSummary?.total_printed_quantity ?? request.printed_quantity).toFixed(0)} piece(s)` : null}/>
                <DetailRow label="Rework Count" value={request.productionSummary?.rework_count ? String(request.productionSummary.rework_count) : null}/>
                <DetailRow label="Scrap / Failed" value={request.scrap_count > 0 ? `${request.scrap_count} piece(s)` : null}/>
              </div>
              <div className="card" style={{ gridColumn: '1 / -1' }}>
                <h3 style={{ fontSize: '0.8rem', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>Inventory Impact</h3>
                <div className="grid-2" style={{ gap: '0.75rem' }}>
                  <DetailRow label="Material Used" value={usedMaterial ? `${usedMaterial.toFixed(1)} g` : null}/>
                  <DetailRow label="Reserved Material" value={reservedMaterial ? `${reservedMaterial.toFixed(1)} g` : null}/>
                  <DetailRow label="Inventory Impact" value={inventoryImpact ? `${inventoryImpact.toFixed(1)} g from ${request.material_name || 'selected material'}` : null}/>
                </div>
              </div>
            </div>
          )}

          {/* Files tab */}
          {activeTab === 'files' && (
            <div>
              <div className="card">
                {request.attachments?.length === 0 ? (
                  <div className="empty-state" style={{ padding: '2rem' }}>
                    <p>No files attached</p>
                  </div>
                ) : (
                  request.attachments?.map(f => (
                    <div key={f.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: '1.2rem' }}>
                          {['stl','step','stp','obj','3mf'].includes(f.file_type) ? '🧊' :
                           ['pdf'].includes(f.file_type) ? '📄' :
                           ['png','jpg','jpeg'].includes(f.file_type) ? '🖼' : '📎'}
                        </span>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{f.original_name}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {f.file_type?.toUpperCase()} · {f.file_size ? `${(f.file_size/1024/1024).toFixed(2)} MB` : ''} · {formatDate(f.uploaded_at)}
                          </div>
                        </div>
                      </div>
                      <button
                        className="btn btn-ghost btn-sm"
                        disabled={downloadingFileId === f.id}
                        onClick={() => downloadAttachment(id, f.id, f.original_name, setDownloadingFileId)}
                        style={{ minWidth: 100 }}
                      >
                        {downloadingFileId === f.id ? (
                          <><span className="spinner" style={{ width: 12, height: 12 }}/> Downloading…</>
                        ) : (
                          <>↓ Download</>
                        )}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Comments tab */}
          {activeTab === 'comments' && (
            <div>
              {request.comments?.map(c => (
                <div key={c.id} className="card" style={{ marginBottom: '0.75rem', borderLeft: c.is_internal ? '3px solid var(--yellow)' : '3px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{c.user_name}</span>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      {c.is_internal && <span className="badge" style={{ background: 'var(--yellow-dim)', color: 'var(--yellow)', border: '1px solid rgba(245,158,11,0.3)' }}>Internal</span>}
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatDateTime(c.created_at)}</span>
                    </div>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{c.content}</p>
                </div>
              ))}
              <div className="card" style={{ marginTop: '1rem' }}>
                <textarea
                  className="form-textarea" placeholder="Add a comment…"
                  value={newComment} onChange={e => setNewComment(e.target.value)}
                  style={{ marginBottom: '0.75rem' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {(isProductionTechnician(user?.role) || ['manager','administrator'].includes(user?.role)) && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={isInternalComment} onChange={e => setIsInternalComment(e.target.checked)}/>
                      Internal comment (not visible to requester)
                    </label>
                  )}
                  <button className="btn btn-primary btn-sm" onClick={handleAddComment} disabled={!newComment.trim()}>
                    Add Comment
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Audit Trail tab */}
          {activeTab === 'audit' && canViewAuditTrail && (
            <AuditTrailPanel requestId={id} user={user} formatDateTime={formatDateTime} />
          )}

          {/* History tab */}
          {activeTab === 'history' && (
            <div className="card">
              {request.statusHistory?.length === 0 ? (
                <div className="empty-state" style={{ padding: '2rem' }}><p>No history yet</p></div>
              ) : (
                <div style={{ position: 'relative' }}>
                  {request.statusHistory?.map((h, i) => (
                    <div key={h.id} style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', position: 'relative' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{
                          width: 10, height: 10, borderRadius: '50%',
                          background: STATUS_CONFIG[h.to_status]?.color || 'var(--accent)',
                          flexShrink: 0, marginTop: '0.3rem',
                        }}/>
                        {i < (request.statusHistory.length - 1) && (
                          <div style={{ width: 1, flex: 1, background: 'var(--border)', marginTop: '0.25rem' }}/>
                        )}
                      </div>
                      <div style={{ flex: 1, paddingBottom: '0.75rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                          {h.from_status && <StatusBadge status={h.from_status}/>}
                          {h.from_status && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>?</span>}
                          <StatusBadge status={h.to_status}/>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {h.changed_by_name} · {formatDateTime(h.created_at)}
                        </div>
                        {h.comment && (
                          <div style={{ marginTop: '0.35rem', fontSize: '0.82rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                            "{h.comment}"
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Status Update Modal */}
      {showStatusModal && (
        <div className="modal-overlay" onClick={() => setShowStatusModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1rem', fontFamily: 'var(--font-heading)' }}>Update Request Status</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowStatusModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {error && (
              <div className="alert alert-error">
                <strong>⚠ Cannot proceed</strong>
                <div style={{ marginTop: '0.35rem', fontSize: '0.82rem' }}>{error}</div>
              </div>
            )}
              {request.status === 'feasibility_review' && (
                <div className="card" style={{ background: 'var(--bg-secondary)' }}>
                  <h3 style={{ fontSize: '0.8rem', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>Feasibility Review Form</h3>
                  <FeasibilityPanel
                    requestId={id}
                    requestStatus={request.status}
                    editableOnMount
                    onSaved={() => {
                      setError('');
                      fetchRequest();
                    }}
                  />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">New Status *</label>
                <select className="form-select" value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)}>
                  <option value="">Select status</option>
                  {availableTransitions.map(s => (
                    <option key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</option>
                  ))}
                </select>
              </div>

              {selectedStatus === 'approved' && (
                <div className="form-group">
                  <label className="form-label">Approved Due Date</label>
                  <DatePicker
                    value={statusApprovedDate}
                    onChange={setStatusApprovedDate}
                    placeholder="Select approved due date"
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
              )}

              {selectedStatus === 'assigned' && (
                <div className="form-group">
                  <label className="form-label">Assign Technician</label>
                  <select className="form-select" value={statusTechId} onChange={e => setStatusTechId(e.target.value)}>
                    <option value="">Select technician</option>
                    {technicians.map(t => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
                  </select>
                </div>
              )}

              {/* PLANNED: printer + material reservation + dates */}
              {selectedStatus === 'planned' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      className="form-input"
                      value={statusQuantity}
                      onChange={e => setStatusQuantity(e.target.value)}
                      placeholder={request.quantity ? String(request.quantity) : '1'}
                    />
                  </div>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Assign Printer *</label>
                      <select className="form-select" value={statusPrinterId} onChange={e => setStatusPrinterId(e.target.value)}>
                        <option value="">Select printer</option>
                        {printers.map(p => (
                          <option key={p.id} value={p.id}
                            disabled={p.status === 'maintenance' || p.status === 'offline'}>
                            {p.name} ({p.technology}){p.status !== 'available' ? ` — ${p.status}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Reserve Material *</label>
                      <select className="form-select" value={statusMaterialId}
                        onChange={e => setStatusMaterialId(e.target.value)}>
                        <option value="">Select material</option>
                        {materials.map(m => {
                          const stock = stockOverview.find(s => s.id === m.id);
                          const avail = stock ? parseFloat(stock.available_quantity) : parseFloat(m.stock_quantity || 0);
                          const low   = stock?.is_low_stock;
                          return (
                            <option key={m.id} value={m.id} disabled={avail <= 0}>
                              {m.name} — Available: {avail.toFixed(0)}{m.unit}{low ? ' ⚠ LOW' : ''}{avail <= 0 ? ' (OUT OF STOCK)' : ''}
                            </option>
                          );
                        })}
                      </select>
                      {/* Show live stock for selected material */}
                      {statusMaterialId && (() => {
                        const s = stockOverview.find(x => x.id === statusMaterialId);
                        if (!s) return null;
                        const avail = parseFloat(s.available_quantity);
                        const reserved = parseFloat(s.reserved_quantity);
                        return (
                          <div style={{
                            marginTop: '0.4rem', padding: '0.5rem 0.75rem',
                            background: s.is_low_stock ? 'var(--yellow-dim)' : 'var(--bg-hover)',
                            borderRadius: 6, fontSize: '0.78rem',
                            color: s.is_low_stock ? 'var(--yellow)' : 'var(--text-secondary)',
                          }}>
                            📦 Available: <strong>{avail.toFixed(1)}{s.unit}</strong>
                            {reserved > 0 && <span style={{ marginLeft: '0.75rem' }}>🔒 Reserved elsewhere: {reserved.toFixed(1)}{s.unit}</span>}
                            {s.is_low_stock && <span style={{ marginLeft: '0.75rem' }}>⚠ Low stock</span>}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Qty + Spool — required when material is selected */}
                  {statusMaterialId && (
                    <div className="grid-2">
                      <div className="form-group">
                        <label className="form-label">Material Usage Per Part ({
                          materials.find(m => m.id === statusMaterialId)?.unit || 'g'
                        }) *</label>
                        <input
                          type="number" min="0.01" step="0.01"
                          className="form-input"
                          value={statusMaterialUsagePerPart}
                          onChange={e => setStatusMaterialUsagePerPart(e.target.value)}
                          placeholder="From slicer, e.g. 20.5"
                        />
                        {/* Warn if qty > available */}
                        {planningTotalMaterialUsage !== null && statusMaterialId && (() => {
                          const s = stockOverview.find(x => x.id === statusMaterialId);
                          const avail = parseFloat(s?.available_quantity ?? 99999);
                          const req = planningTotalMaterialUsage;
                          if (req > avail) return (
                            <div style={{ color: 'var(--red)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                              ✕ Insufficient stock — only {avail.toFixed(1)} available
                            </div>
                          );
                          return (
                            <div style={{ color: 'var(--green)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                              ? Remaining after reservation: {(avail - req).toFixed(1)}
                            </div>
                          );
                        })()}
                      </div>
                      <div className="form-group">
                        <label className="form-label">Print Time Per Part (minutes) *</label>
                        <input
                          type="number" min="0.01" step="0.01"
                          className="form-input"
                          value={statusPrintTimePerPart}
                          onChange={e => setStatusPrintTimePerPart(e.target.value)}
                          placeholder="From slicer, e.g. 85"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Spool Reference</label>
                        <input className="form-input" value={statusMaterialSpool}
                          onChange={e => setStatusMaterialSpool(e.target.value)}
                          placeholder="e.g. PLA-BK-042"/>
                      </div>
                    </div>
                  )}


                  <div className="card" style={{ margin: '0.75rem 0', background: 'var(--bg-secondary)' }}>
                    <h3 style={{ fontSize: '0.78rem', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>Production Summary</h3>
                    <div className="grid-2" style={{ gap: '0.65rem' }}>
                      <DetailRow label="Quantity" value={request.quantity}/>
                      <DetailRow label="Material" value={planningMaterial?.name || request.material_name}/>
                      <DetailRow label="Printer" value={planningPrinter?.name || request.printer_name}/>
                      <DetailRow label="Material Usage Per Part" value={Number.isFinite(planningMaterialUsagePerPart) ? `${planningMaterialUsagePerPart.toFixed(2)} ${planningMaterial?.unit || 'g'}` : null}/>
                      <DetailRow label="Print Time Per Part" value={Number.isFinite(planningPrintTimePerPart) ? `${planningPrintTimePerPart.toFixed(2)} min` : null}/>
                      <DetailRow label="Total Material Usage" value={planningTotalMaterialUsage !== null ? `${planningTotalMaterialUsage.toFixed(1)} ${planningMaterial?.unit || 'g'}` : null}/>
                      <DetailRow label="Total Print Time" value={planningTotalPrintTimeMinutes !== null ? `${(planningTotalPrintTimeMinutes / 60).toFixed(2)} h` : null}/>
                      <DetailRow label="Inventory Risk Status" value={planningInventoryRisk ? 'High - Insufficient Stock' : 'OK'}/>
                    </div>
                    <div className="card" style={{ background: 'var(--bg-secondary)' }}>
                      <h3 style={{ fontSize: '0.78rem', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>Printer Validation</h3>
                      <DetailRow label="Printer Requested" value={planningPrinter?.name || request.printer_name}/>
                      <DetailRow label="Printer Profile" value={planningPrinter?.model || planningPrinter?.technology || request.printer_technology}/>
                    </div>
                  </div>

                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Planned Start</label>
                      <DateTimePicker
                        value={statusPlannedStart}
                        onChange={value => {
                          setStatusPlannedStart(value);
                          if (!statusPlannedEndManual) setStatusPlannedEnd('');
                        }}
                        placeholder="Select start date & time"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Planned End</label>
                      <DateTimePicker
                        value={statusPlannedEnd}
                        onChange={value => {
                          setStatusPlannedEnd(value);
                          setStatusPlannedEndManual(true);
                        }}
                        placeholder="Select end date & time"
                      />
                      {statusPlannedEndManual && (
                        <div style={{ color: 'var(--yellow)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                          Planned End will be saved as a manual adjustment.
                        </div>
                      )}
                    </div>
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="form-label">Planned Duration</label>
                      <input
                        className="form-input"
                        value={
                          plannedDurationPreview !== null && plannedDurationPreview > 0
                            ? `${plannedDurationPreview.toFixed(plannedDurationPreview % 1 === 0 ? 0 : 1)} h`
                            : ''
                        }
                        readOnly
                        placeholder="Calculated from Planned Start and Total Print Time"
                        style={{
                          fontWeight: 700,
                          color: plannedDurationInvalid ? 'var(--red)' : 'var(--green)',
                          borderColor: plannedDurationInvalid ? 'var(--red)' : undefined,
                        }}
                      />
                      {plannedDurationInvalid && (
                        <div style={{ color: 'var(--red)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                          Planned End DateTime must be greater than Planned Start DateTime.
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* APPROVED: priority metadata */}
              {selectedStatus === 'approved' && (
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Business Impact</label>
                    <select className="form-select" value={statusBusinessImpact} onChange={e => setStatusBusinessImpact(e.target.value)}>
                      <option value="">Select…</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Production Stop Risk</label>
                    <select className="form-select" value={statusProductionStop} onChange={e => setStatusProductionStop(e.target.value === 'true')}>
                      <option value="false">No</option>
                      <option value="true">Yes — urgent</option>
                    </select>
                  </div>
                </div>
              )}

              {/* BLOCKED: predefined blocking reason */}
              {selectedStatus === 'blocked' && blockingReasons.length > 0 && (
                <div className="form-group">
                  <label className="form-label">Blocking Reason Category</label>
                  <select className="form-select" value={blockingReasonCode} onChange={e => setBlockingReasonCode(e.target.value)}>
                    <option value="">Select a reason…</option>
                    {blockingReasons.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
                  </select>
                </div>
              )}

              {/* PRINTED: quantity tracking + machine utilization */}
              {selectedStatus === 'printed' && (
                <>
                  <div style={{
                    padding: '0.6rem 0.85rem',
                    borderRadius: 6,
                    marginBottom: '0.75rem',
                    background: 'var(--blue-dim)',
                    border: '1px solid rgba(59,130,246,0.3)',
                    fontSize: '0.82rem',
                    color: 'var(--blue)',
                  }}>
                    📦 Requested by requester: <strong>{requestedQtyForPrint.toFixed(0)} pcs</strong>
                    <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', opacity: 0.85 }}>
                      {isReworkPrintCycle
                        ? `Requested Quantity For This Rework Cycle: ${missingProductionQuantity.toFixed(0)} pcs`
                        : 'Enter the actual quantity successfully printed. Printed Quantity + Rejected / Failed should normally equal the requested quantity.'}
                    </div>
                  </div>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Printed Quantity</label>
                      <input type="number" min="0" className="form-input" value={statusPrintedQty} onChange={e => setStatusPrintedQty(e.target.value)} placeholder="e.g. 2"/>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Rejected / Failed</label>
                      <input type="number" min="0" className="form-input" value={statusRejectedQty} onChange={e => setStatusRejectedQty(e.target.value)} placeholder="e.g. 0"/>
                    </div>
                  </div>
                  {(statusPrintedQty || statusRejectedQty) && requestedQtyForPrint > 0 && printQtyDelta !== 0 && (
                    <div className="alert alert-warning" style={{ fontSize: '0.8rem' }}>
                      Production quantity does not match requested quantity.{' '}
                      {printQtyDelta < 0
                        ? `Missing: ${Math.abs(printQtyDelta).toFixed(0)} pcs`
                        : `Over-produced: ${printQtyDelta.toFixed(0)} pcs`}
                    </div>
                  )}
                  {(statusPrintedQty || statusRejectedQty) && (
                    <div className="grid-4" style={{ marginBottom: '0.75rem' }}>
                      {[
                        ['Requested', `${requestedQtyForPrint.toFixed(0)} pcs`, 'var(--blue)'],
                        ['Printed', `${printedQtyForPrint.toFixed(0)} pcs`, 'var(--green)'],
                        ['Rejected', `${rejectedQtyForPrint.toFixed(0)} pcs`, rejectedQtyForPrint > 0 ? 'var(--red)' : 'var(--text-primary)'],
                        ['Yield', productionYield !== null ? `${productionYield.toFixed(1)}%` : '-', 'var(--accent)'],
                      ].map(([label, value, color]) => (
                        <div key={label} style={{ padding: '0.65rem', background: 'var(--bg-hover)', borderRadius: 6 }}>
                          <div style={{ color, fontSize: '1rem', fontWeight: 800 }}>{value}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {parseInt(statusRejectedQty) > 0 && (
                    <div className="alert alert-warning" style={{ fontSize: '0.8rem' }}>
                      ⚠ {statusRejectedQty} piece(s) failed — a Rework Required step will be needed.
                    </div>
                  )}
                  {/* Material used — shows reserved qty, validates against it */}
                  <div className="form-group" style={{ marginTop: '0.5rem' }}>
                    <label className="form-label">Actual Material Used *</label>
                    {/* Show reserved qty info box */}
                    {request?.material_reserved_qty > 0 && (
                      <div style={{
                        padding: '0.6rem 0.85rem', borderRadius: 6, marginBottom: '0.5rem',
                        background: 'var(--blue-dim)', border: '1px solid rgba(59,130,246,0.3)',
                        fontSize: '0.82rem', color: 'var(--blue)',
                      }}>
                        🔒 Reserved for production: <strong>{parseFloat(request.material_reserved_qty).toFixed(1)}g</strong>
                        {request.material_reserved_spool && (
                          <span style={{ marginLeft: '0.75rem', opacity: 0.8 }}>
                            Spool: {request.material_reserved_spool}
                          </span>
                        )}
                        <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', opacity: 0.8 }}>
                          Enter the actual quantity used — must not exceed reserved amount.
                        </div>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input
                        type="number" min="0" step="0.1"
                        className="form-input"
                        value={statusMaterialUsed}
                        onChange={e => setStatusMaterialUsed(e.target.value)}
                        placeholder={request?.material_reserved_qty ? `max ${parseFloat(request.material_reserved_qty).toFixed(0)}g` : 'e.g. 48'}
                        style={{
                          flex: 1,
                          borderColor: statusMaterialUsed && request?.material_reserved_qty > 0 &&
                            parseFloat(statusMaterialUsed) > parseFloat(request.material_reserved_qty) * 1.1
                            ? 'var(--red)' : undefined
                        }}
                      />
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>g</span>
                    </div>
                    {/* Real-time feedback */}
                    {statusMaterialUsed && request?.material_reserved_qty > 0 && (() => {
                      const used     = parseFloat(statusMaterialUsed);
                      const reserved = parseFloat(request.material_reserved_qty);
                      const diff     = used - reserved;
                      if (used > reserved * 1.1) return (
                        <div style={{ marginTop: '0.35rem', padding: '0.5rem 0.75rem', background: 'var(--red-dim)', borderRadius: 6, color: 'var(--red)', fontSize: '0.78rem' }}>
                          ✕ <strong>Exceeds reserved quantity</strong> by {diff.toFixed(1)}g.
                          Cannot proceed. Reserve more material before continuing.
                        </div>
                      );
                      if (used < reserved) return (
                        <div style={{ marginTop: '0.35rem', fontSize: '0.75rem', color: 'var(--green)' }}>
                          ? {(reserved - used).toFixed(1)}g will be returned to stock.
                        </div>
                      );
                      return (
                        <div style={{ marginTop: '0.35rem', fontSize: '0.75rem', color: 'var(--cyan)' }}>
                          ? Exact match with reserved quantity.
                        </div>
                      );
                    })()}
                  </div>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Actual Print Time (minutes)</label>
                      <input
                        className="form-input"
                        value={actualPrintTimePreview !== null ? actualPrintTimePreview.toFixed(0) : ''}
                        readOnly
                        placeholder="Calculated from Start Time and End Time"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Production Cost (€)</label>
                        <input
                          className="form-input"
                          value={cycleProductionCost !== null ? `${cycleProductionCost.toFixed(2)} €` : ''}
                          readOnly
                        placeholder={request.material_cost_per_unit && request.printer_cost_per_minute ? 'Calculated from planning data' : 'Missing configured rates'}
                        style={{ fontWeight: 700, color: 'var(--green)' }}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* COMPLETED: reception confirmation */}
              {selectedStatus === 'completed' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Reception Condition</label>
                    <select className="form-select" value={statusReceptionCondition} onChange={e => setStatusReceptionCondition(e.target.value)}>
                      <option value="ok">? OK — fully compliant</option>
                      <option value="partial">⚠ Partial — partially accepted</option>
                      <option value="damaged">✕ Damaged on delivery</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Reception Comment</label>
                    <textarea className="form-textarea" value={statusReceptionComment} onChange={e => setStatusReceptionComment(e.target.value)}
                      placeholder='e.g. "Part installed on line P3, fits perfectly."' style={{ minHeight: 60 }}/>
                  </div>
                </>
              )}

              {selectedStatus && needsReason.includes(selectedStatus) && (
                <div className="form-group">
                  <label className="form-label">Reason *</label>
                  <textarea className="form-textarea" value={statusReason} onChange={e => setStatusReason(e.target.value)}
                    placeholder={`Explain why the request is being marked as ${selectedStatus.replace(/_/g,' ')}…`}/>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">
                  {selectedStatus === 'archived' ? 'Lessons Learned (optional)' : 'Comment'}
                </label>
                <textarea
                  className="form-textarea"
                  value={statusComment}
                  onChange={e => setStatusComment(e.target.value)}
                  placeholder={
                    selectedStatus === 'archived'
                      ? 'Ex: Orientation à plat recommandée, infill 30% suffisant…'
                      : 'Optional comment or instructions…'
                  }
                  style={{ minHeight: 70 }}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowStatusModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleStatusUpdate} disabled={!selectedStatus || updating}>
                {updating ? <span className="spinner" style={{ width: 14, height: 14 }}/> : null}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
