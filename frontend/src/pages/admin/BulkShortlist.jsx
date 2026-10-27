import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wand2, Eraser, FileInput, CheckCircle2, Download, Briefcase, Users } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import SearchInput from '../../components/common/SearchInput';
import FilterDropdown from '../../components/common/FilterDropdown';
import EmptyState from '../../components/common/EmptyState';
import ConfirmationDialog from '../../components/common/ConfirmationDialog';
import DataTable from '../../components/tables/DataTable';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { formatCgpa } from '../../utils/format';
import { STAGE_LABELS } from '../../constants';
import { useManagedDrive, useDriveRows, DriveHeader, exportRoster } from './ApplicantRoster';

const TARGETS = [
  { value: 'SHORTLISTED', label: 'Shortlisted' },
  { value: 'ASSESSMENT', label: 'Assessment' },
  { value: 'INTERVIEW', label: 'Interview' },
  { value: 'OFFERED', label: 'Offered / Selected (triggers policy lock)' },
  { value: 'REJECTED', label: 'Rejected' },
];

const CHIP_TONES = {
  READY: 'bg-success-50 text-success ring-success/20',
  SKIPPED: 'bg-warning-50 text-amber-700 ring-warning/25',
  NOT_APPLICANT: 'bg-danger-50 text-danger ring-danger/20',
  INVALID: 'bg-danger-50 text-danger ring-danger/20',
  DUPLICATE: 'bg-canvas text-ink-soft ring-line',
};

const CHIP_SUFFIX = {
  READY: '',
  SKIPPED: ' — skipped',
  NOT_APPLICANT: ' — not an applicant',
  INVALID: ' — bad format',
  DUPLICATE: ' — duplicate',
};

