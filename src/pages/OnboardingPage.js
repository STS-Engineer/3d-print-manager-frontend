import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/common/Sidebar';
import { useAuth } from '../context/AuthContext';
import { getNavigationMapItems } from '../utils/navigation';
import { PRODUCTION_TECHNICIAN, isProductionTechnician, normalizeRole } from '../utils/roles';

const ROLE_GUIDES = {
  requester: {
    label: 'Requester',
    color: '#534AB7',
    quickStart: [
      'Create a new 3D print request and select the correct site.',
      'Add required technical information and upload STL, STEP, PDF, or image files.',
      'Track progress from My Requests and read production comments.',
      'Respond quickly when a request is moved to Info Required.',
      'Confirm reception when the part is delivered.',
    ],
    responsibilities: [
      'Submit clear and complete part requirements.',
      'Provide missing information when requested.',
      'Use comments and attachments to keep all context inside the request.',
      'Confirm reception so the full delivery trace remains complete.',
    ],
  },
  [PRODUCTION_TECHNICIAN]: {
    label: 'Production Technician',
    color: '#3B6D11',
    quickStart: [
      'Review submitted requests and request missing information when needed.',
      'Run feasibility review, approve or reject, and set due dates.',
      'Plan material, printer, schedule, and assigned production technician resources.',
      'Move work to In Progress when printing starts.',
      'Record printed quantity, material used, execution times, and actual cost data.',
      'Declare Rework Required when a new production cycle is needed.',
      'Move finished work to Waiting Customer Confirmation when production work is done.',
    ],
    responsibilities: [
      'Keep the workflow moving from submitted request to operational completion.',
      'Reserve material and maintain accurate planning data.',
      'Keep execution data accurate for productivity and cost KPIs.',
      'Record each rework cycle instead of replacing previous production data.',
      'Complete quality checks before marking the part ready for customer confirmation.',
      'Use PDF download when a request summary is needed outside the application.',
    ],
  },
  manager: {
    label: 'Manager',
    color: '#185FA5',
    quickStart: [
      'Review operational KPIs on the Dashboard.',
      'Use Performance and Management dashboards to track service level and productivity.',
      'Open Cost Dashboard to review actual production costs.',
      'Monitor overdue work and workload distribution.',
      'Use Excel exports for reporting and analysis.',
    ],
    responsibilities: [
      'Track lead time, on-time delivery, backlog, rework, and productivity.',
      'Analyze cost variance by site, material, printer, and technician.',
      'Use planning views to understand workload pressure and bottlenecks.',
      'Review archive and reports for historical performance.',
    ],
  },
  administrator: {
    label: 'Administrator',
    color: '#A32D2D',
    quickStart: [
      'Manage users, roles, and access.',
      'Manage sites, printers, materials, and categories.',
      'Configure material stock levels and minimum stock thresholds.',
      'Supervise system setup, imports, exports, and master data quality.',
      'Check notifications, alerts, and dashboards for configuration issues.',
    ],
    responsibilities: [
      'Maintain clean master data for users, materials, printers, categories, and sites.',
      'Set material thresholds so low stock alerts are meaningful.',
      'Ensure email and export features are configured correctly.',
      'Use administration tools to keep the system aligned with the real process.',
    ],
  },
};

