import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../utils/api';
import { getPeriodLabel, initialDashboardFilters, normalizeDashboardFilters } from '../utils/dashboardFilters';
import { isProductionTechnician } from '../utils/roles';

const GlobalFilterContext = createContext(null);
const STORAGE_KEY = 'dashboard.global.filters';

export function GlobalFilterProvider({ children }) {
  const [filters, setFilters] = useState(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      return saved ? { ...initialDashboardFilters, ...JSON.parse(saved) } : { ...initialDashboardFilters };
    } catch (_) {
      return { ...initialDashboardFilters };
    }
  });
  const [lastUpdated, setLastUpdated] = useState(() => new Date());
  const [options, setOptions] = useState({ sites: [], materials: [], printers: [], technicians: [], requesters: [], categories: [], departments: [] });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
    } catch (_) {}
  }, [filters]);

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [sites, materials, printers, users, categories] = await Promise.all([
          api.get('/sites'),
          api.get('/materials'),
          api.get('/printers'),
          api.get('/users'),
          api.get('/categories'),
        ]);
        const userRows = users.data || [];
        setOptions({
          sites: sites.data || [],
          materials: materials.data || [],
          printers: printers.data || [],
          technicians: userRows.filter(u => isProductionTechnician(u.role)),
          requesters: userRows.filter(u => u.role === 'requester'),
          categories: categories.data || [],
          departments: [...new Set(userRows.map(u => u.department).filter(Boolean))].sort(),
        });
      } catch (err) {
        console.error('[Global Filters] Options failed:', err);
      }
    };
    loadOptions();
  }, []);

  const value = useMemo(() => {
    const normalized = normalizeDashboardFilters(filters);
    return {
      filters,
      normalizedFilters: normalized,
      options,
      periodLabel: getPeriodLabel(filters),
      lastUpdated,
      setFilters: (next) => {
        setFilters(next);
        setLastUpdated(new Date());
      },
      setFilter: (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setLastUpdated(new Date());
      },
      resetAdvanced: () => {
        setFilters(prev => ({
        ...prev,
        material_id: '',
        printer_id: '',
        technician_id: '',
        priority: '',
        status: '',
        requester_id: '',
        requester: '',
        criticality: '',
        production_status: '',
        approval_status: '',
        delivery_status: '',
        inventory_status: '',
        department: '',
        category_id: '',
        }));
        setLastUpdated(new Date());
      },
      resetAll: () => {
        setFilters({ ...initialDashboardFilters });
        setLastUpdated(new Date());
      },
    };
  }, [filters, options, lastUpdated]);

  return <GlobalFilterContext.Provider value={value}>{children}</GlobalFilterContext.Provider>;
}

export const useGlobalFilters = () => {
  const ctx = useContext(GlobalFilterContext);
  if (!ctx) throw new Error('useGlobalFilters must be used within GlobalFilterProvider');
  return ctx;
};
