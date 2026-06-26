import React, { useEffect, useState } from 'react';
import { useGlobalFilters } from '../../context/GlobalFilterContext';
import { DatePicker } from './DatePicker';
import { periodOptions } from '../../utils/dashboardFilters';

const dashboardAdvanced = {
  operational: ['status', 'priority', 'category', 'material', 'printer', 'technician', 'requester', 'criticality', 'approval_status', 'delivery_status'],
  executive: ['status', 'priority', 'category', 'material', 'printer', 'technician', 'requester', 'criticality', 'production_status', 'approval_status', 'delivery_status', 'inventory_status'],
  performance: ['status', 'priority', 'category', 'material', 'printer', 'technician', 'requester', 'criticality'],
  management: ['status', 'priority', 'category', 'material', 'printer', 'technician', 'requester', 'criticality', 'department'],
  cost: ['status', 'priority', 'category', 'material', 'printer', 'technician', 'requester', 'criticality'],
  resource: ['status', 'priority', 'category', 'material', 'printer', 'technician', 'requester', 'criticality', 'production_status', 'inventory_status'],
};

const priorities = ['critical', 'high', 'normal', 'low'];
const criticalities = ['low', 'normal', 'high', 'critical'];
const statuses = [
  'submitted', 'completeness_check', 'feasibility_review', 'approved', 'planned',
  'assigned', 'in_progress', 'printed', 'post_processing', 'quality_check',
  'rework_required', 'blocked', 'more_info_required', 'requester_confirmation',
  'completed', 'rejected',
];
const productionStatuses = [
  ['planned', 'Planned'],
  ['active', 'Active Production'],
  ['blocked', 'Blocked / On Hold'],
  ['completed', 'Completed Production'],
];
const approvalStatuses = [
  ['pending', 'Pending Approval'],
  ['approved', 'Approved'],
  ['rejected', 'Rejected'],
];
const deliveryStatuses = [
  ['overdue', 'Overdue'],
  ['awaiting_confirmation', 'Awaiting Confirmation'],
  ['completed', 'Delivered / Completed'],
  ['on_time', 'Completed On Time'],
  ['late', 'Completed Late'],
];
const inventoryStatuses = [
  ['low_stock', 'Low Stock'],
  ['in_stock', 'In Stock'],
];

const Field = ({ children, show }) => show ? <div className="form-group">{children}</div> : null;