const WORKFLOW_STEPS = [
  { status: 'Submitted', role: 'Requester', color: '#3b82f6', action: 'Requester submits a complete request with site, files, quantity, and technical context.', email: 'Production Technicians are notified in-app.' },
  { status: 'Info Required', role: 'Production Technician / Requester', color: '#f59e0b', action: 'Production asks for missing details; requester edits and resubmits.', email: 'Requester receives an automatic email.' },
  { status: 'Approved', role: 'Production Technician', color: '#22c55e', action: 'Request is validated and a due date can be confirmed.', email: 'Requester receives status notification.' },
  { status: 'Planned', role: 'Production Technician', color: '#06b6d4', action: 'Production downloads the STL, slices it externally, then enters material, printer, material usage per part, and print time per part.', email: 'No requester email by default.' },
  { status: 'Assigned', role: 'Production Technician', color: '#a855f7', action: 'Production staff and printers are assigned and execution can start.', email: 'Assigned staff receive in-app notification.' },
  { status: 'Printing', role: 'Production Technician', color: '#3b82f6', action: 'Production starts execution and records start time.', email: 'Production staff can be notified in-app.' },
  { status: 'Printed', role: 'Production Technician', color: '#10b981', action: 'Production records printed quantity, material used, print end time, and actual cost.', email: 'Production staff are notified for quality follow-up.' },
  { status: 'Rework Required', role: 'Production Technician', color: '#f97316', action: 'A new production cycle is required. Quantities, material, and cost are accumulated, not replaced.', email: 'Requester and production staff receive in-app notification.' },
  { status: 'Waiting Customer Confirmation', role: 'Production Technician', color: '#06b6d4', action: 'Production work is operationally complete; the request counts as completed for KPIs.', email: 'Requester receives an automatic confirmation email.' },
  { status: 'Completed', role: 'Requester / System', color: '#22c55e', action: 'Requester confirms reception, or the system completes automatically after 7 days.', email: 'Production staff receive completion notification.' },
  { status: 'Archived', role: 'Production Technician / Administrator', color: '#475569', action: 'Historical record is kept and still counted in completed KPIs.', email: 'No automatic requester email by default.' },
  { status: 'Rejected', role: 'Production Technician', color: '#ef4444', action: 'Request is rejected with reason and comments.', email: 'Requester receives an automatic rejection email.' },
];

const WHATS_NEW = [
  ['Site Management', 'Every request is associated with a site. Administrators manage the site list.'],
  ['Cost Management', 'Actual production costs are recorded from completed production activity and material usage.'],
  ['Cost Dashboard', 'Costs are analyzed by site, material, printer, and technician with Excel export.'],
  ['Technician Schedule', 'Planning now includes workload by technician, load indicators, overdue work, and assigned requests.'],
  ['Rework Tracking', 'Each rework is stored as a production cycle and totals are accumulated.'],
  ['Low Stock Alerts', 'Materials have minimum thresholds with system notifications and email alerts.'],
  ['Overdue Alerts', 'Late requests trigger system notifications and email alerts to production technicians and administrators.'],
  ['Email Notifications', 'Requesters receive automatic emails for info required, rejection, and customer confirmation.'],
  ['PDF Export', 'Technicians can download a readable request PDF summary.'],
  ['Excel Export', 'Reports include request, workload, material, KPI, and archive exports.'],
];

const KPI_SECTIONS = [
  {
    title: 'Operational KPIs',
    items: [
      ['Open Requests', 'Requests still requiring action. Waiting Customer Confirmation is not counted as open.'],
      ['Overdue Requests', 'Requests past requested or approved due date and not operationally complete.'],
      ['Lead Time', 'Time from submission to operational completion.'],
      ['On-Time Delivery', 'Completed requests delivered on or before due date.'],
    ],
  },
  {
    title: 'Cost KPIs',
    items: [
      ['Actual Cost Total', 'Actual production cost accumulated from completed production activity.'],
      ['Cost per Site', 'Actual cost split by site.'],
      ['Cost per Material', 'Cost split by selected material.'],
      ['Cost per Printer', 'Cost split by printer.'],
      ['Cost per Technician', 'Cost split by assigned technician.'],
    ],
  },
];

const PLANNING_VIEWS = [
  ['Board', 'Kanban workflow view with filters and KPI summary. Use it to identify bottlenecks, overdue work, and blocked requests.'],
  ['Printer Schedule', 'Groups active jobs by printer, showing workload, planned hours, actual hours, overdue jobs, and priority.'],
  ['Technician Schedule', 'Groups active work by technician with load indicators, assigned jobs, overdue requests, and workload totals.'],
];

