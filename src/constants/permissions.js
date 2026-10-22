import { ROLES } from './index';

// Frontend-only permission map. Used by RoleGuard, the sidebar and action buttons.
// This is a UX restriction for the demo, not a security boundary.
export const PERMISSIONS = {
  'admin.dashboard': [ROLES.CCPC],
  'admin.students': [ROLES.CCPC, ROLES.VERIFIER],
  'admin.companies': [ROLES.CCPC],
  'admin.drives': [ROLES.CCPC],
  'admin.verification': [ROLES.CCPC, ROLES.VERIFIER],
  'admin.corrections': [ROLES.CCPC],
  'admin.spoc': [ROLES.SPOC, ROLES.CCPC],
  'admin.invitations': [ROLES.CCPC],
  'admin.audit': [ROLES.CCPC],
  // fine-grained actions
  'drive.extendDeadline': [ROLES.CCPC],
  'drive.create': [ROLES.CCPC, ROLES.SPOC],
  'company.manage': [ROLES.CCPC],
  'profile.verify': [ROLES.CCPC, ROLES.VERIFIER],
  'ticket.resolve': [ROLES.CCPC],
  'student.unlock': [ROLES.CCPC],
};

export function can(role, permission) {
  return Boolean(PERMISSIONS[permission]?.includes(role));
}

export const ROLE_HOME = {
  STUDENT: '/student/dashboard',
  CCPC: '/admin/dashboard',
  VERIFIER: '/admin/verification-queue',
  SPOC: '/admin/spoc/companies',
};
