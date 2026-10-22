import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Building2, Briefcase, GraduationCap } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { ROLES } from '../../constants';
import { formatCtc } from '../../utils/format';

/** Topbar search across drives, companies and (for admins) students. */
export default function GlobalSearch({ role }) {
  const { db, companyById } = useData();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef(null);
  const navigate = useNavigate();

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (term.length < 2) return [];
    const out = [];
    const isStudent = role === ROLES.STUDENT;
    db.drives
      .filter((d) => (isStudent ? d.status !== 'DRAFT' : true))
      .filter((d) => `${d.role} ${companyById.get(d.companyId)?.name}`.toLowerCase().includes(term))
      .slice(0, 5)
      .forEach((d) => out.push({
        key: d.id, icon: Briefcase, title: `${companyById.get(d.companyId)?.name} — ${d.role}`, sub: `${formatCtc(d.ctc)} · ${d.status}`,
        to: isStudent ? `/student/opportunities/${d.id}` : role === ROLES.CCPC ? `/admin/drives?q=${encodeURIComponent(d.role)}` : role === ROLES.SPOC ? `/admin/spoc/roster?drive=${d.id}` : null,
      }));
    if (role === ROLES.CCPC) {
      db.companies.filter((c) => c.name.toLowerCase().includes(term)).slice(0, 3).forEach((c) => out.push({
        key: c.id, icon: Building2, title: c.name, sub: c.industry, to: `/admin/companies?q=${encodeURIComponent(c.name)}`,
      }));
    }
    if (role === ROLES.CCPC || role === ROLES.VERIFIER) {
      db.students.filter((s) => `${s.name} ${s.roll}`.toLowerCase().includes(term)).slice(0, 5).forEach((s) => out.push({
        key: s.id, icon: GraduationCap, title: `${s.name}`, sub: `${s.roll} · ${s.branch} · ${s.verification}`, to: `/admin/students?open=${s.id}`,
      }));
    }
    return out.filter((r) => r.to);
  }, [q, db, companyById, role]);

  useEffect(() => {
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const go = (r) => {
    navigate(r.to);
    setQ('');
    setOpen(false);
  };

  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(results.length - 1, a + 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    if (e.key === 'Enter' && results[active]) go(results[active]);
    if (e.key === 'Escape') setOpen(false);
  };

  const placeholder = role === ROLES.STUDENT ? 'Search companies, roles…' : 'Search companies, roll numbers, names…';
  return (
    <div className="relative w-full max-w-sm" ref={ref}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden />
      <input
        type="search"
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
        placeholder={placeholder}
        aria-label="Global search"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls="global-search-results"
        className="input h-9 bg-canvas/70 pl-9 text-[13px]"
      />
      {open && q.trim().length >= 2 && (
        <div id="global-search-results" role="listbox" className="pop-in absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-line bg-white shadow-pop">
          {results.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-ink-muted">No matches for “{q}”</p>
          ) : results.map((r, i) => {
            const Icon = r.icon;
            return (
              <button
                key={r.key}
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(r)}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left ${i === active ? 'bg-canvas' : ''}`}
              >
                <Icon className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium text-ink">{r.title}</span>
                  <span className="block truncate text-[11px] text-ink-muted">{r.sub}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
