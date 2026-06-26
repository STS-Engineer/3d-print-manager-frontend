import React, { useEffect, useMemo, useState } from 'react';
import api from '../utils/api';
import { DatePicker } from '../components/common/DatePicker';
import Sidebar from '../components/common/Sidebar';
import { isProductionTechnician } from '../utils/roles';

const reportConfigs = {
  requests: {
    title: 'Export Requests',
    crumb: 'Reports / Export Requests',
    description: 'Export request data including status, requester, technician, site, material, dates, and cost information.',
    endpoint: '/export/requests/all',
    formats: ['Excel', 'CSV'],
    filters: ['site', 'status', 'priority', 'category', 'requester', 'technician', 'dateRange'],
  },
  workload: {
    title: 'Export Workload',
    crumb: 'Reports / Export Workload',
    description: 'Export workflow snapshot and history data including assigned requests, technicians, printers, statuses, dates, delays, and hours.',
    endpoint: '/export/workflow/snapshot',
    primaryLabel: 'Workflow Snapshot Export',
    secondaryEndpoint: '/export/workflow/history',
    secondaryLabel: 'Workflow History Export',
    secondaryFormats: ['Excel', 'CSV'],
    tertiaryEndpoint: '/export/workload/printer',
    tertiaryLabel: 'Export Printer Workload',
    formats: ['Excel', 'CSV'],
    filters: ['site', 'technician', 'printer', 'status', 'dateRange'],
  },
  materials: {
    title: 'Export Materials',
    crumb: 'Reports / Export Materials',
    description: 'Export material consumption and stock information including stock quantity, usage, thresholds, and transactions.',
    endpoint: '/export/materials',
    secondaryEndpoint: '/export/inventory/transactions',
    secondaryLabel: 'Export Inventory Transactions',
    formats: ['Excel', 'CSV'],
    filters: ['site', 'material', 'dateRange'],
  },
  inventory: {
    title: 'Export Inventory',
    crumb: 'Reports / Export Inventory',
    description: 'Export inventory transactions, material consumption, low stock reports, and material coverage forecasts.',
    endpoint: '/export/inventory/transactions',
    secondaryEndpoint: '/export/inventory/low-stock',
    secondaryLabel: 'Export Low Stock',
    tertiaryEndpoint: '/export/inventory/forecast',
    tertiaryLabel: 'Export Material Forecast',
    formats: ['Excel', 'CSV'],
    filters: ['material', 'dateRange'],
  },
  executive: {
    title: 'Export Executive',
    crumb: 'Reports / Export Executive',
    description: 'Export executive reports, KPI summaries, and forecast data for leadership review.',
    endpoint: '/export/executive/report',
    secondaryEndpoint: '/export/executive/kpis',
    secondaryLabel: 'Export Executive KPIs',
    tertiaryEndpoint: '/export/executive/forecast',
    tertiaryLabel: 'Export Forecast',
    formats: ['Excel', 'CSV'],
    filters: ['site', 'material', 'printer', 'technician', 'dateRange'],
  },
  kpis: {
    title: 'Export KPIs',
    crumb: 'Reports / Export KPIs',
    description: 'Export operational and performance KPIs including lead time, on-time delivery, rework, failed prints, backlog, and completion statistics.',
    endpoint: '/export/kpis',
    formats: ['Excel'],
    filters: ['site', 'dateRange'],
    kpiDateParams: true,
  },
  cost: {
    title: 'Export Cost',
    crumb: 'Reports / Export Cost',
    description: 'Export financial and cost analysis including cost totals, variance, breakdowns, rework cost, and top cost drivers.',
    endpoint: '/export/cost-kpis',
    formats: ['Excel'],
    filters: ['site', 'material', 'printer', 'technician', 'dateRange'],
  },
  archive: {
    title: 'Export Archive',
    crumb: 'Reports / Export Archive',
    description: 'Export archived historical request data for long-term production and business analysis.',
    endpoint: '/export/requests/archived',
    formats: ['Excel', 'CSV'],
    filters: ['site', 'archiveType', 'status', 'dateRange'],
  },
};

