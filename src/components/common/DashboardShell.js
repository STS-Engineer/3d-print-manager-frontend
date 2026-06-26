import React, { useMemo, useState } from 'react';
import GlobalFilterToolbar from './GlobalFilterToolbar';

const toneMap = {
  neutral: 'var(--text-primary)',
  good: 'var(--green)',
  warning: 'var(--yellow)',
  danger: 'var(--red)',
  info: 'var(--blue)',
};

export function DashboardHeader({ title, description, dashboard, actions }) {
  return (
    <div className="dashboard-header">
      <div>
        <div className="dashboard-breadcrumb">Dashboards / {title}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <GlobalFilterToolbar dashboard={dashboard} actions={actions} />
    </div>
  );
}

export function DashboardKpiGrid({ children, className = '' }) {
  return <div className={`dashboard-kpi-grid ${className}`.trim()}>{children}</div>;
}

export function DashboardKpiCard({ label, value, helper, trend, tone = 'neutral' }) {
  return (
    <div className="dashboard-kpi-card" style={{ '--kpi-tone': toneMap[tone] || toneMap.neutral }}>
      <div className="dashboard-kpi-value">{value}</div>
      <div className="dashboard-kpi-label">{label}</div>
      {helper && <div className="dashboard-kpi-helper">{helper}</div>}
      {trend && <div className="dashboard-kpi-trend">{trend}</div>}
    </div>
  );
}

export function DashboardSection({ title, description, children, actions }) {
  return (
    <section className="dashboard-section">
      <div className="dashboard-section-header">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function ChartPanel({ title, description, children }) {
  return (
    <div className="dashboard-panel">
      <div className="dashboard-panel-header">
        <h3>{title}</h3>
        {description && <p>{description}</p>}
      </div>
      {children}
    </div>
  );
}

const valueFor = (row, key) => {
  if (typeof key === 'function') return key(row);
  return row?.[key];
};

const exportRows = (filename, columns, rows) => {
  const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const header = columns.map(c => escape(c.label)).join(',');
  const body = rows.map(row => columns.map(c => escape(valueFor(row, c.key))).join(',')).join('\n');
  const blob = new Blob([[header, body].filter(Boolean).join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export function DashboardDataTable({ title, rows = [], columns = [], filename = 'dashboard-export.csv', pageSize = 8, onRowClick }) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: columns[0]?.key, dir: 'asc' });
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const data = q
      ? rows.filter(row => columns.some(col => String(valueFor(row, col.key) ?? '').toLowerCase().includes(q)))
      : rows;
    if (!sort.key) return data;
    return [...data].sort((a, b) => {
      const av = valueFor(a, sort.key);
      const bv = valueFor(b, sort.key);
      const an = parseFloat(av);
      const bn = parseFloat(bv);
      const result = Number.isFinite(an) && Number.isFinite(bn)
        ? an - bn
        : String(av ?? '').localeCompare(String(bv ?? ''));
      return sort.dir === 'asc' ? result : -result;
    });
  }, [columns, rows, search, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visible = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const changeSort = (key) => {
    setSort(prev => ({
      key,
      dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc',
    }));
  };

  return (
    <div className="dashboard-table-card">
      <div className="dashboard-table-toolbar">
        <h3>{title}</h3>
        <div>
          <input
            className="form-input dashboard-table-search"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search"
          />
          <button className="btn btn-secondary btn-sm" onClick={() => exportRows(filename, columns, filtered)}>Export</button>
        </div>
      </div>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              {columns.map(col => (
                <th key={col.label} onClick={() => changeSort(col.key)} style={{ cursor: 'pointer' }}>
                  {col.label}{sort.key === col.key ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, index) => (
              <tr
                key={row.id || row.request_number || `${title}-${index}`}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                style={onRowClick ? { cursor: 'pointer' } : undefined}
              >
                {columns.map(col => (
                  <td key={col.label}>{col.render ? col.render(row) : valueFor(row, col.key)}</td>
                ))}
              </tr>
            ))}
            {visible.length === 0 && (
              <tr><td colSpan={columns.length} style={{ color: 'var(--text-muted)' }}>No matching data</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="dashboard-table-footer">
        <span>{filtered.length} rows</span>
        <div>
          <button className="btn btn-ghost btn-sm" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>Previous</button>
          <span>Page {safePage} / {totalPages}</span>
          <button className="btn btn-ghost btn-sm" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)}>Next</button>
        </div>
      </div>
    </div>
  );
}
