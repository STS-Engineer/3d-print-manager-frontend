import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import { DatePicker } from './DatePicker';
import { dashboardMonths, dashboardYears, getActiveFilterLabels, initialDashboardFilters } from '../../utils/dashboardFilters';
import { isProductionTechnician } from '../../utils/roles';

export default function DashboardFilters({ filters, onChange, style = {} }) {
  const [options, setOptions] = useState({ sites: [], materials: [], printers: [], technicians: [] });

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [sites, materials, printers, users] = await Promise.all([
          api.get('/sites'),
          api.get('/materials'),
          api.get('/printers'),
          api.get('/users'),
        ]);
        setOptions({
          sites: sites.data || [],
          materials: materials.data || [],
          printers: printers.data || [],
          technicians: (users.data || []).filter(u => isProductionTechnician(u.role)),
        });
      } catch (err) {
        console.error('[Dashboard Filters] Options failed:', err);
      }
    };
    loadOptions();
  }, []);

  const setFilter = (key, value) => onChange({ ...filters, [key]: value });
  const clearFilters = () => onChange({ ...initialDashboardFilters });
  const activeLabels = getActiveFilterLabels(filters);

  return (
    <div className="card" style={{ marginBottom: '1rem', ...style }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', marginBottom: '0.85rem' }}>
        <div>
          <h3 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Dashboard Filters
          </h3>
          <div className="dashboard-meta" style={{ marginTop: '0.45rem' }}>
            <span>Last Updated: {new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</span>
            <span>{activeLabels.length ? `Active filters: ${activeLabels.join(', ')}` : 'Active filters: All data'}</span>
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={clearFilters}>Clear</button>
      </div>
      <div className="grid-2" style={{ gap: '0.85rem' }}>
        <div className="form-group">
          <label className="form-label">Site</label>
          <select className="form-select" value={filters.site_id} onChange={e => setFilter('site_id', e.target.value)}>
            <option value="">All sites</option>
            {options.sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Material</label>
          <select className="form-select" value={filters.material_id} onChange={e => setFilter('material_id', e.target.value)}>
            <option value="">All materials</option>
            {options.materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Printer</label>
          <select className="form-select" value={filters.printer_id} onChange={e => setFilter('printer_id', e.target.value)}>
            <option value="">All printers</option>
            {options.printers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Technician</label>
          <select className="form-select" value={filters.technician_id} onChange={e => setFilter('technician_id', e.target.value)}>
            <option value="">All technicians</option>
            {options.technicians.map(t => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Date Start</label>
          <DatePicker value={filters.date_from} onChange={v => setFilter('date_from', v)} placeholder="Start date"/>
        </div>
        <div className="form-group">
          <label className="form-label">Date End</label>
          <DatePicker value={filters.date_to} onChange={v => setFilter('date_to', v)} placeholder="End date"/>
        </div>
        <div className="form-group">
          <label className="form-label">Month</label>
          <select className="form-select" value={filters.month} onChange={e => setFilter('month', e.target.value)}>
            <option value="">All months</option>
            {dashboardMonths.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Year</label>
          <select className="form-select" value={filters.year} onChange={e => setFilter('year', e.target.value)}>
            <option value="">All years</option>
            {dashboardYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}
