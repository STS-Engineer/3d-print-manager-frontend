export const PRODUCTION_TECHNICIAN = 'production_technician';
export const PRODUCTION_TECHNICIAN_ALIASES = [PRODUCTION_TECHNICIAN, 'coordinator', 'technician'];

export const normalizeRole = (role) => (
  PRODUCTION_TECHNICIAN_ALIASES.includes(role) ? PRODUCTION_TECHNICIAN : role
);

export const hasRole = (role, allowedRoles = []) => (
  allowedRoles.map(normalizeRole).includes(normalizeRole(role))
);

export const isProductionTechnician = (role) => normalizeRole(role) === PRODUCTION_TECHNICIAN;
