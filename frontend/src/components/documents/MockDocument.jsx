import { DOC_TYPES } from '../../constants';
import { formatCgpa } from '../../utils/format';

// A rendered stand-in for a document when no real file contents are available (record without a stored file).
// Values come from the student's proof record so the verifier can compare against the claimed values.

const INSTITUTE = 'PlaceMatrix Demo Institute of Technology';

function Header({ title, subtitle }) {
  return (
    <div className="border-b-2 border-navy pb-3 text-center">
      <div className="mx-auto mb-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-navy text-[10px] font-bold text-navy">PIT</div>
      <p className="text-[13px] font-bold uppercase tracking-wide text-navy">{INSTITUTE}</p>
      <p className="text-[10px] text-ink-muted">Rupnagar, Punjab · Office of the Registrar</p>
      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.15em] text-ink">{title}</p>
      {subtitle && <p className="text-[10px] text-ink-muted">{subtitle}</p>}
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div className="flex justify-between border-b border-dashed border-line py-1 text-[11px]">
      <span className="text-ink-muted">{k}</span>
      <span className="font-semibold text-ink">{v}</span>
    </div>
  );
}

function GradeCard({ student }) {
  const p = student.proof || {};
  const sems = student.semCgpa?.length ? student.semCgpa : [];
  return (
    <>
      <Header title="Consolidated Grade Card" subtitle={`${student.degree} · ${student.branch}`} />
      <div className="mt-3 grid grid-cols-2 gap-x-6">
        <Row k="Name" v={student.name} />
        <Row k="Entry No." v={student.roll} />
        <Row k="Programme" v={`${p.degree || student.degree}`} />
        <Row k="Discipline" v={p.branch || student.branch} />
      </div>
      <table className="mt-4 w-full text-[11px]">
        <thead>
          <tr className="bg-canvas text-ink-muted"><th className="p-1 text-left">Semester</th><th className="p-1 text-right">Credits</th><th className="p-1 text-right">SGPA</th></tr>
        </thead>
        <tbody>
          {sems.map((g, i) => (
            <tr key={i} className="border-b border-line"><td className="p-1">Semester {i + 1}</td><td className="p-1 text-right">{22 + (i % 3)}</td><td className="p-1 text-right font-semibold">{formatCgpa(g)}</td></tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 rounded-md border border-navy/30 bg-canvas p-2 text-[11px]">
        <Row k="Cumulative Grade Point Average (CGPA)" v={p.cgpa !== undefined ? formatCgpa(p.cgpa) : '—'} />
        <Row k="Active backlogs" v={p.backlogs ?? '—'} />
      </div>
    </>
  );
}

function Marksheet({ student, level }) {
  const p = student.proof || {};
  const pct = level === 10 ? p.class10 : p.class12;
  const subjects = level === 10 ? ['English', 'Hindi', 'Mathematics', 'Science', 'Social Science'] : ['English', 'Physics', 'Chemistry', 'Mathematics', 'Computer Science'];
  return (
    <>
      <div className="border-b-2 border-emerald-800 pb-3 text-center">
        <p className="text-[13px] font-bold uppercase text-emerald-900">Central Board of Secondary Education</p>
        <p className="text-[10px] text-ink-muted">{level === 10 ? 'Secondary School Examination' : 'Senior School Certificate Examination'}</p>
        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.15em]">Marks Statement cum Certificate</p>
      </div>
      <div className="mt-3"><Row k="Candidate" v={student.name} /><Row k="Roll No." v={`${level === 10 ? '1' : '2'}${student.roll.slice(-6)}${level}`} /></div>
      <table className="mt-3 w-full text-[11px]">
        <thead><tr className="bg-canvas text-ink-muted"><th className="p-1 text-left">Subject</th><th className="p-1 text-right">Marks (100)</th></tr></thead>
        <tbody>
          {subjects.map((s, i) => {
            const base = Number(pct || 80);
            const m = Math.min(100, Math.round(base + [1.2, -0.8, 0.6, -1.4, 0.4][i]));
            return <tr key={s} className="border-b border-line"><td className="p-1">{s}</td><td className="p-1 text-right font-semibold">{m}</td></tr>;
          })}
        </tbody>
      </table>
      <div className="mt-3 rounded-md border border-emerald-800/30 bg-emerald-50/50 p-2"><Row k="Aggregate percentage" v={pct !== undefined ? `${Number(pct).toFixed(2)} %` : '—'} /></div>
    </>
  );
}

function Resume({ student, doc }) {
  return (
    <>
      <div className="border-b border-ink/20 pb-2">
        <p className="text-lg font-bold text-ink">{student.name}</p>
        <p className="text-[11px] text-ink-muted">{student.email} · {student.phone} · {student.roll}</p>
      </div>
      {[['Education', `${student.degree}, ${student.branch} — ${INSTITUTE} (CGPA ${formatCgpa(student.cgpa)})`],
        ['Skills', (student.skills || []).join(' · ') || '—'],
        ['Experience', `Software Intern — built internal tooling and data pipelines; reduced report latency by 38%.`],
        ['Projects', `${doc?.label || 'Resume'} focus: placement analytics dashboard, document OCR verifier, distributed key-value store.`],
        ['Achievements', 'Top 5% in national coding contest; teaching assistant for Data Structures.']].map(([h, t]) => (
        <div key={h} className="mt-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-brand">{h}</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-ink-soft">{t}</p>
          <div className="mt-1.5 space-y-1">{[90, 75, 82].map((w, i) => <div key={i} className="h-1.5 rounded bg-canvas" style={{ width: `${w}%` }} />)}</div>
        </div>
      ))}
    </>
  );
}

function Generic({ student, doc }) {
  return (
    <>
      <Header title={doc.label || DOC_TYPES[doc.type]?.label} subtitle={doc.fileName} />
      <div className="mt-4"><Row k="Issued to" v={student.name} /><Row k="Reference" v={student.roll} /></div>
      <div className="mt-4 space-y-2">{[95, 88, 92, 70, 85, 60].map((w, i) => <div key={i} className="h-2 rounded bg-canvas" style={{ width: `${w}%` }} />)}</div>
    </>
  );
}

export default function MockDocument({ doc, student }) {
  let body;
  if (doc.type === 'GRADE_CARD') body = <GradeCard student={student} />;
  else if (doc.type === 'CLASS10') body = <Marksheet student={student} level={10} />;
  else if (doc.type === 'CLASS12') body = <Marksheet student={student} level={12} />;
  else if (doc.type === 'RESUME') body = <Resume student={student} doc={doc} />;
  else body = <Generic student={student} doc={doc} />;
  return (
    <div className="mx-auto aspect-[1/1.32] w-full max-w-[520px] overflow-hidden bg-white p-6 shadow-md ring-1 ring-line">
      {body}
      <p className="mt-6 text-center text-[9px] uppercase tracking-widest text-ink-muted/70">Demo rendering · not an official document</p>
    </div>
  );
}
