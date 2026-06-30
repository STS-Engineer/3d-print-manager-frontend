import React, { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import { ROLE_NAV_ITEMS } from '../../utils/navigation';

const icons = {
  dashboard:   <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  requests:    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>,
  new:         <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>,
  performance: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  management:  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/></svg>,
  planning:    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  archive:     <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8"/></svg>,
  reports:     <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  resource:    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 19V5"/><path d="M20 19V5"/><path d="M4 8h16"/><path d="M4 16h16"/><path d="M8 8v8"/><path d="M16 8v8"/></svg>,
  admin:       <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  bell:        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>,
  logout:      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  help:        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
};

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const navRef = useRef(null);
  const storageKey = `sidebar.nav.${user?.role || 'guest'}`;

  useEffect(() => {
    const fetchNotifs = async () => {
      try {
        const res = await api.get('/notifications');
        setUnreadCount(res.data.unreadCount);
      } catch {}
    };
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30000);
    return () => clearInterval(interval);
  }, []);

  const navItems = ROLE_NAV_ITEMS[user?.role] || [];

  const navGroups = useMemo(() => {
    const groups = [];
    let current = null;
    navItems.forEach((item, index) => {
      if (item.type === 'section') {
        current = { key: item.label, label: item.label, index, items: [] };
        groups.push(current);
        return;
      }
      if (!current) {
        current = { key: '__root__', label: null, index: -1, items: [] };
        groups.push(current);
      }
      current.items.push(item);
    });
    return groups;
  }, [navItems]);

  const sectionKeys = useMemo(
    () => navGroups.filter(group => group.label).map(group => group.key),
    [navGroups]
  );

  const splitPath = (path) => {
    const [pathname, search = ''] = path.split('?');
    return { pathname, search: search ? `?${search}` : '' };
  };

  const isActive = (path) => {
    if (!path) return false;
    const target = splitPath(path);
    if (target.search && location.search !== target.search) return false;
    if (target.pathname === '/dashboard') return location.pathname === target.pathname;
    if (target.pathname === '/reports') return location.pathname === target.pathname;
    if (target.pathname === '/archive') return location.pathname === target.pathname;
    if (target.pathname === '/maintenance') return location.pathname === target.pathname;
    if (path === '/requests/new') return location.pathname === path;
    if (path === '/requests') return location.pathname === '/requests' || (location.pathname.startsWith('/requests/') && location.pathname !== '/requests/new');
    return location.pathname === target.pathname || (target.pathname !== '/' && location.pathname.startsWith(target.pathname));
  };

  const activeSectionKey = useMemo(() => {
    const activeGroup = navGroups.find(group => group.items.some(item => isActive(item.path)));
    return activeGroup?.label ? activeGroup.key : null;
  }, [navGroups, location.pathname, location.search]);

  const [expandedSections, setExpandedSections] = useState(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) || '{}');
      return saved.expandedSections || {};
    } catch (_) {
      return {};
    }
  });

  useEffect(() => {
    setExpandedSections(prev => {
      const next = { ...prev };
      sectionKeys.forEach(key => {
        if (next[key] === undefined) next[key] = true;
      });
      if (activeSectionKey) next[activeSectionKey] = true;
      return next;
    });
  }, [activeSectionKey, sectionKeys]);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) || '{}');
      window.localStorage.setItem(storageKey, JSON.stringify({
        ...saved,
        expandedSections,
      }));
    } catch (_) {}
  }, [expandedSections, storageKey]);

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    let scrollTop = 0;
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) || '{}');
      scrollTop = Number(saved.scrollTop || 0);
    } catch (_) {}
    const frame = window.requestAnimationFrame(() => {
      nav.scrollTop = scrollTop;
      const activeItem = nav.querySelector('[data-sidebar-active="true"]');
      if (activeItem) {
        const navRect = nav.getBoundingClientRect();
        const itemRect = activeItem.getBoundingClientRect();
        const isVisible = itemRect.top >= navRect.top && itemRect.bottom <= navRect.bottom;
        if (!isVisible) activeItem.scrollIntoView({ block: 'nearest' });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [location.pathname, location.search, storageKey, expandedSections]);

  const saveScrollPosition = () => {
    const nav = navRef.current;
    if (!nav) return;
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) || '{}');
      window.localStorage.setItem(storageKey, JSON.stringify({
        ...saved,
        scrollTop: nav.scrollTop,
      }));
    } catch (_) {}
  };

  const toggleSection = (key) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const SectionHeader = ({ group }) => {
    const expanded = expandedSections[group.key] !== false;
    const active = activeSectionKey === group.key;
    return (
      <button
        onClick={() => toggleSection(group.key)}
        aria-expanded={expanded}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '0.9rem 0.85rem 0.35rem',
          border: 'none',
          background: 'transparent',
          color: active ? 'var(--accent)' : 'var(--text-muted)',
          fontSize: '0.64rem',
          fontFamily: 'var(--font-mono)',
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span>{group.label}</span>
        <span style={{ fontSize: '0.7rem', lineHeight: 1 }}>{expanded ? 'v' : '>'}</span>
      </button>
    );
  };

  const NavBtn = ({ item }) => {
    const active = isActive(item.path);
    const handleNavigate = () => {
      saveScrollPosition();
      console.log('[Navigation] sidebar click', {
        role: user?.role,
        label: item.label,
        routeName: item.routeName,
        path: item.path,
        from: `${location.pathname}${location.search}`,
      });
      navigate(item.path);
    };

    return (
      <button
        onClick={handleNavigate}
        data-sidebar-active={active ? 'true' : undefined}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.6rem',
          width: '100%', padding: '0.65rem 0.85rem',
          borderRadius: 'var(--radius)', border: 'none', cursor: 'pointer',
          background: active ? 'var(--accent-dim)' : 'transparent',
          color: active ? 'var(--accent)' : 'var(--text-secondary)',
          fontSize: '0.82rem', fontFamily: 'var(--font-mono)',
          fontWeight: active ? 600 : 400, textAlign: 'left',
          marginBottom: '0.1rem', transition: 'var(--transition)',
        }}
        onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}}
        onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}}
      >
        {icons[item.icon]}
        {item.label}
      </button>
    );
  };

  return (
    <aside className="sidebar" style={{ display: 'flex', flexDirection: 'column', height: '100vh', position: 'sticky', top: 0 }}>
      {/* Logo */}
      <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'linear-gradient(135deg, var(--accent), #ff9f7a)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" fill="white" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '0.95rem', lineHeight: 1 }}>3D Print</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>AVOCARBON</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav
        ref={navRef}
        onScroll={saveScrollPosition}
        style={{ flex: 1, padding: '0.75rem', overflowY: 'auto' }}
      >
        {navGroups.map(group => (
          <div key={group.key}>
            {group.label && <SectionHeader group={group} />}
            {(group.label ? expandedSections[group.key] !== false : true) && group.items.map(item => (
              <NavBtn key={item.path || item.label} item={item}/>
            ))}
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div style={{ padding: '0.75rem', borderTop: '1px solid var(--border)' }}>
        <button
          onClick={() => { saveScrollPosition(); navigate('/onboarding'); }}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.6rem',
            width: '100%', padding: '0.6rem 0.85rem', borderRadius: 'var(--radius)',
            border: 'none', cursor: 'pointer', background: 'transparent',
            color: 'var(--text-secondary)', fontSize: '0.82rem', fontFamily: 'var(--font-mono)',
            marginBottom: '0.15rem', transition: 'var(--transition)',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
        >
          {icons.help} Getting Started
        </button>

        <button
          onClick={() => { saveScrollPosition(); navigate('/notifications'); }}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            width: '100%', padding: '0.6rem 0.85rem', borderRadius: 'var(--radius)',
            border: 'none', cursor: 'pointer', background: 'transparent',
            color: 'var(--text-secondary)', fontSize: '0.82rem', fontFamily: 'var(--font-mono)',
            marginBottom: '0.25rem', transition: 'var(--transition)',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {icons.bell} Notifications
          </span>
          {unreadCount > 0 && (
            <span style={{ background: 'var(--accent)', color: 'white', borderRadius: '10px', padding: '0.1rem 0.5rem', fontSize: '0.68rem', fontWeight: 700 }}>{unreadCount}</span>
          )}
        </button>

        <div style={{ padding: '0.65rem', background: 'var(--bg-hover)', borderRadius: 'var(--radius)', marginBottom: '0.5rem' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>{user?.firstName} {user?.lastName}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.1rem' }}>
            {user?.role} · {user?.department}
          </div>
        </div>

        <button
          onClick={logout}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.6rem',
            width: '100%', padding: '0.5rem 0.85rem', borderRadius: 'var(--radius)',
            border: '1px solid var(--border)', cursor: 'pointer', background: 'transparent',
            color: 'var(--text-muted)', fontSize: '0.78rem', fontFamily: 'var(--font-mono)',
            transition: 'var(--transition)',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
        >
          {icons.logout} Sign Out
        </button>
      </div>
    </aside>
  );
}
