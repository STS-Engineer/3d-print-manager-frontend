import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../utils/api';
import Sidebar from '../components/common/Sidebar';
import { useAuth } from '../context/AuthContext';
import { isProductionTechnician } from '../utils/roles';

const alertMeta = {
  ok: { label: 'OK', color: 'var(--green)', bg: 'var(--green-dim)' },
  due_soon: { label: 'Due Soon', color: 'var(--yellow)', bg: 'var(--yellow-dim)' },
  required: { label: 'Maintenance Required', color: 'var(--red)', bg: 'var(--red-dim)' },
};

const fmtDate = (value) => value ? new Date(value).toLocaleDateString('fr-FR') : '-';
const hours = (value) => `${Number(value || 0).toFixed(1)} h`;

function Modal({ title, onClose, children, footer }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 620 }} onClick={event => event.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ fontSize: '1rem' }}>{title}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-footer">{footer}</div>
      </div>
    </div>
  );
}

const AlertBadge = ({ value }) => {
  const meta = alertMeta[value] || alertMeta.ok;
  return (
    <span className="badge" style={{ color: meta.color, background: meta.bg, border: `1px solid ${meta.color}` }}>
      {meta.label}
    </span>
  );
};

export default function MaintenancePage({ view = 'printers' }) {
  const { user } = useAuth();
  const canEdit = isProductionTechnician(user?.role) || user?.role === 'administrator';
  const [overview, setOverview] = useState({ printers: [], summary: {} });
  const [history, setHistory] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [overviewRes, historyRes, usersRes] = await Promise.all([
        api.get('/maintenance/printers'),
        api.get('/maintenance/history'),
        api.get('/users').catch(() => ({ data: [] })),
      ]);
      setOverview(overviewRes.data || { printers: [], summary: {} });
      setHistory(historyRes.data || []);
      setUsers((usersRes.data || []).filter(item => isProductionTechnician(item.role)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const technicians = useMemo(() => users.map(item => ({
    ...item,
    name: `${item.first_name} ${item.last_name}`.trim(),
  })), [users]);

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const openCreate = (printer) => {
    setError('');
    setForm({
      printer_id: printer?.id || '',
      maintenance_type: 'preventive',
      status: 'completed',
      maintenance_date: new Date().toISOString().slice(0, 10),
      downtime_hours: 0,
    });
    setModal({ type: 'create' });
  };

  const openReschedule = (event) => {
    setError('');
    setForm({
      maintenance_date: event.maintenance_date || '',
      next_maintenance_date: '',
      notes: event.notes || '',
    });
    setModal({ type: 'reschedule', event });
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      if (modal.type === 'create') {
        const technician = technicians.find(item => item.id === form.performed_by);
        await api.post('/maintenance/events', {
          ...form,
          performed_by_name: technician?.name || form.performed_by_name,
        });
      } else {
        await api.put(`/maintenance/events/${modal.event.id}/reschedule`, form);
      }
      setModal(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const summary = overview.summary || {};
  const printers = overview.printers || [];

  return (
    <div className="page">
      <Sidebar />
      <div className="main-content">
        <div className="page-header">
          <div>
            <h1 style={{ fontSize: '1.3rem', fontFamily: 'var(--font-heading)' }}>
              {view === 'history' ? 'Maintenance History' : 'Printer Maintenance'}
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
              Preventive maintenance tracking for workshop printers
            </p>
          </div>
          {canEdit && <button className="btn btn-primary btn-sm" onClick={() => openCreate()}>Log Maintenance</button>}
        </div>

        <div className="page-body">
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><span className="spinner" style={{ width: 32, height: 32 }} /></div>
          ) : view === 'history' ? (
            <div className="card table-container" style={{ padding: 0 }}>
              <table>
                <thead>
                  <tr><th>Date</th><th>Printer</th><th>Technician</th><th>Type</th><th>Status</th><th>Downtime</th><th>Notes</th><th></th></tr>
                </thead>
                <tbody>
                  {history.map(event => (
                    <tr key={event.id}>
                      <td>{fmtDate(event.maintenance_date)}</td>
                      <td>{event.printer_name}</td>
                      <td>{event.performed_by_name || '-'}</td>
                      <td>{event.maintenance_type}</td>
                      <td>{event.status}</td>
                      <td>{hours(event.downtime_hours)}</td>
                      <td style={{ color: 'var(--text-secondary)', maxWidth: 320 }}>{event.notes || '-'}</td>
                      <td>{canEdit && <button className="btn btn-ghost btn-sm" onClick={() => openReschedule(event)}>Reschedule</button>}</td>
                    </tr>
                  ))}
                  {history.length === 0 && <tr><td colSpan="8" style={{ color: 'var(--text-muted)' }}>No maintenance history recorded.</td></tr>}
                </tbody>
              </table>
            </div>
          ) : (
            <>
              <div className="grid-4" style={{ marginBottom: '1rem' }}>
                {[
                  ['Total Printers', summary.totalPrinters || 0, 'var(--text-primary)'],
                  ['Printers Due Soon', summary.dueSoon || 0, 'var(--yellow)'],
                  ['Printers Overdue', summary.overdue || 0, 'var(--red)'],
                  ['Maintenance Events', summary.totalMaintenanceEvents || 0, 'var(--green)'],
                ].map(([label, value, color]) => (
                  <div className="card" key={label} style={{ padding: '1rem' }}>
                    <div style={{ color, fontSize: '1.35rem', fontWeight: 800 }}>{value}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                {printers.map(printer => (
                  <div className="card" key={printer.id} style={{ padding: '1rem', borderTop: `3px solid ${(alertMeta[printer.maintenance_alert] || alertMeta.ok).color}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start', marginBottom: '0.9rem' }}>
                      <div>
                        <h3 style={{ color: 'var(--text-primary)', fontSize: '1rem', marginBottom: '0.2rem' }}>{printer.name}</h3>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>{printer.model || '-'} {printer.serial_number ? `| SN ${printer.serial_number}` : ''}</div>
                      </div>
                      <AlertBadge value={printer.maintenance_alert} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                      <span>Site: <strong style={{ color: 'var(--text-primary)' }}>{printer.site_name || printer.location || '-'}</strong></span>
                      <span>Status: <strong style={{ color: 'var(--text-primary)' }}>{printer.status || '-'}</strong></span>
                      <span>Total Runtime: <strong style={{ color: 'var(--text-primary)' }}>{hours(printer.total_runtime_hours)}</strong></span>
                      <span>Print Hours: <strong style={{ color: 'var(--text-primary)' }}>{hours(printer.print_hours)}</strong></span>
                      <span>Completed Jobs: <strong style={{ color: 'var(--text-primary)' }}>{printer.completed_job_count || 0}</strong></span>
                      <span>Runtime Source: <strong style={{ color: 'var(--text-primary)' }}>{printer.cycle_history_jobs || 0} production cycle(s)</strong></span>
                      <span>Last Maintenance: <strong style={{ color: 'var(--text-primary)' }}>{fmtDate(printer.effective_last_maintenance_date)}</strong></span>
                      <span>Next Maintenance: <strong style={{ color: 'var(--text-primary)' }}>{fmtDate(printer.next_maintenance_date)}</strong></span>
                      <span>Interval Hours: <strong style={{ color: 'var(--text-primary)' }}>{hours(printer.maintenance_interval_hours || 0)}</strong></span>
                      <span>Interval Days: <strong style={{ color: 'var(--text-primary)' }}>{printer.maintenance_interval_days || '-'} days</strong></span>
                    </div>
                    <div style={{ marginTop: '0.75rem', color: 'var(--text-muted)', fontSize: '0.74rem', lineHeight: 1.4 }}>
                      Runtime uses the same completed production-cycle print-hours metric as the Performance Dashboard.
                    </div>
                    {canEdit && <button className="btn btn-secondary btn-sm" style={{ marginTop: '1rem' }} onClick={() => openCreate(printer)}>Log Maintenance</button>}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {modal && (
        <Modal
          title={modal.type === 'reschedule' ? 'Reschedule Maintenance' : 'Log Maintenance'}
          onClose={() => setModal(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : null} Save</button>
            </>
          }
        >
          {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}
          <div style={{ display: 'grid', gap: '0.85rem' }}>
            {modal.type === 'create' && (
              <>
                <div className="form-group">
                  <label className="form-label">Printer</label>
                  <select className="form-select" value={form.printer_id || ''} onChange={event => set('printer_id', event.target.value)}>
                    <option value="">Select printer</option>
                    {printers.map(printer => <option key={printer.id} value={printer.id}>{printer.name}</option>)}
                  </select>
                </div>
                <div className="grid-2">
                  <div className="form-group"><label className="form-label">Maintenance Type</label><input className="form-input" value={form.maintenance_type || ''} onChange={event => set('maintenance_type', event.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Status</label>
                    <select className="form-select" value={form.status || 'completed'} onChange={event => set('status', event.target.value)}>
                      <option value="completed">Completed</option>
                      <option value="scheduled">Scheduled</option>
                    </select>
                  </div>
                </div>
                <div className="form-group"><label className="form-label">Technician</label>
                  <select className="form-select" value={form.performed_by || ''} onChange={event => set('performed_by', event.target.value)}>
                    <option value="">Select technician</option>
                    {technicians.map(tech => <option key={tech.id} value={tech.id}>{tech.name}</option>)}
                  </select>
                </div>
              </>
            )}
            <div className="grid-2">
              <div className="form-group"><label className="form-label">Maintenance Date</label><input type="date" className="form-input" value={form.maintenance_date || ''} onChange={event => set('maintenance_date', event.target.value)} /></div>
              <div className="form-group"><label className="form-label">Next Maintenance Date</label><input type="date" className="form-input" value={form.next_maintenance_date || ''} onChange={event => set('next_maintenance_date', event.target.value)} /></div>
            </div>
            {modal.type === 'create' && <div className="form-group"><label className="form-label">Downtime Hours</label><input type="number" min="0" step="0.1" className="form-input" value={form.downtime_hours || 0} onChange={event => set('downtime_hours', event.target.value)} /></div>}
            <div className="form-group"><label className="form-label">Notes</label><textarea className="form-textarea" value={form.notes || ''} onChange={event => set('notes', event.target.value)} /></div>
          </div>
        </Modal>
      )}
    </div>
  );
}
