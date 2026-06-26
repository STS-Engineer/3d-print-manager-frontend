import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { formatDateTime } from '../../utils/statusHelpers';
import { isProductionTechnician } from '../../utils/roles';

// ─── FEASIBILITY PANEL ───────────────────────────────────────────────────────
const reviewBoolLabel = (value) => {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return 'Not Reviewed';
};

const reviewBoolColor = (value) => {
  if (value === true) return 'var(--green)';
  if (value === false) return 'var(--red)';
  return 'var(--text-muted)';
};

const feasibilityResultLabel = (result) => ({
  approved: 'Approved — go ahead',
  conditional: 'Conditional — with modifications',
  rejected: 'Rejected — not feasible',
  pending: 'Pending',
}[result] || 'Pending');

const normalizeFeasibilityReview = (review) => {
  if (!review) return null;
  return {
    ...review,
    request_id: review.request_id ?? review.requestId,
    reviewed_by: review.reviewed_by ?? review.reviewedBy,
    reviewed_by_name: review.reviewed_by_name ?? review.reviewedByName,
    review_date: review.review_date ?? review.reviewDate,
    is_printable: review.is_printable ?? review.isPrintable,
    machine_compatible: review.machine_compatible ?? review.machineCompatible,
    material_available: review.material_available ?? review.materialAvailable,
    technical_notes: review.technical_notes ?? review.technicalNotes,
    created_at: review.created_at ?? review.createdAt,
  };
};

