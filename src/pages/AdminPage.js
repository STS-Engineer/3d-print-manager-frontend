import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import Sidebar from '../components/common/Sidebar';

const ROLE_LABELS = { requester: 'Requester', production_technician: 'Production Technician', manager: 'Manager', administrator: 'Administrator' };
const ROLE_COLORS = { requester: 'var(--blue)', production_technician: 'var(--green)', manager: 'var(--purple)', administrator: 'var(--red)' };

function Modal({ title, onClose, children, footer, maxWidth = 520 }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ fontSize: '1rem', fontFamily: 'var(--font-heading)' }}>{title}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [printers, setPrinters] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [categories, setCategories] = useState([]);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // { type: 'user'|'printer'|'material'|'category'|'site', data?: {} }
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteConflict, setDeleteConflict] = useState(null);
  const [deleteErrorModal, setDeleteErrorModal] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [u, p, m, c, s] = await Promise.all([
        api.get('/users'), api.get('/maintenance/printers'), api.get('/materials'), api.get('/categories?includeInactive=true'), api.get('/sites'),
      ]);
      setUsers(u.data); setPrinters(p.data?.printers || []); setMaterials(m.data); setCategories(c.data);
      setSites(s.data);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openCreate = (type) => { setForm({}); setError(''); setDeleteConflict(null); setDeleteErrorModal(null); setModal({ type }); };
  const openEdit = (type, data) => { setForm({ ...data }); setError(''); setDeleteConflict(null); setDeleteErrorModal(null); setModal({ type, edit: true, id: data.id }); };
  const openDelete = (subtype, data) => {
    if (!window.confirm(`Delete "${data.name || data.first_name + ' ' + data.last_name}"? This cannot be undone.`)) return;
    setForm(data); setError(''); setDeleteConflict(null); setDeleteErrorModal(null);
    setModal({ type: 'delete', subtype, id: data.id, edit: true });
    // Immediately trigger save
    setTimeout(() => document.getElementById('modal-save-btn')?.click(), 50);
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      const { type, edit, id } = modal;
      if (type === 'user') {
        if (edit) await api.put(`/users/${id}`, form);
        else await api.post('/users', form);
      } else if (type === 'printer') {
        if (edit) await api.put(`/printers/${id}`, form);
        else await api.post('/printers', form);
      } else if (type === 'material') {
        if (edit) await api.put(`/materials/${id}`, form);
        else await api.post('/materials', form);
      } else if (type === 'category') {
        if (edit) await api.put(`/categories/${id}`, form);
        else await api.post('/categories', form);
      } else if (type === 'site') {
        if (edit) await api.put(`/sites/${id}`, form);
        else await api.post('/sites', form);
      } else if (type === 'delete') {
        const endpointMap = { user: 'users', printer: 'printers', material: 'materials', category: 'categories', site: 'sites' };
        await api.delete(`/${endpointMap[modal.subtype]}/${id}`);
      }
      setModal(null);
      await fetchAll();
    } catch (err) {
      if (modal?.type === 'delete' && modal?.subtype === 'user' && err.response?.status === 409) {
        setDeleteErrorModal(err.response?.data?.error || 'Delete failed');
        setDeleteConflict(null);
        setError('');
        setModal(null);
      } else if (modal?.type === 'delete' && modal?.subtype === 'category' && err.response?.status === 409) {
        setDeleteConflict(err.response.data);
        setDeleteErrorModal(null);
        setError(err.response?.data?.error || 'Save failed');
      } else {
        setDeleteConflict(null);
        setDeleteErrorModal(null);
        setError(err.response?.data?.error || 'Save failed');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDisableCategory = async () => {
    setSaving(true); setError('');
    try {
      await api.put(`/categories/${modal.id}`, { is_active: false });
      setModal(null);
      setDeleteConflict(null);
      await fetchAll();
    } catch (err) {
      setError(err.response?.data?.error || 'Disable failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="page"><Sidebar/>
      <div className="main-content" style={{ display:'flex', alignItems:'center', justifyContent:'center' }}>
        <span className="spinner" style={{ width: 32, height: 32 }}/>
      </div>
    </div>
  );

  return (
    <div className="page">
      <Sidebar />
      <div className="main-content">
        <div className="page-header">
          <div>
            <h1 style={{ fontSize: '1.3rem', fontFamily: 'var(--font-heading)' }}>Administration</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
              Manage users, printers, materials, categories, and sites
            </p>
          </div>
        </div>

        <div className="page-body">
          <div className="tabs">
            {[['users', `Users (${users.length})`], ['printers', `Printers (${printers.length})`], ['materials', `Materials (${materials.length})`], ['categories', `Categories (${categories.length})`], ['sites', `Sites (${sites.length})`]].map(([t, label]) => (
              <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{label}</button>
            ))}
          </div>

          {/* USERS */}
          {tab === 'users' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                <button className="btn btn-primary btn-sm" onClick={() => openCreate('user')}>+ Add User</button>
              </div>
              <div className="card" style={{ padding: 0 }}>
                <table>
                  <thead><tr><th>Name</th><th>Email</th><th>Department</th><th>Role</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id}>
                        <td style={{ fontWeight: 500 }}>{u.first_name} {u.last_name}</td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{u.email}</td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{u.department || '—'}</td>
                        <td>
                          <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: 4, background: `${ROLE_COLORS[u.role]}22`, color: ROLE_COLORS[u.role], textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            {ROLE_LABELS[u.role] || u.role}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.72rem', color: u.is_active ? 'var(--green)' : 'var(--red)' }}>
                            {u.is_active ? '● Active' : '● Inactive'}
                          </span>
                        </td>
                        <td style={{ display: 'flex', gap: '0.4rem' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit('user', u)}>Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => openDelete('user', {...u, name: u.first_name + ' ' + u.last_name})}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* PRINTERS */}
          {tab === 'printers' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                <button className="btn btn-primary btn-sm" onClick={() => openCreate('printer')}>+ Add Printer</button>
              </div>
              <div className="card" style={{ padding: 0 }}>
                <table>
                  <thead><tr><th>Name</th><th>Serial</th><th>Model</th><th>Technology</th><th>Cost / Min</th><th>Site</th><th>Runtime</th><th>Next Maintenance</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    {printers.map(p => (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 500 }}>{p.name}</td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{p.serial_number || '-'}</td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{p.model || '-'}</td>
                        <td><span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: 4, background: 'var(--blue-dim)', color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{p.technology || '-'}</span></td>
                        <td style={{ fontSize: '0.8rem', fontWeight: 700 }}>{Number(p.cost_per_minute || 0).toFixed(3)} EUR/min</td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{p.location || '-'}</td>
                        <td
                          style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}
                          title={`Runtime Source: Dashboard print-hours metric (${p.cycle_history_jobs || 0} production cycle(s))`}
                        >
                          {Number(p.total_runtime_hours ?? p.print_hours ?? 0).toFixed(1)} h
                        </td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{p.next_maintenance_date ? new Date(p.next_maintenance_date).toLocaleDateString('fr-FR') : '-'}</td>
                        <td><span style={{ fontSize: '0.72rem', color: p.status === 'available' ? 'var(--green)' : p.status === 'maintenance' ? 'var(--yellow)' : 'var(--red)' }}>{p.status}</span></td>
                        <td style={{ display: 'flex', gap: '0.4rem' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit('printer', p)}>Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => openDelete('printer', p)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* MATERIALS */}
          {tab === 'materials' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                <button className="btn btn-primary btn-sm" onClick={() => openCreate('material')}>+ Add Material</button>
              </div>
              <div className="card" style={{ padding: 0 }}>
                <table>
                  <thead><tr><th>Name</th><th>Type</th><th>Color</th><th>Brand</th><th>Stock</th><th>Minimum Threshold</th><th>Density</th><th>Cost Per Unit</th><th></th></tr></thead>
                  <tbody>
                    {materials.map(m => (
                      <tr key={m.id}>
                        <td style={{ fontWeight: 500 }}>{m.name}</td>
                        <td><span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: 4, background: 'var(--cyan-dim)', color: 'var(--cyan)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{m.type || '-'}</span></td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{m.color || '-'}</td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{m.brand || '-'}</td>
                        <td style={{ fontWeight: 600, color: m.stock_quantity < 200 ? 'var(--red)' : m.stock_quantity < 500 ? 'var(--yellow)' : 'var(--green)' }}>{m.stock_quantity} {m.unit}</td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{m.low_stock_threshold || 200} {m.unit}</td>
                        <td style={{ fontSize: '0.8rem', fontWeight: 700 }}>{m.density_g_cm3 ? `${Number(m.density_g_cm3).toFixed(3)} g/cm3` : '-'}</td>
                        <td style={{ fontSize: '0.8rem', fontWeight: 700 }}>{Number(m.cost_per_unit || 0).toFixed(3)} {m.currency || 'EUR'}/{m.unit}</td>
                        <td style={{ display: 'flex', gap: '0.4rem' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit('material', m)}>Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => openDelete('material', m)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {/* CATEGORIES */}
          {tab === 'categories' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                <button className="btn btn-primary btn-sm" onClick={() => openCreate('category')}>+ Add Category</button>
              </div>
              <div className="card" style={{ padding: 0 }}>
                <table>
                  <thead><tr><th>Name</th><th>Description</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    {categories.map(c => (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 500 }}>{c.name}</td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{c.description || '—'}</td>
                        <td>
                          <span style={{ fontSize: '0.72rem', color: c.is_active ? 'var(--green)' : 'var(--red)' }}>
                            {c.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td style={{ display: 'flex', gap: '0.4rem' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit('category', c)}>Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => openDelete('category', c)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SITES */}
          {tab === 'sites' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                <button className="btn btn-primary btn-sm" onClick={() => openCreate('site')}>+ Add Site</button>
              </div>
              <div className="card" style={{ padding: 0 }}>
                <table>
                  <thead><tr><th>Name</th><th>Description</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    {sites.map(s => (
                      <tr key={s.id}>
                        <td style={{ fontWeight: 500 }}>{s.name}</td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{s.description || '—'}</td>
                        <td><span style={{ fontSize: '0.72rem', color: 'var(--green)' }}>Active</span></td>
                        <td style={{ display: 'flex', gap: '0.4rem' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit('site', s)}>Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => openDelete('site', s)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {deleteErrorModal && (
        <Modal
          title="User cannot be deleted"
          onClose={() => setDeleteErrorModal(null)}
          maxWidth={760}
          footer={
            <button className="btn btn-primary" onClick={() => setDeleteErrorModal(null)}>
              Close
            </button>
          }
        >
          <div
            className="alert alert-error"
            style={{
              marginBottom: 0,
              maxHeight: '65vh',
              overflowY: 'auto',
            }}
          >
            <pre
              style={{
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontFamily: 'inherit',
                fontSize: '0.9rem',
                lineHeight: 1.6,
                color: 'inherit',
              }}
            >{deleteErrorModal}</pre>
          </div>
        </Modal>
      )}

      {/* Modal */}
      {modal && (
        <Modal
          title={modal.type === 'delete'
            ? `Delete ${modal.subtype.charAt(0).toUpperCase() + modal.subtype.slice(1)}`
            : `${modal.edit ? 'Edit' : 'Add'} ${modal.type.charAt(0).toUpperCase() + modal.type.slice(1)}`
          }
          onClose={() => setModal(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              {deleteConflict?.canDisable && (
                <button className="btn btn-secondary" onClick={handleDisableCategory} disabled={saving}>
                  Disable Category
                </button>
              )}
              <button id="modal-save-btn" className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <span className="spinner" style={{ width: 14, height: 14 }}/> : null}
                {modal.type === 'delete' ? 'Delete' : 'Save'}
              </button>
            </>
          }
        >
          {error && <div className="alert alert-error" style={{ marginBottom: '1rem', whiteSpace: 'pre-line' }}>{error}</div>}

          {modal.type === 'user' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div className="grid-2">
                <div className="form-group"><label className="form-label">First Name *</label><input className="form-input" value={form.first_name || ''} onChange={e => set('first_name', e.target.value)}/></div>
                <div className="form-group"><label className="form-label">Last Name *</label><input className="form-input" value={form.last_name || ''} onChange={e => set('last_name', e.target.value)}/></div>
              </div>
              <div className="form-group"><label className="form-label">Email *</label><input type="email" className="form-input" value={form.email || ''} onChange={e => set('email', e.target.value)} disabled={modal.edit}/></div>
              {!modal.edit && <div className="form-group"><label className="form-label">Password</label><input type="password" className="form-input" value={form.password || ''} onChange={e => set('password', e.target.value)} placeholder="Default: ChangeMe123!"/></div>}
              <div className="form-group"><label className="form-label">Department</label><input className="form-input" value={form.department || ''} onChange={e => set('department', e.target.value)}/></div>
              <div className="form-group"><label className="form-label">Role *</label>
                <select className="form-select" value={form.role || 'requester'} onChange={e => set('role', e.target.value)}>
                  {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              {modal.edit && (
                <>
                  <div className="form-group"><label className="form-label">Status</label>
                    <select className="form-select" value={form.is_active ? 'true' : 'false'} onChange={e => set('is_active', e.target.value === 'true')}>
                      <option value="true">Active</option><option value="false">Inactive</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Reset Password (Admin) <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>— leave empty to keep current</span></label>
                    <input type="password" className="form-input" value={form.new_password || ''}
                      onChange={e => set('new_password', e.target.value)}
                      placeholder="New password (min. 8 characters)"/>
                  </div>
                </>
              )}
            </div>
          )}

          {modal.type === 'printer' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div className="form-group"><label className="form-label">Name *</label><input className="form-input" value={form.name || ''} onChange={e => set('name', e.target.value)}/></div>
              <div className="grid-2">
                <div className="form-group"><label className="form-label">Serial Number</label><input className="form-input" value={form.serial_number || ''} onChange={e => set('serial_number', e.target.value)}/></div>
                <div className="form-group"><label className="form-label">Model</label><input className="form-input" value={form.model || ''} onChange={e => set('model', e.target.value)}/></div>
              </div>
              <div className="grid-2">
                <div className="form-group"><label className="form-label">Technology</label>
                  <select className="form-select" value={form.technology || ''} onChange={e => set('technology', e.target.value)}>
                    <option value="">Select…</option>
                    {['FDM','SLA','SLS','MSLA','DLP','MJF'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group"><label className="form-label">Site</label>
                  <select className="form-select" value={form.site_id || ''} onChange={e => set('site_id', e.target.value)}>
                    <option value="">Select site</option>
                    {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group"><label className="form-label">Location</label><input className="form-input" value={form.location || ''} onChange={e => set('location', e.target.value)}/></div>
              <div className="form-group"><label className="form-label">Status</label>
                <select className="form-select" value={form.status || 'available'} onChange={e => set('status', e.target.value)}>
                  {['available','busy','maintenance','offline'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="grid-2">
                <div className="form-group"><label className="form-label">Total Operating Hours</label><input type="number" min="0" step="0.1" className="form-input" value={form.total_operating_hours || 0} onChange={e => set('total_operating_hours', e.target.value)}/></div>
                <div className="form-group"><label className="form-label">Maintenance Interval Hours</label><input type="number" min="0" step="1" className="form-input" value={form.maintenance_interval_hours || 500} onChange={e => set('maintenance_interval_hours', e.target.value)}/></div>
              </div>
              <div className="grid-2">
                <div className="form-group"><label className="form-label">Last Maintenance Date</label><input type="date" className="form-input" value={form.last_maintenance_date ? String(form.last_maintenance_date).slice(0, 10) : ''} onChange={e => set('last_maintenance_date', e.target.value)}/></div>
                <div className="form-group"><label className="form-label">Next Maintenance Date</label><input type="date" className="form-input" value={form.next_maintenance_date ? String(form.next_maintenance_date).slice(0, 10) : ''} onChange={e => set('next_maintenance_date', e.target.value)}/></div>
              </div>
              <div className="form-group"><label className="form-label">Maintenance Interval Days</label><input type="number" min="0" step="1" className="form-input" value={form.maintenance_interval_days || 90} onChange={e => set('maintenance_interval_days', e.target.value)}/></div>
              <div className="form-group"><label className="form-label">Cost Per Minute (EUR/min)</label><input type="number" min="0.000001" step="0.001" className="form-input" value={form.cost_per_minute ?? 0.05} onChange={e => set('cost_per_minute', e.target.value)}/></div>
              <div className="grid-2">
                <div className="form-group"><label className="form-label">Print Speed (mm/s)</label><input type="number" min="0.000001" step="0.1" className="form-input" value={form.print_speed ?? ''} onChange={e => set('print_speed', e.target.value)} placeholder="e.g. 60"/></div>
                <div className="form-group"><label className="form-label">Setup Factor</label><input type="number" min="0.000001" step="0.01" className="form-input" value={form.setup_factor ?? ''} onChange={e => set('setup_factor', e.target.value)} placeholder="e.g. 1.15"/></div>
              </div>
              <div className="form-group"><label className="form-label">Efficiency Factor</label><input type="number" min="0.000001" step="0.01" className="form-input" value={form.efficiency_factor ?? ''} onChange={e => set('efficiency_factor', e.target.value)} placeholder="e.g. 0.85"/></div>
              <div className="form-group"><label className="form-label">Notes</label><textarea className="form-textarea" value={form.notes || ''} onChange={e => set('notes', e.target.value)} style={{ minHeight: 60 }}/></div>
            </div>
          )}

          {modal.type === 'material' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div className="form-group"><label className="form-label">Name *</label><input className="form-input" value={form.name || ''} onChange={e => set('name', e.target.value)}/></div>
              <div className="grid-2">
                <div className="form-group"><label className="form-label">Type</label>
                  <select className="form-select" value={form.type || ''} onChange={e => set('type', e.target.value)}>
                    <option value="">Select…</option>
                    {['PLA','PETG','ABS','ASA','TPU','Nylon','Resin','PEEK','PC','PVA'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group"><label className="form-label">Color</label><input className="form-input" value={form.color || ''} onChange={e => set('color', e.target.value)}/></div>
              </div>
              <div className="form-group"><label className="form-label">Brand</label><input className="form-input" value={form.brand || ''} onChange={e => set('brand', e.target.value)}/></div>
              <div className="grid-2">
                <div className="form-group"><label className="form-label">Stock Quantity</label><input type="number" min="0" className="form-input" value={form.stock_quantity || 0} onChange={e => set('stock_quantity', e.target.value)}/></div>
                <div className="form-group"><label className="form-label">Unit</label>
                  <select className="form-select" value={form.unit || 'g'} onChange={e => set('unit', e.target.value)}>
                    <option value="g">grams (g)</option><option value="kg">kilograms (kg)</option><option value="ml">milliliters (ml)</option><option value="l">liters (l)</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Minimum Stock Threshold</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  className="form-input"
                  value={form.low_stock_threshold ?? 200}
                  onChange={e => set('low_stock_threshold', e.target.value)}
                />
              </div>
              <div className="grid-2">
                <div className="form-group"><label className="form-label">Cost Per Unit</label><input type="number" min="0.000001" step="0.001" className="form-input" value={form.cost_per_unit ?? 0.025} onChange={e => set('cost_per_unit', e.target.value)}/></div>
                <div className="form-group"><label className="form-label">Density (g/cm3)</label><input type="number" min="0.000001" step="0.001" className="form-input" value={form.density_g_cm3 ?? ''} onChange={e => set('density_g_cm3', e.target.value)} placeholder="e.g. 1.24"/></div>
              </div>
              <div className="grid-2">
                <div className="form-group"><label className="form-label">Currency</label>
                  <select className="form-select" value={form.currency || 'EUR'} onChange={e => set('currency', e.target.value)}>
                    {['EUR','USD','GBP','MAD'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {modal.type === 'category' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div className="form-group"><label className="form-label">Name *</label><input className="form-input" value={form.name || ''} onChange={e => set('name', e.target.value)}/></div>
              <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" value={form.description || ''} onChange={e => set('description', e.target.value)}/></div>
              <div className="form-group"><label className="form-label">Status</label>
                <select className="form-select" value={form.is_active === false ? 'false' : 'true'} onChange={e => set('is_active', e.target.value === 'true')}>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
            </div>
          )}

          {modal.type === 'site' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div className="form-group"><label className="form-label">Name *</label><input className="form-input" value={form.name || ''} onChange={e => set('name', e.target.value)} placeholder="SAME"/></div>
              <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" value={form.description || ''} onChange={e => set('description', e.target.value)} style={{ minHeight: 70 }}/></div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