export default function BulkShortlist() {
  const { db, repo } = useData();
  const toast = useToast();
  const { drive, setDrive, options, company } = useManagedDrive();
  const rows = useDriveRows(drive);
  const [text, setText] = useState('');
  const [target, setTarget] = useState('SHORTLISTED');
  const [parsed, setParsed] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);

  // Results become stale when the drive or target stage changes.
  useEffect(() => { setParsed(null); }, [drive?.id, target]);

  if (!drive) {
    return (
      <>
        <PageHeader title="Bulk Shortlist Parser" description="Paste the roll numbers the recruiter emailed back after each round." />
        <div className="card"><EmptyState icon={Briefcase} title="No drives assigned" description="Create a JAF from Assigned Companies before shortlisting." action={<Link to="/admin/spoc/companies" className="btn btn-primary btn-sm">Assigned Companies</Link>} /></div>
      </>
    );
  }

  // Parsing runs on the server against the live database (same regex and rules as the batch itself).
  const onParse = async () => {
    if (!text.trim()) {
      toast.warning('Nothing to parse', 'Paste roll numbers from the recruiter email first.');
      return;
    }
    setBusy(true);
    const res = await repo.previewShortlist(drive.id, text, target);
    setBusy(false);
    if (res.ok) setParsed(res.result);
    else toast.error('Could not parse', res.error);
  };

  const loadSample = () => {
    const applicantRolls = rows.filter((r) => r.stage !== 'WITHDRAWN').map((r) => r.student.roll).slice(0, 3);
    const applied = new Set(rows.map((r) => r.studentId));
    const outsider = db.students.find((s) => !applied.has(s.id)) || { roll: '2026MEB1099' };
    const parts = [];
    if (applicantRolls.length) parts.push(applicantRolls.slice(0, 2).join(', '));
    if (applicantRolls[2]) parts.push(applicantRolls[2]);
    if (applicantRolls[0]) parts.push(applicantRolls[0]); // duplicate
    if (outsider) parts.push(outsider.roll);
    parts.push('XYZ 2026CSB10');
    setText(parts.join('\n'));
    setParsed(null);
  };

  const ready = parsed?.rows.filter((r) => r.status === 'READY') || [];

  const apply = async () => {
    const res = await repo.executeShortlist(drive.id, text, target);
    setConfirm(false);
    if (res.ok) {
      const { moved, skipped, preview } = res.result;
      toast.success(`Batch executed → ${moved.length} candidate(s)`,
        `Moved to ${STAGE_LABELS[target]}.${skipped.length ? ` ${skipped.length} skipped.` : ''} Audit log updated.`);
      setParsed(preview);
    } else {
      toast.error('Batch not applied', res.error);
    }
  };

  const rosterRows = rows.filter((r) => {
    const t = q.trim().toLowerCase();
    return !t || `${r.student.roll} ${r.student.name}`.toLowerCase().includes(t);
  });

  const s = parsed?.stats;

  return (
    <>
      <PageHeader
        title="Bulk Shortlist Parser"
        description="Paste the roll numbers the recruiter emailed back after each round."
        actions={<FilterDropdown label="Drive" value={drive.id} onChange={setDrive} options={options} showAll={false} className="w-full sm:w-80" />}
      />

      <DriveHeader drive={drive} company={company} />

      <section className="card card-pad mb-4">
        <h2 className="card-title">Bulk Roll-Number Shortlist Parser</h2>
        <p className="mt-0.5 text-xs text-ink-muted">Paste roll numbers straight from the recruiter&apos;s email — commas, spaces or new lines all work. No CSV upload needed.</p>
        <label htmlFor="roll-input" className="sr-only">Roll numbers</label>
        <textarea
          id="roll-input"
          rows={6}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'2026CSB1033, 2026AIB1026\n2026MCB1019'}
          className="input mono mt-3 resize-y"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label htmlFor="target-stage" className="text-xs font-medium text-ink-soft">Move to stage</label>
          <select id="target-stage" className="input h-9 w-auto text-[13px]" value={target} onChange={(e) => setTarget(e.target.value)}>
            {TARGETS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <button type="button" className="btn btn-primary" onClick={onParse} disabled={busy}><Wand2 className="h-4 w-4" /> {busy ? 'Parsing…' : 'Parse'}</button>
          <button type="button" className="btn btn-secondary" onClick={loadSample}><FileInput className="h-4 w-4" /> Load sample</button>
          <button type="button" className="btn btn-ghost" onClick={() => { setText(''); setParsed(null); }} disabled={!text && !parsed}><Eraser className="h-4 w-4" /> Clear</button>
          <button type="button" className="btn btn-success sm:ml-auto" onClick={() => setConfirm(true)} disabled={ready.length === 0}>
            <CheckCircle2 className="h-4 w-4" /> Apply to {ready.length} candidate{ready.length === 1 ? '' : 's'}
          </button>
        </div>

        {parsed && (
          <div className="mt-4 border-t border-line pt-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                ['Ready', s.ready, 'border-success/30 bg-success-50/50 text-success'],
                ['Skipped', s.skipped, 'border-warning/30 bg-warning-50/60 text-amber-700'],
                ['Not applicants', s.notApplicants, 'border-danger/25 bg-danger-50/60 text-danger'],
                ['Invalid / duplicate', s.invalid + s.duplicates, 'border-line bg-canvas text-ink-soft'],
              ].map(([label, value, cls]) => (
                <div key={label} className={`rounded-lg border p-3 ${cls}`}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide">{label}</p>
                  <p className="text-2xl font-bold">{value}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-ink-muted">{s.total} token(s) parsed · {s.valid} valid roll number(s) · {s.duplicates} duplicate(s) · {s.invalid} invalid</p>

            {parsed.rows.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {parsed.rows.map((r) => (
                  <span key={r.index} className={`mono rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${CHIP_TONES[r.status]}`} title={r.message}>
                    {r.raw}{CHIP_SUFFIX[r.status]}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-4 overflow-x-auto rounded-lg border border-line">
              <table className="table-base">
                <thead>
                  <tr><th>#</th><th>Token</th><th>Student</th><th>Current stage</th><th>Result</th><th>Message</th></tr>
                </thead>
                <tbody>
                  {parsed.rows.map((r, i) => (
                    <tr key={r.index}>
                      <td className="text-xs text-ink-muted">{i + 1}</td>
                      <td className="mono">{r.raw}</td>
                      <td className="whitespace-nowrap">{r.student ? r.student.name : '—'}</td>
                      <td>{r.application ? <StatusBadge status={r.application.stage} /> : '—'}</td>
                      <td><StatusBadge status={r.status} /></td>
                      <td className="text-xs text-ink-soft">{r.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section className="card">
        <div className="flex flex-col gap-2 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="card-title">Roster after changes</h2>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <SearchInput value={q} onChange={setQ} placeholder="Filter by roll number or name" className="sm:w-64" />
            <button type="button" className="btn btn-primary" onClick={() => exportRoster({ rows: rosterRows, drive, repo, toast, filters: { q } })}>
              <Download className="h-4 w-4" /> Export Roster (CSV)
            </button>
          </div>
        </div>
        <DataTable
          dense
          columns={[
            { key: 'roll', header: 'Roll', sortable: true, sortValue: (r) => r.student.roll, render: (r) => <span className="mono font-semibold">{r.student.roll}</span> },
            { key: 'name', header: 'Name', sortable: true, sortValue: (r) => r.student.name, render: (r) => r.student.name },
            { key: 'branch', header: 'Branch', sortable: true, sortValue: (r) => r.student.branch, render: (r) => r.student.branch },
            { key: 'cgpa', header: 'CGPA', sortable: true, sortValue: (r) => Number(r.student.cgpa), render: (r) => formatCgpa(r.student.cgpa) },
            { key: 'stage', header: 'Stage', sortable: true, render: (r) => <StatusBadge status={r.stage} /> },
          ]}
          rows={rosterRows}
          pageSize={8}
          initialSort={{ key: 'roll', dir: 'asc' }}
          empty={{ title: rows.length ? 'No applicants match' : 'No applicants yet', description: rows.length ? 'Try a different search.' : 'Applicants appear here as students apply.', icon: Users }}
        />
      </section>

      <ConfirmationDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={apply}
        tone={target === 'REJECTED' ? 'danger' : 'success'}
        title={`Apply to ${ready.length} candidate${ready.length === 1 ? '' : 's'}?`}
        confirmLabel="Execute batch"
        message={(
          <>
            <p>{ready.map((r) => r.roll).join(', ')} will move to <strong>{STAGE_LABELS[target]}</strong> in {company?.name} — {drive.role}. Skipped, invalid and non-applicant entries are not touched.</p>
            {target === 'OFFERED' && (
              <p className="mt-2 rounded-md bg-warning-50 px-2.5 py-2 text-xs text-amber-800">Policy lock: selected students are marked placed and their other active applications are auto-withdrawn.</p>
            )}
          </>
        )}
      />
    </>
  );
}
