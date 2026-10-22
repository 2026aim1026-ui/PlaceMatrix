import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, Briefcase, Users, Clock, Plus, Zap, Pencil, Mail, AlertTriangle } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import StatusBadge from '../../components/common/StatusBadge';
import EmptyState from '../../components/common/EmptyState';
import Countdown from '../../components/common/Countdown';
import DriveFormModal from '../../components/admin/DriveFormModal';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { ROLES } from '../../constants';
import { formatCtc } from '../../utils/format';
import { formatDate } from '../../utils/dateUtils';

export default function SpocCompanies() {
  const { db, adminById, studentById } = useData();
  const me = useCurrentUser();
  const { loginAs } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [modal, setModal] = useState(null); // { company, drive }

  const isSpoc = me.role === ROLES.SPOC;
  const companies = useMemo(() => db.companies
    .filter((c) => c.status === 'APPROVED')
    .filter((c) => (isSpoc ? c.spocId === me.admin?.id : true))
    .sort((a, b) => a.name.localeCompare(b.name)), [db.companies, isSpoc, me.admin]);

  const companyIds = new Set(companies.map((c) => c.id));
  const drives = db.drives.filter((d) => companyIds.has(d.companyId));
  const driveIds = new Set(drives.map((d) => d.id));
  const apps = db.applications.filter((a) => driveIds.has(a.driveId));
  const liveDrives = drives.filter((d) => d.status === 'OPEN' && new Date(d.deadline).getTime() > Date.now()).length;
  const pendingActions = apps.filter((a) => a.stage === 'APPLIED' || a.stage === 'UNDER_REVIEW').length;

  const linked = isSpoc && me.admin?.linkedStudentId ? studentById.get(me.admin.linkedStudentId) : null;

  const switchToCandidate = () => {
    const res = loginAs(linked.email);
    if (res.ok) {
      navigate('/student/opportunities');
      toast.info('Switched to candidate feed', `You are now browsing as ${linked.name} (${linked.roll}).`);
    } else {
      toast.error('Could not switch', res.error);
    }
  };

  return (
    <>
      <PageHeader
        title="Assigned Companies"
        description="CCPC assigns you a company after its emailed form is approved. You create the JAF and its deadline, then coordinate applicants."
      />

      {linked && (
        <div className="mb-4 flex flex-col gap-2 rounded-xl border border-brand/20 bg-brand-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink"><strong>You are also a candidate.</strong> Browse drives and apply to other companies with your own profile.</p>
          <button type="button" className="btn btn-primary btn-sm shrink-0" onClick={switchToCandidate}><Zap className="h-3.5 w-3.5" /> Switch to My Candidate Feed</button>
        </div>
      )}

      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Building2} label={isSpoc ? 'Assigned companies' : 'Approved companies'} value={companies.length} tone="blue" />
        <StatCard icon={Briefcase} label="Live drives" value={liveDrives} tone="green" />
        <StatCard icon={Users} label="Total applicants" value={apps.length} tone="violet" />
        <StatCard icon={Clock} label="Pending stage actions" value={pendingActions} tone="amber" hint="Applied + under review" />
      </section>

      {companies.length === 0 ? (
        <div className="card">
          <EmptyState icon={Building2} title="No companies assigned yet" description="CCPC will assign companies to you once their recruiter forms are approved." />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {companies.map((c) => {
            const cDrives = drives.filter((d) => d.companyId === c.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            const published = cDrives.some((d) => d.status !== 'DRAFT');
            const spoc = adminById.get(c.spocId);
            return (
              <article key={c.id} className="card card-pad flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="eyebrow !text-brand">{c.name}</p>
                    <p className="mt-1 flex items-center gap-1 truncate text-xs text-ink-muted"><Mail className="h-3 w-3 shrink-0" /> Recruiter: {c.recruiterEmail}</p>
                    <p className="text-xs text-ink-muted">Approved by CCPC on {formatDate(c.approvedAt)}</p>
                    {!isSpoc && <p className="text-xs text-ink-muted">SPOC: <strong className="text-ink">{spoc?.name || 'Unassigned'}</strong></p>}
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm shrink-0"
                    disabled={!c.active}
                    onClick={() => setModal({ company: c, drive: null })}
                  >
                    <Plus className="h-3.5 w-3.5" /> Create JAF
                  </button>
                </div>

                {!c.active && (
                  <p className="mt-3 rounded-md bg-canvas px-3 py-2 text-xs text-ink-soft">This company is inactive. CCPC must reactivate it before new JAFs can be published.</p>
                )}

                {cDrives.length > 0 && (
                  <ul className="mt-3 divide-y divide-line rounded-lg border border-line">
                    {cDrives.map((d) => {
                      const count = db.applications.filter((a) => a.driveId === d.id).length;
                      const closed = new Date(d.deadline).getTime() <= Date.now();
                      return (
                        <li key={d.id} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-ink">
                              {d.role} <span className="font-normal text-ink-soft">· {formatCtc(d.ctc)}</span> <StatusBadge status={d.status} />
                            </p>
                            <p className="text-[11.5px] text-ink-muted">
                              {count} applicant{count === 1 ? '' : 's'} · {closed ? 'closed' : <>closes in <Countdown to={d.deadline} className="font-semibold text-ink" /></>}
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <Link to={`/admin/spoc/roster?drive=${d.id}`} className="btn btn-secondary btn-xs">Roster</Link>
                            <Link to={`/admin/spoc/bulk-shortlist?drive=${d.id}`} className="btn btn-secondary btn-xs">Parser</Link>
                            <button type="button" className="btn btn-ghost btn-xs" onClick={() => setModal({ company: c, drive: d })} aria-label={`Edit ${d.role}`}><Pencil className="h-3.5 w-3.5" /> Edit</button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {!published && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-50 px-3 py-2.5 text-xs text-amber-800">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span><strong>JAF not created yet</strong> — Students cannot see this company until you publish its JAF with a deadline.</span>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <DriveFormModal
        open={Boolean(modal)}
        onClose={() => setModal(null)}
        drive={modal?.drive || null}
        companyId={modal?.company.id}
        lockCompany
        companies={modal ? [modal.company] : []}
      />
    </>
  );
}
