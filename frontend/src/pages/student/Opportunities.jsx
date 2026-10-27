import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlarmClock, SearchX, SlidersHorizontal } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import SearchInput from '../../components/common/SearchInput';
import FilterDropdown from '../../components/common/FilterDropdown';
import Tabs from '../../components/common/Tabs';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';
import Countdown from '../../components/common/Countdown';
import OpportunityCard from '../../components/student/OpportunityCard';
import EligibilityChecklist from '../../components/student/EligibilityChecklist';
import { useApply } from '../../components/student/useApply';
import { useStudentData } from '../../hooks/useStudentData';
import { useNow } from '../../hooks/useNow';
import { JOB_CATEGORIES } from '../../constants';
import { formatCtc } from '../../utils/format';

const PACKAGES = [
  { value: '0-20', label: 'Up to ₹20 LPA' },
  { value: '20-30', label: '₹20–30 LPA' },
  { value: '30-100', label: '₹30 LPA +' },
];

export default function Opportunities() {
  const { student, drives, resumes } = useStudentData();
  const apply = useApply();
  const now = useNow(30000);
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [pkg, setPkg] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('deadline');
  const [why, setWhy] = useState(null);

  const isOpen = (d) => d.status === 'OPEN' && new Date(d.deadline).getTime() > now;

  const counts = useMemo(() => ({
    all: drives.length,
    eligible: drives.filter((d) => d.eligibility.eligible && !d.application).length,
    ineligible: drives.filter((d) => !d.eligibility.eligible && !d.application).length,
    applied: drives.filter((d) => d.application).length,
  }), [drives]);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    let out = drives.filter((d) => {
      if (tab === 'eligible' && !(d.eligibility.eligible && !d.application)) return false;
      if (tab === 'ineligible' && !(!d.eligibility.eligible && !d.application)) return false;
      if (tab === 'applied' && !d.application) return false;
      if (term && !`${d.company.name} ${d.role} ${d.location}`.toLowerCase().includes(term)) return false;
      if (category && d.category !== category) return false;
      if (pkg) {
        const [lo, hi] = pkg.split('-').map(Number);
        if (d.ctc < lo || d.ctc >= hi) return false;
      }
      if (status === 'open' && !isOpen(d)) return false;
      if (status === 'closed' && isOpen(d)) return false;
      if (status === 'not-applied' && d.application) return false;
      return true;
    });
    out = [...out].sort((a, b) => {
      if (sort === 'package') return b.ctc - a.ctc;
      if (sort === 'company') return a.company.name.localeCompare(b.company.name);
      // deadline: open drives first by soonest, then closed
      const ao = isOpen(a) ? 0 : 1;
      const bo = isOpen(b) ? 0 : 1;
      return ao - bo || new Date(a.deadline) - new Date(b.deadline);
    });
    return out;
  }, [drives, tab, q, category, pkg, status, sort, now]); // eslint-disable-line react-hooks/exhaustive-deps

  const next = drives
    .filter((d) => isOpen(d) && d.eligibility.eligible && !d.application)
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))[0];

  const filtersActive = q || category || pkg || status;

  return (
    <>
      <PageHeader
        title="Opportunities"
        description="Eligibility is evaluated instantly against your verified record. Ineligible drives show the exact reason."
      />

      {next && (
        <div className="mb-4 flex flex-col gap-2 rounded-xl bg-navy px-4 py-3 text-white sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-sm">
            <AlarmClock className="h-4 w-4 text-warning" aria-hidden />
            Next deadline you are eligible for: <strong>{next.company.name} — {next.role}</strong> ({formatCtc(next.ctc)})
          </p>
          <p className="flex items-center gap-3 text-sm">
            <Countdown to={next.deadline} className="text-base font-bold !text-white" />
            <Link to={`/student/opportunities/${next.id}`} className="btn btn-sm bg-white text-navy hover:bg-white/90">View</Link>
          </p>
        </div>
      )}

      <div className="mb-4 space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Tabs
            value={tab}
            onChange={setTab}
            label="Opportunity filter"
            tabs={[
              { value: 'all', label: 'All', count: counts.all },
              { value: 'eligible', label: 'Eligible', count: counts.eligible },
              { value: 'ineligible', label: 'Ineligible', count: counts.ineligible },
              { value: 'applied', label: 'Applied', count: counts.applied },
            ]}
          />
          <SearchInput value={q} onChange={setQ} placeholder="Search company or role" className="lg:w-72" label="Search opportunities" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-ink-muted" aria-hidden />
          <FilterDropdown label="Category" value={category} onChange={setCategory} options={JOB_CATEGORIES} />
          <FilterDropdown label="Package" value={pkg} onChange={setPkg} options={PACKAGES} allLabel="Any" />
          <FilterDropdown
            label="Status"
            value={status}
            onChange={setStatus}
            options={[{ value: 'open', label: 'Open now' }, { value: 'closed', label: 'Closed / frozen' }, { value: 'not-applied', label: 'Not applied' }]}
          />
          <FilterDropdown
            label="Sort"
            value={sort}
            onChange={setSort}
            showAll={false}
            options={[{ value: 'deadline', label: 'Sort: Deadline' }, { value: 'package', label: 'Sort: Package (high → low)' }, { value: 'company', label: 'Sort: Company (A–Z)' }]}
          />
          {filtersActive && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setQ(''); setCategory(''); setPkg(''); setStatus(''); }}>Clear filters</button>
          )}
          <span className="ml-auto text-xs text-ink-muted">{list.length} drive{list.length === 1 ? '' : 's'}</span>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="card">
          <EmptyState icon={SearchX} title="No opportunities match" description="Try a different tab, search term or filter." />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {list.map((d) => (
            <OpportunityCard key={d.id} drive={d} resumes={resumes} defaultResumeId={student.defaultResumeId} onApply={apply} onWhy={setWhy} now={now} />
          ))}
        </div>
      )}

      <Modal
        open={Boolean(why)}
        onClose={() => setWhy(null)}
        title={why ? `Why you can't apply — ${why.company.name}` : ''}
        description={why ? `${why.role} · ${formatCtc(why.ctc)}` : ''}
        footer={(
          <>
            <Link to="/student/profile" className="btn btn-secondary">Review my profile</Link>
            <button type="button" className="btn btn-primary" onClick={() => setWhy(null)}>Got it</button>
          </>
        )}
      >
        {why && (
          <>
            <p className="mb-3 text-sm text-ink-soft">Each rule is checked against your verified academic record:</p>
            <EligibilityChecklist checks={why.eligibility.checks} />
            <p className="mt-3 text-xs text-ink-muted">If a value on your record is wrong, raise a correction request from Profile Audit.</p>
          </>
        )}
      </Modal>
    </>
  );
}
