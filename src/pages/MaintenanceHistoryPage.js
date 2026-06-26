import React, { useCallback, useEffect, useState } from 'react';
import api from '../utils/api';
import Sidebar from '../components/common/Sidebar';
import { useAuth } from '../context/AuthContext';
import { isProductionTechnician } from '../utils/roles';

const fmtDate = (value) => value ? new Date(value).toLocaleDateString('fr-FR') : '-';
const hours = (value) => `${Number(value || 0).toFixed(1)} h`;

export default function MaintenanceHistoryPage() {
  const { user } = useAuth();
  const canEdit = isProductionTechnician(user?.role) || user?.role === 'administrator';
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/maintenance/history');
      setHistory(res.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  return (
    <div className="page">
      <Sidebar />
      <div className="main-content">
        <div className="page-header">
          <div>
            <h1 style={{ fontSize: '1.3rem', fontFamily: 'var(--font-heading)' }}>
              Maintenance History
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
              Read-only maintenance event history for workshop printers
            </p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={loadHistory}>Refresh</button>
        </div>

        <div className="page-body">
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
              <span className="spinner" style={{ width: 32, height: 32 }} />
            </div>
          ) : (
            <div className="card table-container" style={{ padding: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Printer</th>
                    <th>Technician</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Downtime</th>
                    <th>Notes</th>
                    {canEdit && <th>Access</th>}
                  </tr>
                </thead>
                <tbody>
                  {history.map(event => (
                    <tr key={event.id}>
                      <td>{fmtDate(event.maintenance_date)}</td>
                      <td>
                        <div style={{ fontWeight: 700 }}>{event.printer_name}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                          {event.model || '-'} {event.serial_number ? `| SN ${event.serial_number}` : ''}
                        </div>
                      </td>
                      <td>{event.performed_by_name || '-'}</td>
                      <td>{event.maintenance_type || '-'}</td>
                      <td>{event.status || '-'}</td>
                      <td>{hours(event.downtime_hours)}</td>
                      <td style={{ color: 'var(--text-secondary)', maxWidth: 360 }}>{event.notes || '-'}</td>
                      {canEdit && <td style={{ color: 'var(--text-muted)' }}>Read-only view</td>}
                    </tr>
                  ))}
                  {history.length === 0 && (
                    <tr>
                      <td colSpan={canEdit ? 8 : 7} style={{ color: 'var(--text-muted)' }}>
                        No maintenance history recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
