import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { formatDateTime } from '../utils/statusHelpers';
import Sidebar from '../components/common/Sidebar';

const NOTIF_ICONS = {
  status_approved: { icon: '✓', color: 'var(--green)' },
  status_rejected: { icon: '✕', color: 'var(--red)' },
  status_assigned: { icon: '→', color: 'var(--blue)' },
  status_completed: { icon: '★', color: 'var(--accent)' },
  status_more_info_required: { icon: '?', color: 'var(--yellow)' },
  status_blocked: { icon: '⊘', color: 'var(--red)' },
};

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotifs = async () => {
      try {
        const res = await api.get('/notifications');
        setNotifications(res.data.notifications);
        // Mark all as read
        await api.put('/notifications/read');
      } catch (err) { console.error(err); }
      setLoading(false);
    };
    fetchNotifs();
  }, []);

  return (
    <div className="page">
      <Sidebar />
      <div className="main-content">
        <div className="page-header">
          <div>
            <h1 style={{ fontSize: '1.3rem', fontFamily: 'var(--font-heading)' }}>Notifications</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
              {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="page-body" style={{ maxWidth: 720 }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
              <span className="spinner" style={{ width: 28, height: 28 }}/>
            </div>
          ) : notifications.length === 0 ? (
            <div className="empty-state">
              <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" style={{ opacity: 0.3 }}>
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
              </svg>
              <p style={{ marginTop: '0.5rem' }}>No notifications</p>
            </div>
          ) : (
            notifications.map(n => {
              const cfg = NOTIF_ICONS[n.type] || { icon: '•', color: 'var(--text-muted)' };
              return (
                <div
                  key={n.id}
                  className="card"
                  style={{
                    marginBottom: '0.6rem', cursor: n.request_id ? 'pointer' : 'default',
                    display: 'flex', gap: '1rem', alignItems: 'flex-start',
                    opacity: n.is_read ? 0.7 : 1,
                    borderLeft: n.is_read ? '3px solid var(--border)' : `3px solid ${cfg.color}`,
                  }}
                  onClick={() => n.request_id && navigate(`/requests/${n.request_id}`)}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    background: `${cfg.color}22`, color: cfg.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.9rem', fontWeight: 700,
                  }}>{cfg.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{n.title}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', marginLeft: '1rem' }}>
                        {formatDateTime(n.created_at)}
                      </div>
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: '0.25rem' }}>{n.message}</div>
                    {n.request_number && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--accent)', marginTop: '0.35rem', fontFamily: 'var(--font-mono)' }}>
                        {n.request_number} — {n.request_title}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
