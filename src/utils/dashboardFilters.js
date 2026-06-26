import { useEffect, useState } from 'react';

export const initialDashboardFilters = {
  site_id: '',
  material_id: '',
  printer_id: '',
  technician_id: '',
  date_from: '',
  date_to: '',
  month: '',
  year: '',
  period: 'all_time',
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
};

const toInputDate = (date) => {
  const copy = new Date(date);
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
  return copy.toISOString().slice(0, 10);
};

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const endOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const getPeriodRange = (period, customFrom, customTo) => {
  const now = new Date();
  let start;
  let end;
  if (!period || period === 'all_time') {
    return { date_from: '', date_to: '' };
  }
  if (period === 'today') {
    start = startOfDay(now);
    end = endOfDay(now);
  } else if (period === 'this_week') {
    const day = now.getDay() || 7;
    start = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1));
    end = endOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + (7 - day)));
  } else if (period === 'this_quarter') {
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
    start = new Date(now.getFullYear(), quarterStartMonth, 1);
    end = new Date(now.getFullYear(), quarterStartMonth + 3, 0);
  } else if (period === 'this_year') {
    start = new Date(now.getFullYear(), 0, 1);
    end = new Date(now.getFullYear(), 11, 31);
  } else if (period === 'last_30_days') {
    start = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29));
    end = endOfDay(now);
  } else if (period === 'last_90_days') {
    start = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 89));
    end = endOfDay(now);
  } else if (period === 'last_12_months') {
    start = startOfDay(new Date(now.getFullYear(), now.getMonth() - 11, now.getDate()));
    end = endOfDay(now);
  } else if (period === 'custom') {
    return { date_from: customFrom || '', date_to: customTo || '' };
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  }
  return { date_from: toInputDate(start), date_to: toInputDate(end) };
};

export const periodOptions = [
  ['all_time', 'All Time'],
  ['today', 'Today'],
  ['this_week', 'This Week'],
  ['this_month', 'This Month'],
  ['this_quarter', 'This Quarter'],
  ['this_year', 'This Year'],
  ['last_30_days', 'Last 30 Days'],
  ['last_90_days', 'Last 90 Days'],
  ['last_12_months', 'Last 12 Months'],
  ['custom', 'Custom Date Range'],
];

export const getPeriodLabel = (filters = {}) => {
  if (filters.period === 'custom') {
    return `${filters.date_from || 'Start'} - ${filters.date_to || 'End'}`;
  }
  return periodOptions.find(([value]) => value === filters.period)?.[1] || 'All Time';
};

export const normalizeDashboardFilters = (filters = {}) => {
  const range = getPeriodRange(filters.period || 'all_time', filters.date_from, filters.date_to);
  return {
    site_id: filters.site_id || '',
    material_id: filters.material_id || '',
    printer_id: filters.printer_id || '',
    technician_id: filters.technician_id || '',
    priority: filters.priority || '',
    status: filters.status || '',
    requester_id: filters.requester_id || '',
    requester: filters.requester || '',
    criticality: filters.criticality || '',
    production_status: filters.production_status || '',
    approval_status: filters.approval_status || '',
    delivery_status: filters.delivery_status || '',
    inventory_status: filters.inventory_status || '',
    department: filters.department || '',
    category_id: filters.category_id || '',
    date_from: range.date_from,
    date_to: range.date_to,
  };
};

export const buildDashboardQuery = (filters, extra = {}) => {
  const qs = new URLSearchParams();
  Object.entries({ ...extra, ...normalizeDashboardFilters(filters) }).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined) qs.set(key, value);
  });
  return qs.toString();
};

export const getActiveFilterLabels = (filters = {}) => {
  const labels = [];
  if (filters.site_id) labels.push('Site');
  if (filters.material_id) labels.push('Material');
  if (filters.printer_id) labels.push('Printer');
  if (filters.technician_id) labels.push('Technician');
  if (filters.priority) labels.push('Priority');
  if (filters.status) labels.push('Status');
  if (filters.requester_id || filters.requester) labels.push('Requester');
  if (filters.criticality) labels.push('Criticality');
  if (filters.production_status) labels.push('Production Status');
  if (filters.approval_status) labels.push('Approval Status');
  if (filters.delivery_status) labels.push('Delivery Status');
  if (filters.inventory_status) labels.push('Inventory Status');
  if (filters.department) labels.push('Department');
  if (filters.category_id) labels.push('Category');
  return labels;
};

export const useDashboardFilters = (storageKey) => {
  const [filters, setFilters] = useState(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      return saved ? { ...initialDashboardFilters, ...JSON.parse(saved) } : { ...initialDashboardFilters };
    } catch (_) {
      return { ...initialDashboardFilters };
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(filters));
    } catch (_) {}
  }, [filters, storageKey]);

  return [filters, setFilters];
};

export const currentYear = new Date().getFullYear();
export const dashboardYears = Array.from({ length: 8 }, (_, i) => currentYear - i);
export const dashboardMonths = [
  ['1', 'January'], ['2', 'February'], ['3', 'March'], ['4', 'April'],
  ['5', 'May'], ['6', 'June'], ['7', 'July'], ['8', 'August'],
  ['9', 'September'], ['10', 'October'], ['11', 'November'], ['12', 'December'],
];
