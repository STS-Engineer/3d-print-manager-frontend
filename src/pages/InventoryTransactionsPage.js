import React, { useEffect, useMemo, useState } from 'react';
import api from '../utils/api';
import Sidebar from '../components/common/Sidebar';

const number = (value, digits = 1) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n.toFixed(digits) : (0).toFixed(digits);
};

const typeLabel = (type) => ({
  restock: 'Stock In',
  stock_in: 'Stock In',
  consumption: 'Stock Out',
  adjustment: 'Stock Adjustment',
  reservation: 'Reserved',
  release: 'Released',
}[type] || String(type || '').replace(/_/g, ' '));

const typeTone = (type) => ({
  restock: 'var(--green)',
  stock_in: 'var(--green)',
  release: 'var(--green)',
  consumption: 'var(--red)',
  adjustment: 'var(--yellow)',
  reservation: 'var(--blue)',
}[type] || 'var(--text-muted)');

export default function InventoryTransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tx, an] = await Promise.all([
        api.get('/inventory/transactions'),
        api.get('/inventory/analytics').catch(() => ({ data: null })),
      ]);
      setTransactions(tx.data || []);
      setAnalytics(an.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return transactions;
    return transactions.filter(t => [
      t.material_name,
      typeLabel(t.transaction_type),
      t.performed_by_name,
      t.request_number,
      t.notes,
    ].some(v => String(v || '').toLowerCase().includes(term)));
  }, [search, transactions]);

  const kpis = analytics?.kpis || {};

  return (
    <div className="page">
      <Sidebar />
      <div className="main-content">
        <div className="page-header">
          <div>
            <h1 style={{ fontSize: '1.3rem', fontFamily: 'var(--font-heading)' }}>Inventory Transactions</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
              Ledger of stock in, stock out, reservations, releases, and adjustments.
            </p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={fetchData}>Refresh</button>
        </div>

        <div className="page-body">
          <div className="grid-3" style={{ marginBottom: '1rem' }}>
            {[
              ['Total Materials', kpis.total_materials || 0],
              ['Low Stock Materials', kpis.low_stock_materials || 0],
              ['Reserved Quantity', `${number(kpis.reserved_material_quantity, 0)} g`],
              ['Consumed This Month', `${number(kpis.consumed_material_this_month, 0)} g`],
              ['Inventory Value', `${number(kpis.inventory_value, 2)} EUR`],
              ['Avg Days Coverage', kpis.average_days_of_coverage ? `${number(kpis.average_days_of_coverage, 1)} days` : 'No usage history'],
            ].map(([label, value]) => (
              <div key={label} className="card">
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: '0.35rem' }}>{value}</div>
              </div>
            ))}
          </div>

          <div className="card" style={{ marginBottom: '1rem' }}>
            <input
              className="form-input"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search material, reference, user, or notes"
            />
          </div>

          <div className="card" style={{ padding: 0 }}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                <span className="spinner" style={{ width: 28, height: 28 }}/>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Material</th>
                    <th>Transaction Type</th>
                    <th>Quantity</th>
                    <th>User</th>
                    <th>Reference</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(t => {
                    const signed = parseFloat(t.signed_quantity ?? t.quantity ?? 0);
                    const color = typeTone(t.transaction_type);
                    return (
                      <tr key={t.id}>
                        <td>{new Date(t.created_at).toLocaleString('fr-FR')}</td>
                        <td>
                          <div style={{ fontWeight: 700 }}>{t.material_name || 'Unknown'}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{t.material_type || ''}</div>
                        </td>
                        <td><span style={{ color, fontWeight: 700 }}>{typeLabel(t.transaction_type)}</span></td>
                        <td style={{ color: signed < 0 ? 'var(--red)' : signed > 0 ? 'var(--green)' : 'var(--blue)', fontWeight: 800 }}>
                          {signed > 0 ? '+' : ''}{number(signed, 1)} {t.unit || 'g'}
                        </td>
                        <td>{t.performed_by_name || '-'}</td>
                        <td>{t.request_number || t.reference || '-'}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{t.notes || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
