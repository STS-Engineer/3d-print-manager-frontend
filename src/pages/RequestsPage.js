import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { StatusBadge, PriorityBadge, formatDate, formatDateTime, isOverdue } from '../utils/statusHelpers';
import Sidebar from '../components/common/Sidebar';
import { isProductionTechnician } from '../utils/roles';

const ReceptionConfirmedBadge = () => (
  <span
    className="badge"
    style={{
      background: 'var(--green-dim)',
      color: 'var(--green)',
      border: '1px solid rgba(34,197,94,0.3)',
      fontSize: '0.68rem',
      fontWeight: 700,
      whiteSpace: 'nowrap',
    }}
  >
    ✓ Reception Confirmed
  </span>
);

export default function RequestsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [sites, setSites] = useState([]);

  // Search input is kept separate with debounce
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState({
    status: '', priority: '', search: '', overdue: '', blocked: '', department: '', site_id: '',
  });

  const debounceRef = useRef(null);

  // Debounce search: wait 400ms after user stops typing before firing
  const handleSearchChange = (value) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setFilters(f => ({ ...f, search: value.trim() }));
      setPage(1);
    }, 400);
  };

  const handleFilterChange = (key, value) => {
    setFilters(f => ({ ...f, [key]: value }));
    setPage(1);
  };

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      // Build params — only include non-empty values
      const params = new URLSearchParams();
      params.set('page', page);
      params.set('limit', 25);
      if (filters.search)     params.set('search',   filters.search);
      if (filters.status)     params.set('status',   filters.status);
      if (filters.priority)   params.set('priority', filters.priority);
      if (filters.overdue)    params.set('overdue',  filters.overdue);
      if (filters.blocked)    params.set('blocked',  filters.blocked);
      if (filters.department) params.set('department', filters.department);
      if (filters.site_id)    params.set('site_id', filters.site_id);

      const res = await api.get(`/requests?${params.toString()}`);
      setRequests(res.data.requests || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error('Fetch requests error:', err);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    api.get('/sites').then(r => setSites(r.data)).catch(() => {});
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  const clearFilters = () => {
    setSearchInput('');
    setFilters({ status: '', priority: '', search: '', overdue: '', blocked: '', department: '', site_id: '' });
    setPage(1);
  };

  const hasActiveFilters = filters.status || filters.priority || filters.search || filters.overdue || filters.blocked || filters.department || filters.site_id;
  const canCreateRequest = ['requester', 'administrator'].includes(user?.role) || isProductionTechnician(user?.role);

  return (
    <div className="page">
      <Sidebar />
      <div className="main-content">
        <div className="page-header">
          <div>
            <h1 style={{ fontSize: '1.3rem', fontFamily: 'var(--font-heading)' }}>
              {user?.role === 'requester' ? 'My Requests' : 'All Requests'}
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
              {loading ? 'Loading…' : `${total} request${total !== 1 ? 's' : ''} found`}
              {hasActiveFilters && (
                <span style={{ color: 'var(--accent)', marginLeft: '0.5rem' }}>· Filtered</span>
              )}
            </p>
          </div>
          {canCreateRequest && (
            <button className="btn btn-primary" onClick={() => navigate('/requests/new')}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              New Request
            </button>
          )}
        </div>

        {/* ── Filters bar ─────────────────────────────────────────────── */}
        <div style={{
          padding: '1rem 2rem',
          borderBottom: '1px solid var(--border)',
          display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center',
        }}>
          {/* Search with clear button */}
          <div style={{ position: 'relative' }}>
            <svg
              width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"
              viewBox="0 0 24 24"
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}
            >
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              className="form-input"
              placeholder="Search ID, title, requester, project…"
              value={searchInput}
              onChange={e => handleSearchChange(e.target.value)}
              style={{ width: 280, paddingLeft: 32 }}
            />
            {searchInput && (
              <button
                onClick={() => handleSearchChange('')}
                style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', fontSize: 16, lineHeight: 1, padding: '0 2px',
                }}
              >×</button>
            )}
          </div>

          {/* Status filter */}
          <select
            className="form-select"
            value={filters.status}
            onChange={e => handleFilterChange('status', e.target.value)}
            style={{ width: 185 }}
          >
            <option value="">All Statuses</option>
            {[
              'draft','submitted','completeness_check','feasibility_review',
              'more_info_required','approved','rejected','prioritized','planned',
              'assigned','in_progress','printed','quality_check',
              'ready_for_pickup','completed','archived','on_hold','blocked',
              'cancelled','rework_required','waiting_for_material','waiting_for_machine',
            ].map(s => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>

          {/* Priority filter */}
          <select
            className="form-select"
            value={filters.priority}
            onChange={e => handleFilterChange('priority', e.target.value)}
            style={{ width: 145 }}
          >
            <option value="">All Priorities</option>
            <option value="critical">🔴 Critical</option>
            <option value="high">🟠 High</option>
            <option value="normal">🔵 Normal</option>
            <option value="low">⚪ Low</option>
          </select>

          {/* Department filter (staff only) */}
          {user?.role !== 'requester' && (
            <input
              className="form-input"
              placeholder="Department…"
              value={filters.department}
              onChange={e => handleFilterChange('department', e.target.value)}
              style={{ width: 160 }}
            />
          )}

          {user?.role !== 'requester' && (
            <select
              className="form-select"
              value={filters.site_id}
              onChange={e => handleFilterChange('site_id', e.target.value)}
              style={{ width: 150 }}
            >
              <option value="">All Sites</option>
              {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}

          {/* Quick filters (staff only) */}
          {user?.role !== 'requester' && (
            <>
              <button
                className={`btn btn-sm ${filters.overdue === 'true' ? 'btn-danger' : 'btn-ghost'}`}
                onClick={() => handleFilterChange('overdue', filters.overdue === 'true' ? '' : 'true')}
              >
                ⏰ Overdue
              </button>
              <button
                className={`btn btn-sm ${filters.blocked === 'true' ? 'btn-danger' : 'btn-ghost'}`}
                onClick={() => handleFilterChange('blocked', filters.blocked === 'true' ? '' : 'true')}
              >
                ⊘ Blocked
              </button>
            </>
          )}

          {/* Clear all */}
          {hasActiveFilters && (
            <button className="btn btn-ghost btn-sm" onClick={clearFilters}>
              ✕ Clear filters
            </button>
          )}
        </div>

        {/* ── Active filter chips ──────────────────────────────────────── */}
        {hasActiveFilters && (
          <div style={{
            padding: '0.5rem 2rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center',
          }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Active filters:</span>
            {filters.search && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: 'var(--accent-dim)', color: 'var(--accent)', borderRadius: 4, padding: '0.15rem 0.5rem', fontSize: '0.75rem' }}>
                Search: "{filters.search}"
                <button onClick={() => { setSearchInput(''); handleFilterChange('search', ''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 13, lineHeight: 1 }}>×</button>
              </span>
            )}
            {filters.status && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: 'var(--blue-dim)', color: 'var(--blue)', borderRadius: 4, padding: '0.15rem 0.5rem', fontSize: '0.75rem' }}>
                Status: {filters.status.replace(/_/g,' ')}
                <button onClick={() => handleFilterChange('status', '')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--blue)', fontSize: 13, lineHeight: 1 }}>×</button>
              </span>
            )}
            {filters.priority && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: 'var(--yellow-dim)', color: 'var(--yellow)', borderRadius: 4, padding: '0.15rem 0.5rem', fontSize: '0.75rem' }}>
                Priority: {filters.priority}
                <button onClick={() => handleFilterChange('priority', '')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--yellow)', fontSize: 13, lineHeight: 1 }}>×</button>
              </span>
            )}
            {filters.department && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: 'var(--purple-dim)', color: 'var(--purple)', borderRadius: 4, padding: '0.15rem 0.5rem', fontSize: '0.75rem' }}>
                Dept: {filters.department}
                <button onClick={() => handleFilterChange('department', '')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--purple)', fontSize: 13, lineHeight: 1 }}>×</button>
              </span>
            )}
            {filters.site_id && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: 'var(--cyan-dim)', color: 'var(--cyan)', borderRadius: 4, padding: '0.15rem 0.5rem', fontSize: '0.75rem' }}>
                Site: {sites.find(s => s.id === filters.site_id)?.name || 'Selected'}
                <button onClick={() => handleFilterChange('site_id', '')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cyan)', fontSize: 13, lineHeight: 1 }}>x</button>
              </span>
            )}
            {filters.overdue === 'true' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: 'var(--red-dim)', color: 'var(--red)', borderRadius: 4, padding: '0.15rem 0.5rem', fontSize: '0.75rem' }}>
                Overdue only
                <button onClick={() => handleFilterChange('overdue', '')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 13, lineHeight: 1 }}>×</button>
              </span>
            )}
            {filters.blocked === 'true' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: 'var(--red-dim)', color: 'var(--red)', borderRadius: 4, padding: '0.15rem 0.5rem', fontSize: '0.75rem' }}>
                Blocked only
                <button onClick={() => handleFilterChange('blocked', '')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 13, lineHeight: 1 }}>×</button>
              </span>
            )}
          </div>
        )}

        {/* ── Results ──────────────────────────────────────────────────── */}
        <div className="page-body">
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
              <span className="spinner" style={{ width: 28, height: 28 }}/>
            </div>
          ) : requests.length === 0 ? (
            <div className="empty-state">
              <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
                <rect x="9" y="3" width="6" height="4" rx="1"/>
              </svg>
              <p style={{ marginTop: '0.5rem' }}>
                {hasActiveFilters ? 'No requests match your filters' : 'No requests yet'}
              </p>
              {hasActiveFilters && (
                <button className="btn btn-ghost btn-sm" style={{ marginTop: '0.75rem' }} onClick={clearFilters}>
                  Clear filters
                </button>
              )}
              {canCreateRequest && !hasActiveFilters && (
                <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => navigate('/requests/new')}>
                  Create first request
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="table-container card" style={{ padding: 0 }}>
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Title</th>
                      <th>Status</th>
                      <th>Priority</th>
                      {user?.role !== 'requester' && <th>Requester</th>}
                      {user?.role !== 'requester' && <th>Department</th>}
                      {user?.role !== 'requester' && <th>Site</th>}
                      <th>Due Date</th>
                      {(isProductionTechnician(user?.role) || ['administrator','manager'].includes(user?.role)) && <th>Technician</th>}
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map(r => (
                      <tr
                        key={r.id}
                        className={isOverdue(r) ? 'row-overdue' : ''}
                        style={{ cursor: 'pointer' }}
                        onClick={() => navigate(`/requests/${r.id}`)}
                      >
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--accent)', fontWeight: 600 }}>
                          {r.request_number}
                        </td>
                        <td style={{ maxWidth: 280 }}>
                          <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {/* Highlight matched search term */}
                            {filters.search
                              ? highlightMatch(r.title, filters.search)
                              : r.title
                            }
                          </div>
                          {r.category_name && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                              {r.category_name}
                            </div>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem' }}>
                            <StatusBadge status={r.status}/>
                            {r.status === 'completed' && (r.requester_confirmation || r.reception_confirmed_at) && (
                              <ReceptionConfirmedBadge />
                            )}
                          </div>
                        </td>
                        <td><PriorityBadge priority={r.priority}/></td>
                        {user?.role !== 'requester' && (
                          <td style={{ fontSize: '0.82rem' }}>
                            {filters.search ? highlightMatch(r.requester_name || '—', filters.search) : (r.requester_name || '—')}
                          </td>
                        )}
                        {user?.role !== 'requester' && (
                          <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {r.requester_department || '—'}
                          </td>
                        )}
                        {user?.role !== 'requester' && (
                          <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                            {r.site_name || '—'}
                          </td>
                        )}
                        <td style={{ fontSize: '0.8rem', color: isOverdue(r) ? 'var(--red)' : 'var(--text-secondary)' }}>
                          {(r.approved_due_date || r.requested_due_date) ? (
                            <>
                              {formatDateTime(r.approved_due_date || r.requested_due_date)}
                              {isOverdue(r) && (
                                <span style={{ marginLeft: '0.3rem', fontSize: '0.65rem', color: 'var(--red)', fontWeight: 700 }}>
                                  OVERDUE
                                </span>
                              )}
                            </>
                          ) : '—'}
                        </td>
                        {(isProductionTechnician(user?.role) || ['administrator','manager'].includes(user?.role)) && (
                          <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                            {r.technician_full_name || '—'}
                          </td>
                        )}
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {formatDate(r.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {total > 25 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                  >← Prev</button>
                  <span style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Page {page} of {Math.ceil(total / 25)} ({total} results)
                  </span>
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={page >= Math.ceil(total / 25)}
                    onClick={() => setPage(p => p + 1)}
                  >Next →</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Highlight matched search term in text
function highlightMatch(text, search) {
  if (!text || !search) return text;
  const idx = text.toLowerCase().indexOf(search.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: 'var(--accent-dim)', color: 'var(--accent)', borderRadius: 2, padding: '0 1px' }}>
        {text.slice(idx, idx + search.length)}
      </mark>
      {text.slice(idx + search.length)}
    </>
  );
}
