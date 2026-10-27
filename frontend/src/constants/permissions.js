import { ROLES } from './index';

// UI permission map. Used by RoleGuard, the sidebar and action buttons to hide what a role cannot do.
// The FastAPI backend enforces the same rules on every request (the real security boundary).
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
  'admin.analytics': [ROLES.CCPC],
  'admin.users': [ROLES.CCPC],
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