const STOCK_TOPICS = [
  ['Materials', 'Materials are managed with stock quantity, available quantity, reserved quantity, unit, and threshold.'],
  ['Minimum Stock Threshold', 'Each material can define a minimum threshold used to detect low stock.'],
  ['Low Stock Alerts', 'When available stock drops below threshold, the system creates notifications and emails production technicians and administrators once per low-stock cycle.'],
  ['Stock Recalculation', 'Production Technicians and administrators can recalculate stock from reservation records when quantities drift.'],
];

const navIcons = {
  dashboard: 'Dashboard',
  requests: 'Requests',
  new: 'New',
  planning: 'Planning',
  performance: 'Performance',
  management: 'Management',
  archive: 'Archive',
  reports: 'Reports',
  admin: 'Admin',
  help: 'Help',
  bell: 'Notifications',
  profile: 'Profile',
};

const sectionsBase = [
  { key: 'welcome', label: 'Welcome' },
  { key: 'workflow', label: 'Workflow' },
  { key: 'role', label: 'My Role' },
  { key: 'new', label: "What's New" },
  { key: 'kpis', label: 'KPIs' },
  { key: 'planning', label: 'Planning' },
  { key: 'stock', label: 'Stock' },
];

function InfoList({ items }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
      {items.map(([title, text]) => (
        <div key={title} style={{ padding: '0.75rem', background: 'var(--bg-hover)', borderRadius: 6 }}>
          <div style={{ fontSize: '0.84rem', fontWeight: 700 }}>{title}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.25rem', lineHeight: 1.5 }}>{text}</div>
        </div>
      ))}
    </div>
  );
}

