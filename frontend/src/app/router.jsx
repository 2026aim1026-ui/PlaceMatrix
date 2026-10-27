import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from '../components/common/ProtectedRoute';
import RoleGuard from '../components/common/RoleGuard';
import StudentLayout from '../components/layout/StudentLayout';
import AdminLayout from '../components/layout/AdminLayout';
import { useAuth } from '../context/AuthContext';
import { ROLE_HOME } from '../constants/permissions';

import LoginPage from '../pages/auth/LoginPage';
import ActivatePage from '../pages/auth/ActivatePage';
import NotFound from '../pages/NotFound';

import StudentDashboard from '../pages/student/StudentDashboard';
import Opportunities from '../pages/student/Opportunities';
import OpportunityDetail from '../pages/student/OpportunityDetail';
import ProfileAudit from '../pages/student/ProfileAudit';
import Documents from '../pages/student/Documents';
import MyApplications from '../pages/student/MyApplications';
import ApplicationConfirmation from '../pages/student/ApplicationConfirmation';
import HelpPolicy from '../pages/student/HelpPolicy';
import Invitation from '../pages/student/Invitation';

import GovernanceDesk from '../pages/admin/GovernanceDesk';
import StudentDirectory from '../pages/admin/StudentDirectory';
import Companies from '../pages/admin/Companies';
import Drives from '../pages/admin/Drives';
import VerificationQueue from '../pages/admin/VerificationQueue';
import DocumentReview from '../pages/admin/DocumentReview';
import CorrectionRequests from '../pages/admin/CorrectionRequests';
import SpocCompanies from '../pages/admin/SpocCompanies';
import ApplicantRoster from '../pages/admin/ApplicantRoster';
import BulkShortlist from '../pages/admin/BulkShortlist';
import Invitations from '../pages/admin/Invitations';
import AuditTrail from '../pages/admin/AuditTrail';
import Analytics from '../pages/admin/Analytics';
import Users from '../pages/admin/Users';

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
          <Route path="invitation" element={<Invitation />} />
          <Route path="dashboard" element={<StudentDashboard />} />
          <Route path="opportunities" element={<Opportunities />} />
          <Route path="opportunities/:id" element={<OpportunityDetail />} />
          <Route path="profile" element={<ProfileAudit />} />
          <Route path="documents" element={<Documents />} />
          <Route path="applications" element={<MyApplications />} />
          <Route path="applications/:id/confirmation" element={<ApplicationConfirmation />} />
          <Route path="help" element={<HelpPolicy />} />
          <Route path="*" element={<NotFound inline />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute portal="admin" />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminIndex />} />
          <Route element={<RoleGuard permission="admin.dashboard" />}>
            <Route path="dashboard" element={<GovernanceDesk />} />
          </Route>
          <Route element={<RoleGuard permission="admin.students" />}>
            <Route path="students" element={<StudentDirectory />} />
          </Route>
          <Route element={<RoleGuard permission="admin.companies" />}>
            <Route path="companies" element={<Companies />} />
          </Route>
          <Route element={<RoleGuard permission="admin.drives" />}>
            <Route path="drives" element={<Drives />} />
          </Route>
          <Route element={<RoleGuard permission="admin.verification" />}>
            <Route path="verification-queue" element={<VerificationQueue />} />
            <Route path="document-review/:id" element={<DocumentReview />} />
          </Route>
          <Route element={<RoleGuard permission="admin.corrections" />}>
            <Route path="correction-requests" element={<CorrectionRequests />} />
          </Route>
          <Route element={<RoleGuard permission="admin.spoc" />}>
            <Route path="spoc/companies" element={<SpocCompanies />} />
            <Route path="spoc/roster" element={<ApplicantRoster />} />
            <Route path="spoc/bulk-shortlist" element={<BulkShortlist />} />
          </Route>
          <Route element={<RoleGuard permission="admin.invitations" />}>
            <Route path="invitations" element={<Invitations />} />
          </Route>
          <Route element={<RoleGuard permission="admin.audit" />}>
            <Route path="audit-trail" element={<AuditTrail />} />
          </Route>
          <Route element={<RoleGuard permission="admin.analytics" />}>
            <Route path="analytics" element={<Analytics />} />
          </Route>
          <Route element={<RoleGuard permission="admin.users" />}>
            <Route path="users" element={<Users />} />
          </Route>
          <Route path="*" element={<NotFound inline />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
