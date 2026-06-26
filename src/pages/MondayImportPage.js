import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import Sidebar from '../components/common/Sidebar';

const EXPECTED_COLUMNS = [
  ['Title', 'Required request or item name from Monday.com.'],
  ['Status', 'Historical status. Imported records are archived in this application.'],
  ['Priority', 'Critical, High, Normal, Low, or similar Monday.com values.'],
  ['Requester', 'Original requester or owner name.'],
  ['Department', 'Original team, department, or group.'],
  ['Due Date', 'Historical requested delivery date.'],
  ['Quantity', 'Requested quantity when available.'],
  ['Material', 'Historical material preference.'],
  ['Printer', 'Historical printer information for audit context.'],
  ['Technician', 'Historical technician information for audit context.'],
  ['Site', 'Original site, such as SAME or SCEET.'],
];

const emptySummary = {
  totalRows: 0,
  imported: 0,
  skipped: 0,
  errorCount: 0,
  importDate: '',
  importedBy: '',
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString();
};

export default function MondayImportPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [importing, setImporting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  const currentSummary = useMemo(() => summary || emptySummary, [summary]);

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await api.get('/import/monday-history');
      setHistory(res.data || []);
    } catch (err) {
      console.error('Failed to load Monday import history:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setError('');
    setSummary(null);
    try {
      const form = new FormData();
      form.append('csv', file);
      const res = await api.post('/import/monday-csv', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSummary(res.data);
      setFile(null);
      await fetchHistory();
    } catch (err) {
      setError(err.response?.data?.error || 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = async () => {
    setDownloading(true);
    try {
      const res = await api.get('/import/template', { responseType: 'blob' });
      const blob = new Blob([res.data], { type: res.headers['content-type'] || 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'monday-import-template.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Template download failed.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="page">
      <Sidebar />
      <div className="main-content">
        <div className="page-header">
          <div>
            <h1 style={{ fontSize: '1.3rem', fontFamily: 'var(--font-heading)' }}>Monday.com Migration</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
              Import historical Monday.com requests as archive-only records.
            </p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/archive?source=monday')}>
            View Imported Records
          </button>
        </div>

        <div className="page-body">
          <div className="card" style={{ marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Migration Overview</h2>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              Import historical requests exported from Monday.com. Imported records are archived and kept for reporting
              and audit purposes. They do not affect active workflows, stock reservations, planning, notifications, or
              operational KPI calculations.
            </p>
          </div>

          <div className="grid-2" style={{ gap: '1rem', marginBottom: '1rem' }}>
            <div className="card">
              <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>Import File</h3>
              <div className="form-group">
                <label className="form-label">Select CSV File</label>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={e => { setFile(e.target.files?.[0] || null); setError(''); }}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                <button className="btn btn-primary" onClick={handleImport} disabled={!file || importing}>
                  {importing ? 'Importing...' : 'Upload'}
                </button>
                <button className="btn btn-secondary" onClick={downloadTemplate} disabled={downloading}>
                  {downloading ? 'Downloading...' : 'Download Template'}
                </button>
              </div>
              {error && <div className="alert alert-error" style={{ marginTop: '1rem' }}>{error}</div>}
              {summary && (
                <div className="alert alert-success" style={{ marginTop: '1rem' }}>
                  Import completed. {currentSummary.imported} row(s) imported, {currentSummary.skipped} skipped.
                </div>
              )}
            </div>

            <div className="card">
              <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>Import Summary</h3>
              <div className="grid-2" style={{ gap: '0.65rem' }}>
                {[
                  ['Total Rows', currentSummary.totalRows],
                  ['Imported', currentSummary.imported],
                  ['Skipped', currentSummary.skipped],
                  ['Errors', currentSummary.errorCount],
                  ['Imported By', currentSummary.importedBy || '-'],
                  ['Import Date', formatDateTime(currentSummary.importDate)],
                ].map(([label, value]) => (
                  <div key={label} style={{ padding: '0.65rem', background: 'var(--bg-hover)', borderRadius: 6 }}>
                    <div className="kpi-label">{label}</div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', marginTop: '0.2rem' }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid-2" style={{ gap: '1rem', marginBottom: '1rem' }}>
            <div className="card">
              <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>Expected Columns</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                {EXPECTED_COLUMNS.map(([name, description]) => (
                  <div key={name} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '0.75rem', fontSize: '0.78rem' }}>
                    <strong>{name}</strong>
                    <span style={{ color: 'var(--text-secondary)' }}>{description}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>Import Rules</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                <div>Imported records are created with source Monday.com and status Archived.</div>
                <div>They are available in Archive using the Source filter.</div>
                <div>They are excluded from active planning, stock reservations, notifications, and operational KPIs.</div>
                <div>They remain available for historical audit, consultation, and archive export.</div>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '0.9rem' }}>Import History</h3>
            </div>
            {loadingHistory ? (
              <div style={{ padding: '2rem', textAlign: 'center' }}><span className="spinner" /></div>
            ) : history.length === 0 ? (
              <div style={{ padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.84rem' }}>No Monday.com imports yet.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Import Date</th>
                    <th>Imported By</th>
                    <th>File Name</th>
                    <th>Rows Imported</th>
                    <th>Rows Skipped</th>
                    <th>Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(row => (
                    <tr key={row.id}>
                      <td style={{ fontSize: '0.78rem' }}>{formatDateTime(row.created_at)}</td>
                      <td style={{ fontSize: '0.8rem' }}>{row.imported_by_name || '-'}</td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{row.file_name || '-'}</td>
                      <td>{row.imported_count || 0}</td>
                      <td>{row.skipped_count || 0}</td>
                      <td>{row.error_count || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