export default function OnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('welcome');

  const roleData = ROLE_GUIDES[normalizeRole(user?.role)] || ROLE_GUIDES.requester;
  const navigationMap = getNavigationMapItems(user?.role);
  const canImport = user?.role === 'administrator' || isProductionTechnician(user?.role);
  const sections = canImport ? [...sectionsBase, { key: 'migration', label: 'Migration' }] : sectionsBase;

  return (
    <div className="page">
      <Sidebar />
      <div className="main-content">
        <div className="page-header">
          <div>
            <h1 style={{ fontSize: '1.3rem', fontFamily: 'var(--font-heading)' }}>Getting Started</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
              Role guide for {user?.firstName} {user?.lastName} - {roleData.label}
            </p>
          </div>
        </div>

        <div className="page-body">
          <div className="tabs" style={{ marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            {sections.map(s => (
              <button key={s.key} className={`tab ${activeSection === s.key ? 'active' : ''}`} onClick={() => setActiveSection(s.key)}>
                {s.label}
              </button>
            ))}
          </div>

          {activeSection === 'welcome' && (
            <div>
              <div className="card" style={{ marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.1rem', fontFamily: 'var(--font-heading)', marginBottom: '0.75rem' }}>Welcome to 3D Print Manager</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', lineHeight: 1.7, margin: 0 }}>
                  This application manages the full 3D printing request lifecycle: request submission, site assignment, feasibility,
                  planning, technician execution, rework cycles, quality checks, stock control, cost tracking, notifications,
                  dashboards, PDF exports, and Excel reports.
                </p>
              </div>

              <div className="grid-2" style={{ gap: '1rem' }}>
                <div className="card">
                  <h3 style={{ fontSize: '0.9rem', color: roleData.color, marginBottom: '1rem' }}>Quick Start for {roleData.label}</h3>
                  {roleData.quickStart.map((step, i) => (
                    <div key={step} style={{ display: 'flex', gap: '0.75rem', padding: '0.6rem 0', borderBottom: i < roleData.quickStart.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: `${roleData.color}22`, color: roleData.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800, flexShrink: 0 }}>
                        {i + 1}
                      </div>
                      <span style={{ fontSize: '0.83rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>{step}</span>
                    </div>
                  ))}
                </div>

                <div className="card">
                  <h3 style={{ fontSize: '0.9rem', color: 'var(--blue)', marginBottom: '1rem' }}>Navigation Map</h3>
                  {navigationMap.map(item => (
                    <div key={`${item.path || item.label}-${item.label}`} onClick={() => item.path && navigate(item.path)}
                      style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.55rem 0.6rem', borderRadius: 6, cursor: item.path ? 'pointer' : 'default', marginBottom: '0.25rem' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <span style={{ fontSize: '0.68rem', width: 82, color: 'var(--text-muted)', textTransform: 'uppercase', flexShrink: 0 }}>{navIcons[item.icon] || item.label}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.84rem', fontWeight: 700 }}>{item.label}</div>
                        <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{item.desc}</div>
                        {item.children?.length > 0 && (
                          <div style={{ marginTop: '0.3rem', display: 'flex', flexDirection: 'column', gap: '0.12rem' }}>
                            {item.children.map(child => (
                              <span key={child} style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>- {child}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      {item.path && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>-&gt;</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeSection === 'workflow' && (
            <div className="card">
              <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>Current Workflow</h3>
              {WORKFLOW_STEPS.map((s, i) => (
                <div key={s.status} style={{ display: 'grid', gridTemplateColumns: '180px 150px 1fr 1fr', gap: '0.9rem', alignItems: 'start', padding: '0.75rem 0', borderBottom: i < WORKFLOW_STEPS.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ color: s.color, fontWeight: 800 }}>{s.status}</div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>{s.role}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>{s.action}</div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{s.email}</div>
                </div>
              ))}
            </div>
          )}

          {activeSection === 'role' && (
            <div className="grid-2" style={{ gap: '1rem' }}>
              <div className="card">
                <h3 style={{ fontSize: '0.9rem', color: roleData.color, marginBottom: '1rem' }}>Your Role: {roleData.label}</h3>
                <InfoList items={roleData.responsibilities.map((text, i) => [`Responsibility ${i + 1}`, text])} />
              </div>
              <div className="card">
                <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>Recommended Routine</h3>
                <InfoList items={roleData.quickStart.map((text, i) => [`Step ${i + 1}`, text])} />
              </div>
            </div>
          )}

          {activeSection === 'new' && (
            <div className="card">
              <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>What's New</h3>
              <InfoList items={WHATS_NEW} />
            </div>
          )}

          {activeSection === 'kpis' && (
            <div className="grid-2" style={{ gap: '1rem' }}>
              {KPI_SECTIONS.map(section => (
                <div key={section.title} className="card">
                  <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>{section.title}</h3>
                  <InfoList items={section.items} />
                </div>
              ))}
            </div>
          )}

          {activeSection === 'planning' && (
            <div className="card">
              <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>Planning Views</h3>
              <InfoList items={PLANNING_VIEWS} />
              <div className="alert alert-info" style={{ marginTop: '1rem', fontSize: '0.78rem' }}>
                Planning filters include site, status, priority, technician, date range, month, year, and printer where applicable.
              </div>
            </div>
          )}

          {activeSection === 'stock' && (
            <div className="card">
              <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>Stock Management</h3>
              <InfoList items={STOCK_TOPICS} />
            </div>
          )}

          {activeSection === 'migration' && canImport && (
            <div className="card">
              <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>Monday.com Migration</h3>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: 760 }}>
                This application supports migration of historical data from Monday.com.
              </p>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: 760 }}>
                Administrators and Production Technicians can import archived requests using the dedicated migration tool.
              </p>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: 760 }}>
                Imported records are stored as historical data and do not affect active workflows, stock reservations,
                planning or notifications.
              </p>
              <button className="btn btn-primary" onClick={() => navigate('/archive/monday-import')}>
                Open Migration Tool
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