const statusOptions = [
  'submitted', 'approved', 'planned', 'assigned', 'in_progress', 'printed',
  'quality_check', 'requester_confirmation', 'completed', 'archived',
  'blocked', 'on_hold', 'rework_required', 'cancelled', 'rejected',
];
const priorities = ['critical', 'high', 'normal', 'low'];

const initialFilters = {
  site_id: '',
  status: '',
  priority: '',
  category_id: '',
  requester: '',
  technician_id: '',
  printer_id: '',
  material_id: '',
  archive_type: '',
  date_from: '',
  date_to: '',
};

const downloadFile = async (endpoint, filename, setLoading) => {
  setLoading(true);
  try {
    const response = await api.get(endpoint, { responseType: 'blob' });
    const ct = response.headers['content-type'] || '';
    const isXlsx = ct.includes('spreadsheet') || ct.includes('excel');
    const ext = isXlsx ? '.xlsx' : '.csv';
    const blob = new Blob([response.data], { type: ct || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename.replace(/\.(xlsx|csv|pdf)$/i, ext));
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Download failed:', err);
    alert('Download failed. Check your permissions and try again.');
  } finally {
    setLoading(false);
  }
};

export default function ReportsPage({ reportType = 'requests' }) {
  const config = reportConfigs[reportType] || reportConfigs.requests;
  const [filters, setFilters] = useState({ ...initialFilters });
  const [options, setOptions] = useState({ sites: [], materials: [], printers: [], technicians: [], categories: [] });
  const [loading, setLoading] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/sites'),
      api.get('/materials'),
      api.get('/printers'),
      api.get('/users'),
      api.get('/categories'),
    ]).then(([sites, materials, printers, users, categories]) => {
      setOptions({
        sites: sites.data || [],
        materials: materials.data || [],
        printers: printers.data || [],
        technicians: (users.data || []).filter(u => isProductionTechnician(u.role)),
        categories: categories.data || [],
      });
    }).catch(err => console.error('[Reports] Options failed:', err));
  }, []);

  useEffect(() => {
    setFilters({ ...initialFilters });
  }, [reportType]);

  const setFilter = (key, value) => setFilters(prev => ({ ...prev, [key]: value }));

  const query = useMemo(() => {
    const qs = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (!value) return;
      if (config.kpiDateParams && key === 'date_from') qs.set('from', value);
      else if (config.kpiDateParams && key === 'date_to') qs.set('to', value);
      else qs.set(key, value);
    });
    return qs.toString();
  }, [config.kpiDateParams, filters]);

  const endpointWithQuery = (endpoint, format) => {
    const qs = new URLSearchParams(query);
    if (format) qs.set('format', format.toLowerCase());
    const suffix = qs.toString();
    return `${endpoint}${suffix ? `?${suffix}` : ''}`;
  };

  const handleExport = (endpoint, label, format) => {
    const slug = `${config.title}-${label || format}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    downloadFile(endpointWithQuery(endpoint, format), `${slug}-${new Date().toISOString().split('T')[0]}.xlsx`, setLoading);
  };

  const has = key => config.filters.includes(key);

  return (
    <div className="page">
      <Sidebar />
      <div className="main-content">
        <div className="page-header">
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginBottom: '0.25rem' }}>{config.crumb}</div>
            <h1 style={{ fontSize: '1.3rem', fontFamily: 'var(--font-heading)' }}>{config.title}</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem', maxWidth: 760 }}>
              {config.description}
            </p>
          </div>
        </div>

        <div className="page-body">
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div className="dashboard-section-header">
              <div>
                <h2>Filters</h2>
                <p>Only filters relevant to this export are shown.</p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setFilters({ ...initialFilters })}>Reset Filters</button>
            </div>
            <div className="grid-3">
              {has('site') && (
                <div className="form-group"><label className="form-label">Site</label>
                  <select className="form-select" value={filters.site_id} onChange={e => setFilter('site_id', e.target.value)}>
                    <option value="">All sites</option>{options.sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
              {has('status') && (
                <div className="form-group"><label className="form-label">Status</label>
                  <select className="form-select" value={filters.status} onChange={e => setFilter('status', e.target.value)}>
                    <option value="">All statuses</option>{statusOptions.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
              )}
              {has('priority') && (
                <div className="form-group"><label className="form-label">Priority</label>
                  <select className="form-select" value={filters.priority} onChange={e => setFilter('priority', e.target.value)}>
                    <option value="">All priorities</option>{priorities.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              )}
              {has('category') && (
                <div className="form-group"><label className="form-label">Category</label>
                  <select className="form-select" value={filters.category_id} onChange={e => setFilter('category_id', e.target.value)}>
                    <option value="">All categories</option>{options.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
              {has('requester') && (
                <div className="form-group"><label className="form-label">Requester</label>
                  <input className="form-input" value={filters.requester} onChange={e => setFilter('requester', e.target.value)} placeholder="Requester name"/>
                </div>
              )}
              {has('technician') && (
                <div className="form-group"><label className="form-label">Technician</label>
                  <select className="form-select" value={filters.technician_id} onChange={e => setFilter('technician_id', e.target.value)}>
                    <option value="">All technicians</option>{options.technicians.map(t => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
                  </select>
                </div>
              )}
              {has('printer') && (
                <div className="form-group"><label className="form-label">Printer</label>
                  <select className="form-select" value={filters.printer_id} onChange={e => setFilter('printer_id', e.target.value)}>
                    <option value="">All printers</option>{options.printers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}
              {has('material') && (
                <div className="form-group"><label className="form-label">Material</label>
                  <select className="form-select" value={filters.material_id} onChange={e => setFilter('material_id', e.target.value)}>
                    <option value="">All materials</option>{options.materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
              )}
              {has('archiveType') && (
                <div className="form-group"><label className="form-label">Archive Type</label>
                  <select className="form-select" value={filters.archive_type} onChange={e => setFilter('archive_type', e.target.value)}>
                    <option value="">All archive types</option>
                    <option value="application">Application Archive</option>
                    <option value="monday">Monday.com Historical Archive</option>
                  </select>
                </div>
              )}
              {has('dateRange') && (
                <>
                  <div className="form-group"><label className="form-label">Date Start</label>
                    <DatePicker value={filters.date_from} onChange={v => setFilter('date_from', v)} placeholder="Start date"/>
                  </div>
                  <div className="form-group"><label className="form-label">Date End</label>
                    <DatePicker value={filters.date_to} onChange={v => setFilter('date_to', v)} placeholder="End date"/>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <h3 style={{ fontSize: '0.95rem', fontFamily: 'var(--font-heading)' }}>{config.title}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '0.25rem' }}>
                  Export will include the data described above using the selected filters.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {config.formats.map(format => (
                  <button
                    key={format}
                    className="btn btn-primary"
                    disabled={Boolean(loading)}
                    onClick={() => handleExport(config.endpoint, '', format)}
                  >
                    {loading ? <span className="spinner" style={{ width: 14, height: 14 }}/> : null}
                    {config.primaryLabel ? `${config.primaryLabel} (${format})` : `Export ${format}`}
                  </button>
                ))}
                {config.secondaryEndpoint && (
                  (config.secondaryFormats || ['Excel']).map(format => (
                    <button
                      key={`${config.secondaryEndpoint}-${format}`}
                      className="btn btn-secondary"
                      disabled={Boolean(loading)}
                      onClick={() => handleExport(config.secondaryEndpoint, config.secondaryLabel || 'secondary', format)}
                    >
                      {config.secondaryLabel || 'Export Secondary'}{(config.secondaryFormats || []).length ? ` (${format})` : ''}
                    </button>
                  ))
                )}
                {config.tertiaryEndpoint && (
                  <button className="btn btn-secondary" disabled={Boolean(loading)} onClick={() => handleExport(config.tertiaryEndpoint, config.tertiaryLabel || 'tertiary', 'Excel')}>
                    {config.tertiaryLabel || 'Export Tertiary'}
                  </button>
                )}
                {(reportType === 'kpis' || reportType === 'cost') && (
                  <button className="btn btn-ghost" disabled title="PDF export endpoint is not available yet">Export PDF</button>
                )}
              </div>
            </div>
          </div>

          <div className="alert alert-info" style={{ marginTop: '1rem' }}>
            Reports are generated from current application data and exported with the selected filters.
          </div>
        </div>
      </div>
    </div>
  );
}
