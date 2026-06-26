import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { formatDate } from '../utils/statusHelpers';
import Sidebar from '../components/common/Sidebar';
import { DatePicker } from '../components/common/DatePicker';

// Authenticated download (JWT via Axios → .xlsx)
const downloadFile = async (endpoint, filename, setLoading) => {
  if (setLoading) setLoading(true);
  try {
    const res = await api.get(endpoint, { responseType: 'blob' });
    // Detect if server returned xlsx or csv
    const ct = res.headers['content-type'] || '';
    const ext = ct.includes('spreadsheet') ? '.xlsx' : '.csv';
    const blob = new Blob([res.data], { type: ct });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href  = url;
    link.setAttribute('download', filename.endsWith('.xlsx') || filename.endsWith('.csv') ? filename : filename + ext);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Download failed:', err);
    alert('Download failed. Please check your permissions and try again.');
  } finally {
    if (setLoading) setLoading(false);
  }
};

export default function ArchivePage() {
  const navigate   = useNavigate();
  const location   = useLocation();
  const debounceRef = useRef(null);
  const initialSource = new URLSearchParams(location.search).get('source') || '';

  const [requests, setRequests]   = useState([]);
  const [stats, setStats]         = useState(null);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(true);
  const [exporting, setExporting] = useState(false);

  // Separate search input from applied filter (debounce)
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState({
    search: '', department: '', priority: '', requester: '', date_from: '', date_to: '', source: initialSource,
  });

  const handleSearchChange = (value) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setFilters(f => ({ ...f, search: value.trim() }));
      setPage(1);
    }, 400);
  };

  const setFilter = (key, value) => {
    setFilters(f => ({ ...f, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setSearchInput('');
    setFilters({ search: '', department: '', priority: '', requester: '', date_from: '', date_to: '', source: '' });
    setPage(1);
  };

  const hasFilters = Object.values(filters).some(v => v !== '');

  const fetchArchive = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 25 });
      Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });

      const [archRes, statsRes] = await Promise.all([
        api.get(`/archive?${params}`),
        api.get(`/archive/stats?${params}`),
      ]);
      setRequests(archRes.data.requests || []);
      setTotal(archRes.data.total || 0);
      setStats(statsRes.data);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, [page, filters]);

  useEffect(() => { fetchArchive(); }, [fetchArchive]);
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const handleExport = () => {
    downloadFile(
      '/export/requests/archived',
      `archived-requests-${new Date().toISOString().split('T')[0]}.xlsx`,
      setExporting
    );
  };

  return (
    <div className="page">
      <Sidebar />
      <div className="main-content">
        <div className="page-header">
          <div>
            <h1 style={{ fontSize: '1.3rem', fontFamily: 'var(--font-heading)' }}>Archive</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
              {loading ? 'Loading…' : `${total} archived request${total !== 1 ? 's' : ''}`}
              {hasFilters && <span style={{ color: 'var(--accent)', marginLeft: '0.5rem' }}>· Filtered</span>}
            </p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={handleExport} disabled={exporting}>
            {exporting
              ? <><span className="spinner" style={{ width: 12, height: 12 }}/> Exporting…</>
              : <>↓ Export Excel (.xlsx)</>
            }
          </button>
        </div>

        {/* ── Stats ──────────────────────────────────────────────────── */}
        {stats && (
          <div className="grid-4" style={{ padding: '1rem 2rem', borderBottom: '1px solid var(--border)' }}>
            <div className="kpi-card" style={{ padding: '0.85rem' }}>
              <div className="kpi-value" style={{ fontSize: '1.5rem' }}>{stats.total_archived || 0}</div>
              <div className="kpi-label">Total Archived</div>
            </div>
            <div className="kpi-card" style={{ padding: '0.85rem' }}>
              <div className="kpi-value" style={{ fontSize: '1.5rem', color: 'var(--green)' }}>{stats.passed_qc || 0}</div>
              <div className="kpi-label">Passed QC</div>
            </div>
            <div className="kpi-card" style={{ padding: '0.85rem' }}>
              <div className="kpi-value" style={{ fontSize: '1.5rem', color: 'var(--yellow)' }}>{stats.had_rework || 0}</div>
              <div className="kpi-label">Had Rework</div>
            </div>
            <div className="kpi-card" style={{ padding: '0.85rem' }}>
              <div className="kpi-value" style={{ fontSize: '1.5rem', color: 'var(--cyan)' }}>
                {stats.avg_print_hours ? `${parseFloat(stats.avg_print_hours).toFixed(1)}h` : '—'}
              </div>
              <div className="kpi-label">Avg Print Time</div>
            </div>
          </div>
        )}

        {/* ── Filters ────────────────────────────────────────────────── */}
        <div style={{ padding: '0.85rem 2rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
              style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input className="form-input" placeholder="Search ID, title, requester…"
              value={searchInput} onChange={e => handleSearchChange(e.target.value)}
              style={{ width: 240, paddingLeft: 30 }}/>
            {searchInput && (
              <button onClick={() => handleSearchChange('')}
                style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16 }}>×</button>
            )}
          </div>

          <select className="form-select" value={filters.priority} onChange={e => setFilter('priority', e.target.value)} style={{ width: 130 }}>
            <option value="">All Priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>

          <select className="form-select" value={filters.source} onChange={e => setFilter('source', e.target.value)} style={{ width: 150 }}>
            <option value="">All Sources</option>
            <option value="application">Application</option>
            <option value="monday">Monday.com</option>
          </select>

          <input className="form-input" placeholder="Department…"
            value={filters.department} onChange={e => setFilter('department', e.target.value)} style={{ width: 150 }}/>

          <DatePicker
            value={filters.date_from}
            onChange={v => setFilter('date_from', v)}
            placeholder="Archived from"
            style={{ width: 155 }}
          />

          <DatePicker
            value={filters.date_to}
            onChange={v => setFilter('date_to', v)}
            placeholder="Archived to"
            style={{ width: 155 }}
          />

          {hasFilters && (
            <button className="btn btn-ghost btn-sm" onClick={clearFilters}>✕ Clear</button>
          )}
        </div>

        {/* ── Results ────────────────────────────────────────────────── */}
        <div className="page-body">
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
              <span className="spinner" style={{ width: 28, height: 28 }}/>
            </div>
          ) : requests.length === 0 ? (
            <div className="empty-state card">
              <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" style={{ opacity: 0.3 }}>
                <path d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8"/>
              </svg>
              <p style={{ marginTop: '0.75rem' }}>{hasFilters ? 'No archived requests match your filters' : 'No archived requests yet'}</p>
              {hasFilters && <button className="btn btn-ghost btn-sm" style={{ marginTop: '0.5rem' }} onClick={clearFilters}>Clear filters</button>}
            </div>
          ) : (
            <>
              <div className="card" style={{ padding: 0 }}>
                <table>
                  <thead>
                    <tr>
                      <th>ID</th><th>Title</th><th>Category</th><th>Priority</th>
                      <th>Requester</th><th>Department</th><th>Source</th><th>Technician</th>
                      <th>Printer</th><th>Quality</th><th>Completed</th><th>Archived</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map(r => (
                      <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/requests/${r.id}`)}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600 }}>{r.request_number}</td>
                        <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.83rem', fontWeight: 500 }}>{r.title}</td>
                        <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{r.category_name || '—'}</td>
                        <td>
                          <span className={`badge priority-${r.priority}`}>{r.priority}</span>
                        </td>
                        <td style={{ fontSize: '0.8rem' }}>{r.requester_name}</td>
                        <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{r.requester_department}</td>
                        <td>
                          <span className="badge" style={{
                            background: r.source === 'monday' ? 'var(--blue-dim)' : 'var(--bg-hover)',
                            color: r.source === 'monday' ? 'var(--blue)' : 'var(--text-secondary)',
                          }}>
                            {r.source === 'monday' ? 'Monday.com' : 'Application'}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{r.technician_name || '—'}</td>
                        <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{r.printer_name || '—'}</td>
                        <td>
                          {r.quality_result ? (
                            <span style={{
                              fontSize: '0.7rem', fontWeight: 600,
                              padding: '0.15rem 0.5rem', borderRadius: 4,
                              background: r.quality_result === 'pass' ? 'var(--green-dim)' : r.quality_result === 'pass_with_deviation' ? 'var(--yellow-dim)' : 'var(--red-dim)',
                              color: r.quality_result === 'pass' ? 'var(--green)' : r.quality_result === 'pass_with_deviation' ? 'var(--yellow)' : 'var(--red)',
                              textTransform: 'uppercase',
                            }}>
                              {r.quality_result.replace(/_/g,' ')}
                            </span>
                          ) : '—'}
                        </td>
                        <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{formatDate(r.completion_date)}</td>
                        <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{formatDate(r.archive_date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {total > 25 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
                  <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
                  <span style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Page {page} of {Math.ceil(total / 25)} ({total} results)
                  </span>
                  <button className="btn btn-ghost btn-sm" disabled={page >= Math.ceil(total / 25)} onClick={() => setPage(p => p + 1)}>Next →</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
