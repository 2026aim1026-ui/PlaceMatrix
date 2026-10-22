import {
  LayoutDashboard, Search, FileText, UserCheck, FolderOpen, HelpCircle,
  Building2, Briefcase, GraduationCap, ShieldCheck, Mail, Unlock, ScrollText,
  Users, ListChecks, Star,
} from 'lucide-react';
import { ROLES } from './index';

export const STUDENT_NAV = [
  {
    section: 'Student Portal',
    items: [
      { to: '/student/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/student/opportunities', label: 'Opportunities', icon: Search },
      { to: '/student/applications', label: 'My Applications', icon: FileText },
      { to: '/student/profile', label: 'Profile Audit', icon: UserCheck },
      { to: '/student/documents', label: 'Documents', icon: FolderOpen },
      { to: '/student/help', label: 'Help & Policy', icon: HelpCircle },
    ],
  },
];

// Badge keys are resolved against live counts inside the sidebar.
export const ADMIN_NAV = {
  [ROLES.CCPC]: [
    {
      section: 'CCPC Administration',
      items: [
        { to: '/admin/dashboard', label: 'Governance Desk', icon: LayoutDashboard },
        { to: '/admin/companies', label: 'Companies & SPOCs', icon: Building2, badge: 'pendingCompanies' },
        { to: '/admin/drives', label: 'Placement Drives', icon: Briefcase },
        { to: '/admin/students', label: 'Student Records', icon: GraduationCap },
        { to: '/admin/verification-queue', label: 'Verification Desk', icon: ShieldCheck, badge: 'pendingVerifications' },
        { to: '/admin/invitations', label: 'Onboarding Invites', icon: Mail, badge: 'notInvited' },
        { to: '/admin/correction-requests', label: 'Unfreeze Tickets', icon: Unlock, badge: 'openTickets' },
        { to: '/admin/audit-trail', label: 'Audit Trail', icon: ScrollText },
      ],
    },
    {
      section: 'Drive Operations',
      items: [
        { to: '/admin/spoc/companies', label: 'Assigned Companies', icon: Building2 },
        { to: '/admin/spoc/roster', label: 'Applicant Roster', icon: Users },
        { to: '/admin/spoc/bulk-shortlist', label: 'Shortlist Parser', icon: Star },
      ],
    },
  ],
  [ROLES.VERIFIER]: [
    {
      section: 'Verification Desk',
      items: [
        { to: '/admin/verification-queue', label: 'Verification Queue', icon: ListChecks, badge: 'pendingVerifications' },
        { to: '/admin/students', label: 'Verified Records', icon: GraduationCap },
      ],
    },
  ],
  [ROLES.SPOC]: [
    {
      section: 'SPOC Operations',
      items: [
        { to: '/admin/spoc/companies', label: 'Assigned Companies', icon: Building2, badge: 'spocCompanies' },
        { to: '/admin/spoc/roster', label: 'Applicant Roster', icon: Users },
        { to: '/admin/spoc/bulk-shortlist', label: 'Shortlist Parser', icon: Star },
      ],
    },
  ],
};