export default function GlobalFilterToolbar({ dashboard = 'default', actions }) {
  const { filters, setFilter, setFilters, resetAdvanced, resetAll, options, periodLabel, lastUpdated } = useGlobalFilters();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(filters);
  const fields = dashboardAdvanced[dashboard] || ['material', 'printer', 'technician'];

  useEffect(() => {
    if (!open) setDraft(filters);
  }, [filters, open]);

  const applyDraft = () => {
    setFilters(prev => ({ ...prev, ...draft }));
    setOpen(false);
  };

  const resetDraft = () => {
    resetAdvanced();
    setDraft(prev => ({
      ...prev,
      material_id: '',
      printer_id: '',
      technician_id: '',
      priority: '',
      status: '',
      requester_id: '',
      requester: '',
      criticality: '',
      production_status: '',
      approval_status: '',
      delivery_status: '',
      inventory_status: '',
      department: '',
      category_id: '',
    }));
    setOpen(false);
  };

  return (
    <>
      <div className="global-filter-toolbar">
        <div className="global-filter-main">
          <label>
            <span>Site</span>
            <select className="form-select" value={filters.site_id} onChange={e => setFilter('site_id', e.target.value)}>
              <option value="">All Sites</option>
              {options.sites.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}
            </select>
          </label>
          <label>
            <span>Period</span>
            <select className="form-select" value={filters.period || 'all_time'} onChange={e => setFilter('period', e.target.value)}>
              {periodOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          {filters.period === 'custom' && (
            <>
              <label>
                <span>Start</span>
                <DatePicker value={filters.date_from} onChange={v => setFilter('date_from', v)} placeholder="Start date"/>
              </label>
              <label>
                <span>End</span>
                <DatePicker value={filters.date_to} onChange={v => setFilter('date_to', v)} placeholder="End date"/>
              </label>
            </>
          )}
          <button className="btn btn-secondary btn-sm" onClick={() => setOpen(true)}>Filters ⚙</button>
          <button className="btn btn-ghost btn-sm" onClick={resetAll}>Clear All</button>
        </div>
        <div className="global-filter-status">
          <span>Site: {options.sites.find(s => String(s.id) === String(filters.site_id))?.name || 'All Sites'}</span>
          <span>Period: {periodLabel}</span>
          <span>Last Updated: {lastUpdated.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</span>
        </div>
        {actions && <div className="dashboard-actions">{actions}</div>}
      </div>

      {open && (
        <div className="filter-drawer-overlay" onClick={() => setOpen(false)}>
          <aside className="filter-drawer" onClick={e => e.stopPropagation()}>
            <div className="filter-drawer-header">
              <div>
                <h3>More Filters</h3>
                <p>Optional filters for the current dashboard.</p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Close</button>
            </div>
            <div className="filter-drawer-body">
              <Field show={fields.includes('material')}>
                <label className="form-label">Material</label>
                <select className="form-select" value={draft.material_id || ''} onChange={e => setDraft(prev => ({ ...prev, material_id: e.target.value }))}>
                  <option value="">All materials</option>
                  {options.materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </Field>
              <Field show={fields.includes('printer')}>
                <label className="form-label">Printer</label>
                <select className="form-select" value={draft.printer_id || ''} onChange={e => setDraft(prev => ({ ...prev, printer_id: e.target.value }))}>
                  <option value="">All printers</option>
                  {options.printers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <Field show={fields.includes('technician')}>
                <label className="form-label">Technician</label>
                <select className="form-select" value={draft.technician_id || ''} onChange={e => setDraft(prev => ({ ...prev, technician_id: e.target.value }))}>
                  <option value="">All technicians</option>
                  {options.technicians.map(t => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
                </select>
              </Field>
              <Field show={fields.includes('priority')}>
                <label className="form-label">Priority</label>
                <select className="form-select" value={draft.priority || ''} onChange={e => setDraft(prev => ({ ...prev, priority: e.target.value }))}>
                  <option value="">All priorities</option>
                  {priorities.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
              <Field show={fields.includes('requester')}>
                <label className="form-label">Requester</label>
                <select className="form-select" value={draft.requester_id || ''} onChange={e => setDraft(prev => ({ ...prev, requester_id: e.target.value }))}>
                  <option value="">All requesters</option>
                  {options.requesters.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
                </select>
              </Field>
              <Field show={fields.includes('criticality')}>
                <label className="form-label">Criticality</label>
                <select className="form-select" value={draft.criticality || ''} onChange={e => setDraft(prev => ({ ...prev, criticality: e.target.value }))}>
                  <option value="">All criticalities</option>
                  {criticalities.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field show={fields.includes('status')}>
                <label className="form-label">Status</label>
                <select className="form-select" value={draft.status || ''} onChange={e => setDraft(prev => ({ ...prev, status: e.target.value }))}>
                  <option value="">All statuses</option>
                  {statuses.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
              </Field>
              <Field show={fields.includes('production_status')}>
                <label className="form-label">Production Status</label>
                <select className="form-select" value={draft.production_status || ''} onChange={e => setDraft(prev => ({ ...prev, production_status: e.target.value }))}>
                  <option value="">All production states</option>
                  {productionStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </Field>
              <Field show={fields.includes('approval_status')}>
                <label className="form-label">Approval Status</label>
                <select className="form-select" value={draft.approval_status || ''} onChange={e => setDraft(prev => ({ ...prev, approval_status: e.target.value }))}>
                  <option value="">All approval states</option>
                  {approvalStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </Field>
              <Field show={fields.includes('delivery_status')}>
                <label className="form-label">Delivery Status</label>
                <select className="form-select" value={draft.delivery_status || ''} onChange={e => setDraft(prev => ({ ...prev, delivery_status: e.target.value }))}>
                  <option value="">All delivery states</option>
                  {deliveryStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </Field>
              <Field show={fields.includes('inventory_status')}>
                <label className="form-label">Inventory Status</label>
                <select className="form-select" value={draft.inventory_status || ''} onChange={e => setDraft(prev => ({ ...prev, inventory_status: e.target.value }))}>
                  <option value="">All inventory states</option>
                  {inventoryStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </Field>
              <Field show={fields.includes('department')}>
                <label className="form-label">Department</label>
                <select className="form-select" value={draft.department || ''} onChange={e => setDraft(prev => ({ ...prev, department: e.target.value }))}>
                  <option value="">All departments</option>
                  {options.departments.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </Field>
              <Field show={fields.includes('category')}>
                <label className="form-label">Category</label>
                <select className="form-select" value={draft.category_id || ''} onChange={e => setDraft(prev => ({ ...prev, category_id: e.target.value }))}>
                  <option value="">All categories</option>
                  {options.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
            </div>
            <div className="filter-drawer-footer">
              <button className="btn btn-ghost" onClick={resetDraft}>Reset Filters</button>
              <button className="btn btn-primary" onClick={applyDraft}>Apply Filters</button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
