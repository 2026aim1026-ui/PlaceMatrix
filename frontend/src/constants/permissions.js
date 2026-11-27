import { ROLES } from './index';

// UI permission map. Used by RoleGuard, the sidebar and action buttons to hide what a role cannot do.
// The FastAPI backend enforces the same rules on every request (the real security boundary).
export const PERMISSIONS = {
  'admin.dashboard': [ROLES.CDPC],
  'admin.students': [ROLES.CDPC, ROLES.VERIFIER],
  'admin.companies': [ROLES.CDPC],
  'admin.drives': [ROLES.CDPC],
  'admin.verification': [ROLES.CDPC, ROLES.VERIFIER],
  'admin.corrections': [ROLES.CDPC],
  'admin.spoc': [ROLES.SPOC, ROLES.CDPC],
  'admin.invitations': [ROLES.CDPC],
  'admin.audit': [ROLES.CDPC],
  'admin.analytics': [ROLES.CDPC],
  'admin.users': [ROLES.CDPC],
  'admin.recruitments': [ROLES.CDPC],
  'admin.email': [ROLES.CDPC, ROLES.SPOC],
  'admin.assigned': [ROLES.VERIFIER],
  // fine-grained actions
  'drive.extendDeadline': [ROLES.CDPC],
  'drive.create': [ROLES.CDPC, ROLES.SPOC],
  'company.manage': [ROLES.CDPC],
  'profile.verify': [ROLES.CDPC, ROLES.VERIFIER],
  'ticket.resolve': [ROLES.CDPC],
  'student.unlock': [ROLES.CDPC],
  'recruitment.assign': [ROLES.CDPC],
  'email.send': [ROLES.CDPC, ROLES.SPOC],
  'email.test': [ROLES.CDPC],
};

export function can(role, permission) {
  return Boolean(PERMISSIONS[permission]?.includes(role));
}

export const ROLE_HOME = {
  STUDENT: '/student/dashboard',
  CDPC: '/admin/dashboard',
  VERIFIER: '/admin/verification-queue',
  SPOC: '/admin/spoc/companies',
};