export function FeasibilityPanel({ requestId, requestStatus, readOnly = false, editableOnMount = false, initialReview, onSaved }) {
  const { user } = useAuth();
  const [data, setData] = useState(() => normalizeFeasibilityReview(initialReview));
  const [editing, setEditing] = useState(editableOnMount);
  const [form, setForm] = useState({
    is_printable: null, machine_compatible: null, material_available: null,
    technical_notes: '', result: 'pending',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canEdit = !readOnly && (isProductionTechnician(user?.role) || user?.role === 'administrator');
  const isFeasibilityStatus = ['feasibility_review','completeness_check','submitted'].includes(requestStatus);

  useEffect(() => {
    if (initialReview !== undefined) {
      const normalized = normalizeFeasibilityReview(initialReview);
      setData(normalized);
      if (normalized) {
        setForm({
          is_printable: normalized.is_printable,
          machine_compatible: normalized.machine_compatible,
          material_available: normalized.material_available,
          technical_notes: normalized.technical_notes || '',
          result: normalized.result || 'pending',
        });
      }
      return;
    }

    api.get(`/requests/${requestId}/feasibility`)
      .then(r => {
        if (r.data) {
          const normalized = normalizeFeasibilityReview(r.data);
          setData(normalized);
          setForm({
            is_printable: normalized.is_printable,
            machine_compatible: normalized.machine_compatible,
            material_available: normalized.material_available,
            technical_notes: normalized.technical_notes || '',
            result: normalized.result || 'pending',
          });
        }
      })
      .catch(() => {});
  }, [requestId, initialReview]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      // Ensure booleans are real booleans (not strings)
      const payload = {
        ...form,
        is_printable:        form.is_printable === true || form.is_printable === 'true' ? true
                           : form.is_printable === false || form.is_printable === 'false' ? false : null,
        machine_compatible:  form.machine_compatible === true || form.machine_compatible === 'true' ? true
                           : form.machine_compatible === false || form.machine_compatible === 'false' ? false : null,
        material_available:  form.material_available === true || form.material_available === 'true' ? true
                           : form.material_available === false || form.material_available === 'false' ? false : null,
      };

      // Validate required fields before sending
      const missing = [];
      if (payload.is_printable === null) missing.push('Printable');
      if (payload.machine_compatible === null) missing.push('Machine Compatible');
      if (payload.material_available === null) missing.push('Material Available');
      if (!payload.result || payload.result === 'pending') missing.push('Feasibility Result (cannot be Pending)');

      if (missing.length > 0) {
        setError(`Please fill in all required fields: ${missing.join(', ')}`);
        setSaving(false);
        return;
      }

      const res = await api.post(`/requests/${requestId}/feasibility`, payload);
      const normalized = normalizeFeasibilityReview(res.data);
      setData(normalized); setEditing(false);
      onSaved?.(normalized);
    } catch (err) { setError(err.response?.data?.error || 'Save failed'); }
    setSaving(false);
  };

  const TriBool = ({ label, field }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', width: 160 }}>{label}</span>
      {['true','false',null].map(v => (
        <button
          key={String(v)}
          onClick={() => set(field, v === 'true' ? true : v === 'false' ? false : null)}
          className="btn btn-sm"
          style={{
            background: String(form[field]) === v || (v === null && form[field] === null) ? (v === 'true' ? 'var(--green-dim)' : v === 'false' ? 'var(--red-dim)' : 'var(--bg-hover)') : 'var(--bg-secondary)',
            color: v === 'true' ? 'var(--green)' : v === 'false' ? 'var(--red)' : 'var(--text-muted)',
            border: '1px solid var(--border)',
            padding: '0.25rem 0.6rem',
          }}
        >
          {v === 'true' ? '✓ Yes' : v === 'false' ? '✕ No' : '— ?'}
        </button>
      ))}
    </div>
  );

  const ResultBadge = ({ result }) => {
    const cfg = {
      approved:  { color: 'var(--green)',  label: feasibilityResultLabel('approved') },
      rejected:  { color: 'var(--red)',    label: feasibilityResultLabel('rejected') },
      conditional:{ color: 'var(--yellow)', label: feasibilityResultLabel('conditional') },
      pending:   { color: 'var(--text-muted)', label: feasibilityResultLabel('pending') },
    }[result] || { color: 'var(--text-muted)', label: result };
    return <span style={{ color: cfg.color, fontWeight: 700, fontSize: '0.85rem' }}>{cfg.label}</span>;
  };

  if (readOnly) {
    const rows = [
      ['Is it printable?', data?.is_printable],
      ['Machine compatible?', data?.machine_compatible],
      ['Material available?', data?.material_available],
    ];
    const notes = data?.technical_notes?.trim() || 'No technical notes.';

    return (
      <div>
        <h3 style={{ fontSize: '0.8rem', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>Feasibility Review</h3>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {rows.map(([label, val]) => (
            <div key={label} style={{ display: 'flex', gap: '1rem', padding: '0.6rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.83rem' }}>
              <span style={{ width: 180, flexShrink: 0, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
              <span style={{ color: reviewBoolColor(val), fontWeight: 700 }}>{reviewBoolLabel(val)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', gap: '1rem', padding: '0.6rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.83rem' }}>
            <span style={{ width: 180, flexShrink: 0, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Technical Notes</span>
            <span style={{ color: data?.technical_notes?.trim() ? 'var(--text-primary)' : 'var(--text-muted)', lineHeight: 1.5 }}>{notes}</span>
          </div>
          <div style={{ display: 'flex', gap: '1rem', padding: '0.6rem 0', fontSize: '0.83rem' }}>
            <span style={{ width: 180, flexShrink: 0, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Feasibility Result</span>
            <ResultBadge result={data?.result || 'pending'} />
          </div>
        </div>
      </div>
    );
  }

  if (!data && !editing) return (
    <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
      <p>No feasibility review yet.</p>
      {canEdit && isFeasibilityStatus && (
        <button className="btn btn-primary btn-sm" style={{ marginTop: '0.75rem' }} onClick={() => setEditing(true)}>
          Start Feasibility Review
        </button>
      )}
    </div>
  );

  return (
    <div>
      {!editing ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <ResultBadge result={data?.result}/>
            {canEdit && (
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>Edit</button>
            )}
          </div>
          {[['Printable', data?.is_printable], ['Machine Compatible', data?.machine_compatible], ['Material Available', data?.material_available]].map(([label, val]) => (
            <div key={label} style={{ display: 'flex', gap: '1rem', padding: '0.5rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.83rem' }}>
              <span style={{ width: 160, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
              <span style={{ color: val === true ? 'var(--green)' : val === false ? 'var(--red)' : 'var(--text-muted)' }}>
                {val === true ? '✓ Yes' : val === false ? '✕ No' : '—'}
              </span>
            </div>
          ))}
          {data?.technical_notes && (
            <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--bg-hover)', borderRadius: 6, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {data.technical_notes}
            </div>
          )}
          <div style={{ marginTop: '0.75rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Reviewed by {data?.reviewed_by_name} · {formatDateTime(data?.review_date)}
          </div>
        </div>
      ) : (
        <div>
          {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}
          <TriBool label="Is it printable?" field="is_printable"/>
          <TriBool label="Machine compatible?" field="machine_compatible"/>
          <TriBool label="Material available?" field="material_available"/>
          <div className="form-group" style={{ marginTop: '0.5rem' }}>
            <label className="form-label">Technical Notes</label>
            <textarea className="form-textarea" value={form.technical_notes} onChange={e => set('technical_notes', e.target.value)} placeholder="Observations, constraints, recommendations…"/>
          </div>
          <div className="form-group">
            <label className="form-label">Feasibility Result</label>
            <select className="form-select" value={form.result} onChange={e => set('result', e.target.value)}>
              <option value="pending">Pending</option>
              <option value="approved">Approved — go ahead</option>
              <option value="conditional">Conditional — with modifications</option>
              <option value="rejected">Rejected — not feasible</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
              {saving ? <span className="spinner" style={{ width: 14, height: 14 }}/> : null}
              Save Review
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── QUALITY CHECK PANEL ─────────────────────────────────────────────────────
const toQuantity = (value) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : 0;
};

export function QualityCheckPanel({ requestId, requestStatus, request }) {
  const { user } = useAuth();
  const [checks, setChecks] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    result: '', dimensional_check: false, surface_quality_check: false,
    functional_check: false, visual_check: false, validated_quantity_checked: '',
    comments: '', deviation_notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canAdd = isProductionTechnician(user?.role) || user?.role === 'administrator';
  const isQCStatus = ['quality_check','printed'].includes(requestStatus);
  const requestedQuantity = toQuantity(request?.quantity);
  const printedQuantity = toQuantity(request?.productionSummary?.total_printed_quantity ?? request?.printed_quantity);
  const rejectedQuantity = toQuantity(request?.productionSummary?.total_rejected_quantity ?? request?.rejected_quantity);
  const successfulQuantity = Math.max(printedQuantity - rejectedQuantity, 0);
  const previousValidatedQuantity = checks.reduce((sum, check) => sum + toQuantity(check.validated_quantity_checked), 0);
  const validatedQuantity = form.validated_quantity_checked === '' ? null : toQuantity(form.validated_quantity_checked);
  const totalValidatedQuantity = previousValidatedQuantity + (validatedQuantity || 0);
  const missingProductionQuantity = Math.max(requestedQuantity - successfulQuantity, 0)
    + Math.max(successfulQuantity - totalValidatedQuantity, 0);
  const hasQuantityMismatch = requestedQuantity > 0 && successfulQuantity < requestedQuantity;
  const hasValidatedMismatch = validatedQuantity !== null && requestedQuantity > 0 && totalValidatedQuantity < requestedQuantity;
  const effectiveResult = (hasQuantityMismatch || hasValidatedMismatch) ? 'fail' : form.result;

  const fetchChecks = () => {
    api.get(`/requests/${requestId}/quality-checks`).then(r => setChecks(r.data)).catch(() => {});
  };
  useEffect(() => { fetchChecks(); }, [requestId]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.result) { setError('Result is required'); return; }
    setSaving(true); setError('');
    try {
      // Coerce checkboxes to real booleans
      const payload = {
        ...form,
        result: effectiveResult,
        dimensional_check:      form.dimensional_check === true || form.dimensional_check === 'true',
        surface_quality_check:  form.surface_quality_check === true || form.surface_quality_check === 'true',
        functional_check:       form.functional_check === true || form.functional_check === 'true',
        visual_check:           form.visual_check === true || form.visual_check === 'true',
        validated_quantity_checked: validatedQuantity,
        successful_quantity: successfulQuantity,
        remaining_quantity: missingProductionQuantity,
        quantity_mismatch: hasQuantityMismatch,
      };

      if (payload.validated_quantity_checked === null || payload.validated_quantity_checked === undefined) {
        setError('Validated Quantity Checked is required.');
        setSaving(false);
        return;
      }

      // Validate all 4 checks are done
      const unchecked = [];
      if (!payload.dimensional_check)     unchecked.push('Dimensional');
      if (!payload.surface_quality_check) unchecked.push('Surface Quality');
      if (!payload.functional_check)      unchecked.push('Functional');
      if (!payload.visual_check)          unchecked.push('Visual');

      if (unchecked.length > 0 && payload.result !== 'fail') {
        setError(`Please check all quality criteria: ${unchecked.join(', ')}`);
        setSaving(false);
        return;
      }

      await api.post(`/requests/${requestId}/quality-checks`, payload);
      setForm({ result: '', dimensional_check: false, surface_quality_check: false, functional_check: false, visual_check: false, validated_quantity_checked: '', comments: '', deviation_notes: '' });
      setShowForm(false);
      fetchChecks();
    } catch (err) { setError(err.response?.data?.error || 'Save failed'); }
    setSaving(false);
  };

  const resultStyle = (r) => ({
    pass: { color: 'var(--green)', bg: 'var(--green-dim)' },
    pass_with_deviation: { color: 'var(--yellow)', bg: 'var(--yellow-dim)' },
    fail: { color: 'var(--red)', bg: 'var(--red-dim)' },
    pending: { color: 'var(--text-muted)', bg: 'var(--bg-hover)' },
  }[r] || { color: 'var(--text-muted)', bg: 'var(--bg-hover)' });

  return (
    <div>
      {checks.map((c, i) => {
        const s = resultStyle(c.result);
        return (
          <div key={c.id} style={{ marginBottom: '0.75rem', padding: '0.85rem', background: 'var(--bg-hover)', borderRadius: 8, borderLeft: `3px solid ${s.color}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontWeight: 700, color: s.color, textTransform: 'uppercase', fontSize: '0.8rem' }}>
                {c.result.replace(/_/g,' ')}
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{formatDateTime(c.check_date)}</span>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
              {[['Dimensional', c.dimensional_check], ['Surface', c.surface_quality_check], ['Functional', c.functional_check], ['Visual', c.visual_check]].map(([label, val]) => (
                <span key={label} style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', borderRadius: 4, background: val ? 'var(--green-dim)' : 'var(--red-dim)', color: val ? 'var(--green)' : 'var(--red)' }}>
                  {val ? '✓' : '✕'} {label}
                </span>
              ))}
            </div>
            <div className="grid-2" style={{ gap: '0.5rem', marginBottom: '0.45rem' }}>
              {[
                ['Successful Quantity', c.successful_quantity],
                ['Validated Quantity Checked', c.validated_quantity_checked],
                ['Missing Production Quantity', c.remaining_quantity],
                ['Quantity Status', c.quantity_mismatch ? 'Quantity mismatch detected. Rework required.' : 'OK'],
              ].map(([label, value]) => (
                <div key={label} style={{ padding: '0.5rem', background: 'var(--bg-secondary)', borderRadius: 6 }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 700, color: label === 'Quantity Status' && c.quantity_mismatch ? 'var(--red)' : 'var(--text-primary)' }}>
                    {value ?? '-'}
                  </div>
                </div>
              ))}
            </div>
            {c.comments && <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.4rem 0 0' }}>{c.comments}</p>}
            {c.deviation_notes && <p style={{ fontSize: '0.78rem', color: 'var(--yellow)', margin: '0.25rem 0 0', fontStyle: 'italic' }}>⚠ {c.deviation_notes}</p>}
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>by {c.checked_by_name}</div>
          </div>
        );
      })}

      {checks.length === 0 && !showForm && (
        <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.83rem' }}>
          No quality checks recorded yet.
        </div>
      )}

      {canAdd && (isQCStatus || checks.length > 0) && !showForm && (
        <button className="btn btn-secondary btn-sm" onClick={() => setShowForm(true)}>+ Add Quality Check</button>
      )}

      {showForm && (
        <div style={{ background: 'var(--bg-hover)', borderRadius: 8, padding: '1rem', marginTop: '0.5rem' }}>
          {error && <div className="alert alert-error" style={{ marginBottom: '0.75rem' }}>{error}</div>}
          <div className="form-group" style={{ marginBottom: '0.75rem' }}>
            <label className="form-label">Result *</label>
            <select className="form-select" value={form.result} onChange={e => set('result', e.target.value)}>
              <option value="">Select result…</option>
              <option value="pass">✓ Pass</option>
              <option value="pass_with_deviation">⚠ Pass with Deviation</option>
              <option value="fail">✕ Fail</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
            {[['dimensional_check','Dimensional'], ['surface_quality_check','Surface Quality'], ['functional_check','Functional'], ['visual_check','Visual']].map(([k, label]) => (
              <label key={k} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <input type="checkbox" checked={form[k]} onChange={e => set(k, e.target.checked)}/> {label}
              </label>
            ))}
          </div>
          <div className="grid-2" style={{ gap: '0.6rem', marginBottom: '0.75rem' }}>
            {[
              ['Requested Quantity', requestedQuantity],
              ['Printed Quantity', printedQuantity],
              ['Rejected / Failed Quantity', rejectedQuantity],
              ['Successful Quantity', successfulQuantity],
              ['Total Validated Quantity', totalValidatedQuantity],
              ['Missing Production Quantity', missingProductionQuantity],
            ].map(([label, value]) => (
              <div key={label} style={{ padding: '0.65rem', background: 'var(--bg-secondary)', borderRadius: 6 }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: label === 'Missing Production Quantity' && value > 0 ? 'var(--red)' : 'var(--text-primary)' }}>{value}</div>
              </div>
            ))}
          </div>
          {hasQuantityMismatch && (
            <div className="alert alert-warning" style={{ marginBottom: '0.75rem' }}>
              Quality Check Failed. Rework Required.
            </div>
          )}
          <div className="form-group" style={{ marginBottom: '0.5rem' }}>
            <label className="form-label">Validated Quantity Checked *</label>
            <input
              type="number"
              min="0"
              className="form-input"
              value={form.validated_quantity_checked}
              onChange={e => set('validated_quantity_checked', e.target.value)}
              placeholder={`Expected ${requestedQuantity}`}
            />
          </div>
          {hasValidatedMismatch && (
            <div className="alert alert-warning" style={{ marginBottom: '0.75rem' }}>
              Quality Check Failed. Rework Required.
            </div>
          )}
          <div className="form-group" style={{ marginBottom: '0.5rem' }}>
            <label className="form-label">Comments</label>
            <textarea className="form-textarea" value={form.comments} onChange={e => set('comments', e.target.value)} style={{ minHeight: 60 }}/>
          </div>
          {(form.result === 'pass_with_deviation' || form.result === 'fail') && (
            <div className="form-group" style={{ marginBottom: '0.5rem' }}>
              <label className="form-label">Deviation / Failure Notes</label>
              <textarea className="form-textarea" value={form.deviation_notes} onChange={e => set('deviation_notes', e.target.value)} style={{ minHeight: 60 }} placeholder="Describe the deviation or failure in detail…"/>
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
              {saving ? <span className="spinner" style={{ width: 14, height: 14 }}/> : null}
              Save Check
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
