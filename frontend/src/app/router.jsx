import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import LoadingState from '../components/common/LoadingState';
import ProtectedRoute from '../components/common/ProtectedRoute';
import RoleGuard from '../components/common/RoleGuard';
import StudentLayout from '../components/layout/StudentLayout';
import AdminLayout from '../components/layout/AdminLayout';
import { useAuth } from '../context/AuthContext';
import { ROLE_HOME } from '../constants/permissions';

import LoginPage from '../pages/auth/LoginPage';
import ActivatePage from '../pages/auth/ActivatePage';
import NotFound from '../pages/NotFound';

const StudentDashboard = lazy(() => import('../pages/student/StudentDashboard'));
const Opportunities = lazy(() => import('../pages/student/Opportunities'));
const OpportunityDetail = lazy(() => import('../pages/student/OpportunityDetail'));
const ProfileAudit = lazy(() => import('../pages/student/ProfileAudit'));
const Documents = lazy(() => import('../pages/student/Documents'));
const MyApplications = lazy(() => import('../pages/student/MyApplications'));
const ApplicationConfirmation = lazy(() => import('../pages/student/ApplicationConfirmation'));
const HelpPolicy = lazy(() => import('../pages/student/HelpPolicy'));
const Invitation = lazy(() => import('../pages/student/Invitation'));

const GovernanceDesk = lazy(() => import('../pages/admin/GovernanceDesk'));
const StudentDirectory = lazy(() => import('../pages/admin/StudentDirectory'));
const Companies = lazy(() => import('../pages/admin/Companies'));
const Drives = lazy(() => import('../pages/admin/Drives'));
const VerificationQueue = lazy(() => import('../pages/admin/VerificationQueue'));
const DocumentReview = lazy(() => import('../pages/admin/DocumentReview'));
const CorrectionRequests = lazy(() => import('../pages/admin/CorrectionRequests'));
const SpocCompanies = lazy(() => import('../pages/admin/SpocCompanies'));
const ApplicantRoster = lazy(() => import('../pages/admin/ApplicantRoster'));
const BulkShortlist = lazy(() => import('../pages/admin/BulkShortlist'));
const Invitations = lazy(() => import('../pages/admin/Invitations'));
const AuditTrail = lazy(() => import('../pages/admin/AuditTrail'));
const Analytics = lazy(() => import('../pages/admin/Analytics'));
const Users = lazy(() => import('../pages/admin/Users'));
const Recruitments = lazy(() => import('../pages/admin/Recruitments'));
const EmailCenter = lazy(() => import('../pages/admin/EmailCenter'));
const AssignedRecruitments = lazy(() => import('../pages/admin/AssignedRecruitments'));

// Each page is a separate chunk downloaded on first visit, so a student never downloads the admin pages or
// the charts library. Login/activation stay in the main bundle because they are the first screens anyone sees.
function page(Component) {
  return (
    <Suspense fallback={<LoadingState />}>
      <Component />
    </Suspense>
  );
}

function HomeRedirect() {
  const { session } = useAuth();
  return <Navigate to={session ? ROLE_HOME[session.role] : '/login'} replace />;
}

function AdminIndex() {
  const { session } = useAuth();
  return <Navigate to={ROLE_HOME[session.role]} replace />;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/activate" element={<ActivatePage />} />

      <Route element={<ProtectedRoute portal="student" />}>
        <Route path="/student" element={<StudentLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="invitation" element={page(Invitation)} />
          <Route path="dashboard" element={page(StudentDashboard)} />
          <Route path="opportunities" element={page(Opportunities)} />
          <Route path="opportunities/:id" element={page(OpportunityDetail)} />
          <Route path="profile" element={page(ProfileAudit)} />
          <Route path="documents" element={page(Documents)} />
          <Route path="applications" element={page(MyApplications)} />
          <Route path="applications/:id/confirmation" element={page(ApplicationConfirmation)} />
          <Route path="help" element={page(HelpPolicy)} />
          <Route path="*" element={<NotFound inline />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute portal="admin" />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminIndex />} />
          <Route element={<RoleGuard permission="admin.dashboard" />}>
            <Route path="dashboard" element={page(GovernanceDesk)} />
          </Route>
          <Route element={<RoleGuard permission="admin.students" />}>
            <Route path="students" element={page(StudentDirectory)} />
          </Route>
          <Route element={<RoleGuard permission="admin.companies" />}>
            <Route path="companies" element={page(Companies)} />
          </Route>
          <Route element={<RoleGuard permission="admin.drives" />}>
            <Route path="drives" element={page(Drives)} />
          </Route>
          <Route element={<RoleGuard permission="admin.verification" />}>
            <Route path="verification-queue" element={page(VerificationQueue)} />
            <Route path="document-review/:id" element={page(DocumentReview)} />
          </Route>
          <Route element={<RoleGuard permission="admin.corrections" />}>
            <Route path="correction-requests" element={page(CorrectionRequests)} />
          </Route>
          <Route element={<RoleGuard permission="admin.spoc" />}>
            <Route path="spoc/companies" element={page(SpocCompanies)} />
            <Route path="spoc/roster" element={page(ApplicantRoster)} />
            <Route path="spoc/bulk-shortlist" element={page(BulkShortlist)} />
          </Route>
          <Route element={<RoleGuard permission="admin.invitations" />}>
            <Route path="invitations" element={page(Invitations)} />
          </Route>
          <Route element={<RoleGuard permission="admin.audit" />}>
            <Route path="audit-trail" element={page(AuditTrail)} />
          </Route>
          <Route element={<RoleGuard permission="admin.analytics" />}>
            <Route path="analytics" element={page(Analytics)} />
          </Route>
          <Route element={<RoleGuard permission="admin.users" />}>
            <Route path="users" element={page(Users)} />
          </Route>
          <Route element={<RoleGuard permission="admin.recruitments" />}>
            <Route path="recruitments" element={page(Recruitments)} />
          </Route>
          <Route element={<RoleGuard permission="admin.email" />}>
            <Route path="emails" element={page(EmailCenter)} />
          </Route>
          <Route element={<RoleGuard permission="admin.assigned" />}>
            <Route path="assigned-recruitments" element={page(AssignedRecruitments)} />
          </Route>
          <Route path="*" element={<NotFound inline />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
