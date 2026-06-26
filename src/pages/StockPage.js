import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import Sidebar from '../components/common/Sidebar';
import { useAuth } from '../context/AuthContext';
import { isProductionTechnician } from '../utils/roles';

export default function StockPage() {
  const { user } = useAuth();
  const canAdjustStock = isProductionTechnician(user?.role) || user?.role === 'administrator';
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adjustModal, setAdjustModal] = useState(null); // { id, name, unit, available }
  const [adjustment, setAdjustment] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [selectedMat, setSelectedMat] = useState(null);

  const fetchStock = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/materials/stock-overview');
      setMaterials(res.data);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchStock(); }, [fetchStock]);

  const fetchTransactions = async (matId) => {
    try {
      const res = await api.get(`/materials/${matId}/transactions`);
      setTransactions(res.data);
      setSelectedMat(matId);
    } catch (err) { console.error(err); }
  };

  const handleAdjust = async () => {
    if (!canAdjustStock) return;
    if (!adjustment || isNaN(parseFloat(adjustment))) {
      setError('Enter a valid quantity (positive to add, negative to deduct)');
      return;
    }
    setSaving(true); setError('');
    try {
      await api.post(`/materials/${adjustModal.id}/adjust-stock`, {
        adjustment: parseFloat(adjustment),
        reason: reason || undefined,
      });
      setAdjustModal(null); setAdjustment(''); setReason('');
      await fetchStock();
      if (selectedMat === adjustModal.id) await fetchTransactions(adjustModal.id);
    } catch (err) {
      setError(err.response?.data?.error || 'Adjustment failed');
    } finally { setSaving(false); }
  };

  const stockColor = (m) => {
    const avail = parseFloat(m.available_quantity || 0);
    const threshold = parseFloat(m.low_stock_threshold || 200);
    if (avail <= 0) return 'var(--red)';
    if (avail <= threshold) return 'var(--yellow)';
    return 'var(--green)';
  };

  const stockBg = (m) => {
    const avail = parseFloat(m.available_quantity || 0);
    const threshold = parseFloat(m.low_stock_threshold || 200);
    if (avail <= 0) return 'var(--red-dim)';
    if (avail <= threshold) return 'var(--yellow-dim)';
    return 'var(--green-dim)';
  };

  const riskLabel = (m) => {
    if (m.risk_level === 'red') return 'Red';
    if (m.risk_level === 'orange') return 'Orange';
    return 'Green';
  };

  return (
    <div className="page">
      <Sidebar />
      <div className="main-content">
        <div className="page-header">
          <div>
            <h1 style={{ fontSize: '1.3rem', fontFamily: 'var(--font-heading)' }}>Material Stock</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
              Real-time stock levels — click a material to see transaction history
            </p>
          </div>
          <div style={{ display:'flex', gap:'0.5rem' }}>
            <button className="btn btn-ghost btn-sm" onClick={fetchStock}>↻ Refresh</button>
            {canAdjustStock && <button
              className="btn btn-secondary btn-sm"
              onClick={async () => {
                try {
                  const res = await api.post('/materials/recalculate-stock');
                  alert(`✅ Stock recalculated — ${res.data.materials_updated} materials updated`);
                  await fetchStock();
                } catch(err) {
                  alert('Recalculate failed: ' + (err.response?.data?.error || err.message));
                }
              }}
              title="Recompute available/reserved quantities from reservation records"
            >
              ⚡ Recalculate Stock
            </button>}
          </div>
        </div>

        <div className="page-body">
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
              <span className="spinner" style={{ width: 28, height: 28 }}/>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: selectedMat ? '1fr 1fr' : '1fr', gap: '1.5rem' }}>
              {/* Stock table */}
              <div>
                <div className="card" style={{ padding: 0 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Material</th>
                        <th>Type</th>
                        <th>Current Stock</th>
                        <th>Available Stock</th>
                        <th>Reserved Stock</th>
                        <th>Min. Threshold</th>
                        <th>Coverage</th>
                        <th>Status</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {materials.map(m => (
                        <tr
                          key={m.id}
                          style={{ cursor: 'pointer', background: selectedMat === m.id ? 'var(--bg-hover)' : undefined }}
                          onClick={() => fetchTransactions(m.id)}
                        >
                          <td>
                            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{m.name}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{m.brand}</div>
                          </td>
                          <td><span style={{ fontSize: '0.72rem', background: 'var(--cyan-dim)', color: 'var(--cyan)', padding: '0.15rem 0.5rem', borderRadius: 4, fontWeight: 600 }}>{m.type}</span></td>
                          <td style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                            {parseFloat(m.stock_quantity || 0).toFixed(0)} {m.unit}
                          </td>
                          <td style={{ fontSize: '0.85rem', fontWeight: 700, color: stockColor(m) }}>
                            {parseFloat(m.available_quantity || 0).toFixed(0)} {m.unit}
                          </td>
                          <td style={{ fontSize: '0.85rem', color: 'var(--yellow)' }}>
                            {parseFloat(m.reserved_quantity || 0).toFixed(0)} {m.unit}
                          </td>
                          <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            {parseFloat(m.low_stock_threshold || 200).toFixed(0)} {m.unit}
                          </td>
                          <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {m.days_of_coverage === null || m.days_of_coverage === undefined
                              ? 'No usage history'
                              : `${parseFloat(m.days_of_coverage).toFixed(1)} days`}
                          </td>
                          <td>
                            <span style={{
                              fontSize: '0.72rem', fontWeight: 600, padding: '0.2rem 0.6rem',
                              borderRadius: 4, background: stockBg(m), color: stockColor(m),
                            }}>
                              {parseFloat(m.available_quantity || 0) <= 0 ? 'Out of Stock'
                                : `${riskLabel(m)} Risk`}
                            </span>
                          </td>
                          <td>
                            {canAdjustStock && <button
                              className="btn btn-secondary btn-sm"
                              onClick={e => { e.stopPropagation(); setAdjustModal(m); setAdjustment(''); setReason(''); setError(''); }}
                            >
                              Adjust
                            </button>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {materials.filter(m => m.is_low_stock || parseFloat(m.available_quantity || 0) <= 0).length > 0 && (
                  <div className="alert alert-warning" style={{ marginTop: '1rem' }}>
                    ⚠ <strong>{materials.filter(m => m.is_low_stock).length}</strong> material(s) are at low stock level.
                    Consider restocking before planning new requests.
                  </div>
                )}
              </div>

              {/* Transaction history panel */}
              {selectedMat && (
                <div className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                      Transaction History — {materials.find(m => m.id === selectedMat)?.name}
                    </h3>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setSelectedMat(null); setTransactions([]); }}>✕</button>
                  </div>
                  {transactions.length === 0 ? (
                    <div className="empty-state" style={{ padding: '2rem' }}>
                      <p>No transactions recorded yet.</p>
                      <p style={{ fontSize: '0.75rem', marginTop: '0.35rem', color: 'var(--text-muted)' }}>
                        Transactions appear after running db:migrate:v4
                      </p>
                    </div>
                  ) : (
                    <div style={{ overflowY: 'auto', maxHeight: 400 }}>
                      {transactions.map((t, i) => {
                        const typeColors = {
                          reservation: 'var(--yellow)', consumption: 'var(--accent)',
                          release: 'var(--green)', restock: 'var(--blue)', adjustment: 'var(--purple)',
                        };
                        const col = typeColors[t.transaction_type] || 'var(--text-muted)';
                        return (
                          <div key={t.id} style={{
                            padding: '0.6rem 0', borderBottom: '1px solid var(--border)',
                            display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
                          }}>
                            <span style={{
                              fontSize: '0.68rem', fontWeight: 700, padding: '0.15rem 0.5rem',
                              borderRadius: 4, background: `${col}22`, color: col,
                              flexShrink: 0, textTransform: 'uppercase', marginTop: '0.1rem',
                            }}>
                              {t.transaction_type}
                            </span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                                {t.transaction_type === 'restock' || t.transaction_type === 'release' ? '+' : '-'}
                                {parseFloat(t.quantity).toFixed(1)} {materials.find(m => m.id === selectedMat)?.unit}
                              </div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                                {t.request_number && <span style={{ marginRight: '0.5rem' }}>{t.request_number}</span>}
                                {t.performed_by_name} · {new Date(t.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </div>
                              {t.notes && <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.1rem', fontStyle: 'italic' }}>{t.notes}</div>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Adjust modal */}
      {adjustModal && (
        <div className="modal-overlay" onClick={() => setAdjustModal(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1rem', fontFamily: 'var(--font-heading)' }}>
                Adjust Stock — {adjustModal.name}
              </h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setAdjustModal(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {error && <div className="alert alert-error">{error}</div>}
              <div style={{ padding: '0.75rem', background: 'var(--bg-hover)', borderRadius: 6, fontSize: '0.83rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Current available: </span>
                <strong style={{ color: stockColor(adjustModal) }}>
                  {parseFloat(adjustModal.available_quantity || 0).toFixed(1)} {adjustModal.unit}
                </strong>
              </div>
              <div className="form-group">
                <label className="form-label">
                  Adjustment ({adjustModal.unit})
                  <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: '0.4rem' }}>
                    — positive to add, negative to deduct
                  </span>
                </label>
                <input
                  type="number" step="0.1"
                  className="form-input"
                  value={adjustment}
                  onChange={e => setAdjustment(e.target.value)}
                  placeholder="e.g. +500 or -50"
                  autoFocus
                />
                {adjustment && !isNaN(parseFloat(adjustment)) && (
                  <div style={{ fontSize: '0.75rem', marginTop: '0.25rem', color: parseFloat(adjustment) >= 0 ? 'var(--green)' : 'var(--yellow)' }}>
                    New available: {Math.max(0, parseFloat(adjustModal.available_quantity || 0) + parseFloat(adjustment)).toFixed(1)} {adjustModal.unit}
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Reason</label>
                <input className="form-input" value={reason} onChange={e => setReason(e.target.value)}
                  placeholder="e.g. New spool received, damaged material removed…"/>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setAdjustModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAdjust} disabled={saving || !adjustment}>
                {saving ? <span className="spinner" style={{ width: 14, height: 14 }}/> : null}
                Apply Adjustment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
