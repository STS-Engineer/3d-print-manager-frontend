import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../utils/api';
import Sidebar from '../components/common/Sidebar';
import { DateTimePicker } from '../components/common/DatePicker';

const helperStyle = {
  color: 'var(--text-muted)',
  fontSize: '0.72rem',
  lineHeight: 1.45,
};

const Section = ({ number, title, description, children }) => (
  <section className="card" style={{ marginBottom: '1rem' }}>
    <div style={{ marginBottom: '1rem' }}>
      <h3 style={{ fontSize: '0.82rem', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.25rem' }}>
        {number ? `${number}. ` : ''}{title}
      </h3>
      {description && <p style={helperStyle}>{description}</p>}
    </div>
    {children}
  </section>
);

const Field = ({ label, required, children, span = 1, help }) => (
  <div className="form-group" style={{ gridColumn: span > 1 ? `span ${span}` : undefined, minWidth: 0 }}>
    <label className="form-label" title={help || label}>
      {label}{required && <span style={{ color: 'var(--accent)', marginLeft: '0.2rem' }}>*</span>}
    </label>
    {children}
    {help && <span style={helperStyle}>{help}</span>}
  </div>
);

const fileName = (file) => file?.name || file?.original_name || file?.filename || '';
const fileType = (file) => String(file?.file_type || fileName(file).split('.').pop() || '').toLowerCase();
const isStlFile = (file) => fileType(file) === 'stl' || fileName(file).toLowerCase().endsWith('.stl');
const isDev = process.env.NODE_ENV === 'development';

const nullableRequestFields = new Set([
  'category_id',
  'requested_due_date',
]);

const buildRequestPayload = (form) => Object.fromEntries(
  Object.entries(form).map(([key, value]) => [
    key,
    nullableRequestFields.has(key) && value === '' ? null : value,
  ])
);

const formatApiError = (err) => {
  const stageLabel = err.stage ? `${err.stage}: ` : '';
  const data = err.response?.data;
  if (data?.error) {
    const prefix = data.validation_type ? 'Validation Error' : 'Save Error';
    return `${prefix}: ${stageLabel}${data.error}`;
  }
  if (data?.message) return `Save Error: ${stageLabel}${data.message}`;
  if (err.code === 'ECONNABORTED' || /timeout/i.test(err.message || '')) {
    return `Save Error: ${stageLabel}The request timed out after ${Math.round((err.config?.timeout || 0) / 1000)} seconds.`;
  }
  if (err.message) return `Save Error: ${stageLabel}${err.message}`;
  return 'Save failed';
};

const logDev = (...args) => {
  if (isDev) console.log(...args);
};

const runStep = async (stage, fn) => {
  const startedAt = performance.now();
  try {
    const result = await fn();
    logDev(`[RequestForm] ${stage} completed`, { durationMs: Math.round(performance.now() - startedAt) });
    return result;
  } catch (err) {
    err.stage = stage;
    logDev(`[RequestForm] ${stage} failed`, {
      durationMs: Math.round(performance.now() - startedAt),
      status: err.response?.status,
      response: err.response?.data,
      message: err.message,
      timeout: err.config?.timeout,
    });
    throw err;
  }
};

export default function RequestFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [files, setFiles] = useState([]);
  const [existingFiles, setExistingFiles] = useState([]);
  const [requestStatus, setRequestStatus] = useState('draft');

  const [form, setForm] = useState({
    title: '',
    purpose: '',
    part_description: '',
    quantity: 1,
    functional_requirement: '',
    visual_requirement: '',
    category_id: '',
    criticality: 'normal',
    use_environment: '',
    surface_finish: '',
    strength_requirement: '',
    color_preference: '',
    priority: 'normal',
    priority_reason: '',
    requested_due_date: '',
    project_reference: '',
    customer_reference: '',
    site_id: '',
  });

  useEffect(() => {
    api.get('/categories').then(r => setCategories(r.data));
    api.get('/sites').then(r => {
      setSites(r.data);
      if (!isEdit && r.data.length === 1) setForm(f => ({ ...f, site_id: r.data[0].id }));
    });

    if (isEdit) {
      setLoading(true);
      api.get(`/requests/${id}`).then(r => {
        const d = r.data;
        setRequestStatus(d.status || 'draft');
        setForm({
          title: d.title || '',
          purpose: d.purpose || '',
          part_description: d.part_description || '',
          quantity: d.quantity || 1,
          functional_requirement: d.functional_requirement || '',
          visual_requirement: d.visual_requirement || '',
          category_id: d.category_id || '',
          criticality: d.criticality || 'normal',
          use_environment: d.use_environment || '',
          surface_finish: d.surface_finish || '',
          strength_requirement: d.strength_requirement || '',
          color_preference: d.color_preference || '',
          priority: d.priority || 'normal',
          priority_reason: d.priority_reason || '',
          requested_due_date: d.requested_due_date ? String(d.requested_due_date).slice(0, 16) : '',
          project_reference: d.project_reference || '',
          customer_reference: d.customer_reference || '',
          site_id: d.site_id || '',
        });
        setExistingFiles(d.attachments || []);
        setLoading(false);
      });
    }
  }, [id, isEdit]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));
  const hasStlFiles = files.some(isStlFile) || existingFiles.some(isStlFile);

  const validateForm = () => {
    if (!form.title.trim()) return 'Title is required';
    if (!form.site_id) return 'Site is required';
    if (!Number.isFinite(Number(form.quantity)) || Number(form.quantity) <= 0) {
      return 'Quantity must be greater than zero.';
    }
    if (!hasStlFiles) return 'At least one STL file is required.';
    return '';
  };

  const handleSubmit = async (action) => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError('');
    try {
      let requestId = id;
      const payload = buildRequestPayload(form);
      logDev('[RequestForm] Save payload', { action, isEdit, payload });

      if (isEdit) {
        const updateResponse = await runStep('Draft save', () => api.put(`/requests/${id}`, payload));
        logDev('[RequestForm] Update response', updateResponse.data);
      } else {
        const res = await runStep('Draft create', () => api.post('/requests', payload));
        requestId = res.data.id;
        logDev('[RequestForm] Create response', res.data);
      }

      if (files.length > 0) {
        const fd = new FormData();
        files.forEach(f => fd.append('files', f));
        logDev('[RequestForm] Upload payload', {
          requestId,
          files: files.map(f => ({ name: f.name, size: f.size, type: f.type })),
        });
        const uploadResponse = await runStep('STL upload', () => api.post(`/requests/${requestId}/files`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 300000,
        }));
        logDev('[RequestForm] Upload response', uploadResponse.data);
      }

      if (action === 'submit' || action === 'resubmit') {
        const comment = action === 'resubmit'
          ? 'Request updated and resubmitted after information correction'
          : 'Request submitted by requester';
        const statusPayload = { status: 'submitted', comment };
        logDev('[RequestForm] Status payload', { requestId, payload: statusPayload });
        const statusResponse = await runStep('Submit request', () => api.patch(`/requests/${requestId}/status`, statusPayload));
        logDev('[RequestForm] Status response', statusResponse.data);
      }

      navigate(`/requests/${requestId}`);
    } catch (err) {
      logDev('[RequestForm] Save failed', {
        status: err.response?.status,
        response: err.response?.data,
        message: err.message,
      });
      setError(formatApiError(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="page"><Sidebar />
      <div className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    </div>
  );

  return (
    <div className="page">
      <Sidebar />
      <div className="main-content">
        <div className="page-header">
          <div>
            <h1 style={{ fontSize: '1.3rem', fontFamily: 'var(--font-heading)' }}>
              {isEdit ? 'Edit Request' : 'New 3D Print Request'}
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
              Fill in the required information about your 3D printing need
            </p>
          </div>
          <button className="btn btn-ghost" onClick={() => navigate(-1)}>Cancel</button>
        </div>

        <div className="page-body" style={{ maxWidth: 960 }}>
          {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

          <Section number="1" title="Request Identification">
            <div className="grid-2">
              <Field label="Title" required span={2} help="Use a clear name that planning and production can recognize quickly.">
                <input className="form-input" value={form.title} onChange={e => set('title', e.target.value)} placeholder="Descriptive title of the part or need" />
              </Field>
              <Field label="Project / Reference">
                <input className="form-input" value={form.project_reference} onChange={e => set('project_reference', e.target.value)} placeholder="Project code or name" />
              </Field>
              <Field label="Customer Reference">
                <input className="form-input" value={form.customer_reference} onChange={e => set('customer_reference', e.target.value)} placeholder="Customer or order reference" />
              </Field>
              <Field label="Site" required>
                <select className="form-select" value={form.site_id} onChange={e => set('site_id', e.target.value)}>
                  <option value="">Select site</option>
                  {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
              <Field label="Category">
                <select className="form-select" value={form.category_id} onChange={e => set('category_id', e.target.value)}>
                  <option value="">Select category</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Quantity" required>
                <input type="number" min="1" className="form-input" value={form.quantity} onChange={e => set('quantity', e.target.value)} />
              </Field>
              <Field label="Criticality">
                <select className="form-select" value={form.criticality} onChange={e => set('criticality', e.target.value)}>
                  <option value="low">Low - Cosmetic / non-functional</option>
                  <option value="normal">Normal - Standard functional part</option>
                  <option value="high">High - Production-critical</option>
                  <option value="urgent">Urgent - Line stoppage risk</option>
                </select>
              </Field>
            </div>
          </Section>

          <Section number="2" title="Part Requirements" description="Describe what the part must do and where it will be used.">
            <div className="grid-2">
              <Field label="Purpose" span={2} help="Why is this part needed? What problem does it solve?">
                <textarea className="form-textarea" value={form.purpose} onChange={e => set('purpose', e.target.value)} placeholder="Replacement part, prototype validation, fixture, tooling aid..." />
              </Field>
              <Field label="Part Description" span={2}>
                <textarea className="form-textarea" value={form.part_description} onChange={e => set('part_description', e.target.value)} placeholder="Describe the part: shape, features, assembly context..." />
              </Field>
              <Field label="Functional Requirements" span={2} help="Mention load, fit, assembly, temperature, chemicals, or moving interfaces.">
                <textarea className="form-textarea" value={form.functional_requirement} onChange={e => set('functional_requirement', e.target.value)} placeholder="Load bearing, snap-fit, heat resistance, chemical exposure..." />
              </Field>
              <Field label="Strength Requirement">
                <input className="form-input" value={form.strength_requirement} onChange={e => set('strength_requirement', e.target.value)} placeholder="Structural, light-duty, display only..." />
              </Field>
              <Field label="Expected Use Environment">
                <input className="form-input" value={form.use_environment} onChange={e => set('use_environment', e.target.value)} placeholder="Indoor, UV exposure, high temperature..." />
              </Field>
            </div>
          </Section>

          <Section number="3" title="Visual Requirements">
            <div className="grid-2">
              <Field label="Surface Finish">
                <input className="form-input" value={form.surface_finish} onChange={e => set('surface_finish', e.target.value)} placeholder="As-printed, sanded, painted..." />
              </Field>
              <Field label="Color Preference">
                <input className="form-input" value={form.color_preference} onChange={e => set('color_preference', e.target.value)} placeholder="Black, RAL 7016, match drawing..." />
              </Field>
              <Field label="Visual / Aesthetic Requirements" span={2}>
                <textarea className="form-textarea" value={form.visual_requirement} onChange={e => set('visual_requirement', e.target.value)} placeholder="Appearance, surface quality, visible faces, color matching..." style={{ minHeight: 70 }} />
              </Field>
            </div>
          </Section>

          <Section number="4" title="Attachments" description="Supported: STL, STEP, OBJ, 3MF, DWG, DXF, PDF, PNG, JPG. At least one STL file is required.">
            <div style={{ marginBottom: '1rem' }}>
              <input
                type="file"
                multiple
                accept=".stl,.step,.stp,.obj,.3mf,.dwg,.dxf,.pdf,.png,.jpg,.jpeg"
                onChange={e => {
                  const newFiles = Array.from(e.target.files);
                  setFiles(prev => {
                    const existing = new Set(prev.map(f => f.name + f.size));
                    const added = newFiles.filter(f => !existing.has(f.name + f.size));
                    return [...prev, ...added];
                  });
                  e.target.value = '';
                }}
                style={{ display: 'none' }}
                id="file-input"
              />
              <label htmlFor="file-input" className="btn btn-secondary" style={{ cursor: 'pointer' }} title="Attach STL, STEP, OBJ, 3MF, DWG, DXF, PDF, PNG, or JPG files">
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                </svg>
                Choose files
              </label>
              {!hasStlFiles && (
                <p style={{ ...helperStyle, color: 'var(--red)', marginTop: '0.65rem' }}>
                  Add at least one STL file before saving this request.
                </p>
              )}
              {files.length > 0 && (
                <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    {files.length} file{files.length !== 1 ? 's' : ''} selected
                  </p>
                  {files.map((f, i) => (
                    <div key={`${f.name}-${f.size}-${i}`} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.6rem', background: 'var(--bg-hover)', borderRadius: 6 }}>
                      <span style={{ color: isStlFile(f) ? 'var(--green)' : 'var(--text-muted)', fontWeight: 700 }}>
                        {isStlFile(f) ? 'STL' : 'File'}
                      </span>
                      <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{f.name}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>({(f.size / 1024 / 1024).toFixed(1)} MB)</span>
                      <button
                        type="button"
                        onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 16, lineHeight: 1, padding: '0 2px' }}
                        title="Remove file"
                      >x</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {existingFiles.length > 0 && (
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Existing files</p>
                {existingFiles.map(f => (
                  <div key={f.id} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                    <span style={{ color: isStlFile(f) ? 'var(--green)' : 'var(--blue)', fontWeight: 700 }}>
                      {isStlFile(f) ? 'STL' : 'File'}
                    </span>
                    <span style={{ overflowWrap: 'anywhere' }}>{f.original_name}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section number="5" title="Planning & Priority">
            <div className="grid-2">
              <Field label="Priority" required>
                <select className="form-select" value={form.priority} onChange={e => set('priority', e.target.value)}>
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </Field>
              <Field label="Requested Due Date">
                <DateTimePicker value={form.requested_due_date} onChange={v => set('requested_due_date', v)} placeholder="Select due date and time" />
              </Field>
              <Field label="Reason for Priority / Urgency" span={2}>
                <textarea className="form-textarea" value={form.priority_reason} onChange={e => set('priority_reason', e.target.value)} placeholder="If high or critical, explain why..." style={{ minHeight: 60 }} />
              </Field>
            </div>
          </Section>

          {isEdit && requestStatus === 'more_info_required' && (
            <div className="alert alert-warning" style={{ marginBottom: '1rem' }}>
              <strong>Information Required</strong> - Production has requested corrections.
              Update the necessary fields and click <strong>Save &amp; Resubmit</strong>.
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
            <button className="btn btn-ghost" onClick={() => navigate(-1)} disabled={saving}>Cancel</button>
            {requestStatus !== 'more_info_required' && (
              <button className="btn btn-secondary" onClick={() => handleSubmit('save')} disabled={saving}>
                {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : null}
                Save as Draft
              </button>
            )}
            {requestStatus === 'more_info_required' ? (
              <button className="btn btn-primary" onClick={() => handleSubmit('resubmit')} disabled={saving} style={{ background: 'var(--yellow)', color: '#000' }}>
                {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : null}
                Save &amp; Resubmit
              </button>
            ) : (
              <button className="btn btn-primary" onClick={() => handleSubmit('submit')} disabled={saving}>
                {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : null}
                Save &amp; Submit
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
