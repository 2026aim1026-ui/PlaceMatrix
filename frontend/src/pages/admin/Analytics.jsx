import { useCallback, useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Trophy, Users, CheckCircle2, IndianRupee, Briefcase, Timer, RefreshCcw, Building2 } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import DataTable from '../../components/tables/DataTable';
import { useData } from '../../context/DataContext';
import { formatCtc } from '../../utils/format';

const AXIS = { fontSize: 11, fill: '#7A879E' };
const BRAND = '#3D5AE8';

function ChartTooltip({ active, payload, label, format = (v) => v, unit = '' }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-pop">
      <p className="font-semibold text-ink">{label}</p>
      <p className="text-ink-soft">{format(payload[0].value)}{unit}</p>
    </div>
  );
}

function Breakdown({ title, data }) {
  const entries = Object.entries(data || {}).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  return (
    <section className="card card-pad">
      <h2 className="card-title mb-3">{title}</h2>
      {entries.length === 0 ? <p className="text-xs text-ink-muted">No records yet.</p> : (
        <ul className="space-y-2">
          {entries.map(([k, v]) => (
            <li key={k} className="flex items-center gap-3 text-sm">
              <span className="w-32 shrink-0"><StatusBadge status={k} /></span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-canvas">
                <span className="block h-full rounded-full bg-brand" style={{ width: `${total ? (v / total) * 100 : 0}%` }} />
              </span>
              <span className="w-8 text-right font-semibold text-ink">{v}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** CCPC analytics: computed by the backend from PostgreSQL (GET /api/analytics/summary). */
export default function Analytics() {
  const { repo, db } = useData();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const res = await repo.fetchAnalytics();
    if (res.ok) { setData(res.result); setError(''); } else setError(res.error);
  }, [repo]);

  // Reload whenever shared state changes (new offer, verification, application...).
  useEffect(() => { load(); }, [load, db.version]);

  if (error) return <ErrorState title="Analytics unavailable" description={error} />;
  if (!data) return <LoadingState label="Computing placement analytics…" />;
  const k = data.kpis;

  const companyColumns = [
    { key: 'company', header: 'Company', sortable: true, render: (r) => <span className="font-semibold">{r.company}</span> },
    { key: 'drives', header: 'Drives', sortable: true, className: 'text-center' },
    { key: 'applicants', header: 'Applicants', sortable: true, className: 'text-center' },
    { key: 'shortlisted', header: 'Shortlisted', sortable: true, className: 'text-center' },
    { key: 'offers', header: 'Offers', sortable: true, className: 'text-center' },
    { key: 'maxCtc', header: 'Highest CTC', sortable: true, render: (r) => (r.maxCtc ? formatCtc(r.maxCtc) : '—') },
  ];
  const branchColumns = [
    { key: 'branch', header: 'Branch', sortable: true, render: (r) => <span className="font-semibold">{r.branch}</span> },
    { key: 'students', header: 'Students', sortable: true, className: 'text-center' },
    { key: 'verified', header: 'Verified', sortable: true, className: 'text-center' },
    { key: 'placed', header: 'Placed', sortable: true, className: 'text-center' },
    { key: 'placementRate', header: 'Placement %', sortable: true, render: (r) => `${r.placementRate}%` },
    { key: 'avgCtc', header: 'Avg CTC', sortable: true, render: (r) => (r.avgCtc ? formatCtc(r.avgCtc) : '—') },
  ];

  return (
    <>
      <PageHeader
        title="Placement Analytics"
        description="Live season metrics computed from the PlaceMatrix database."
        actions={<button type="button" className="btn btn-secondary btn-sm" onClick={load}><RefreshCcw className="h-3.5 w-3.5" /> Refresh</button>}
      />

      <section className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <StatCard icon={Users} label="Registered students" value={k.students} tone="blue" hint={`${k.pendingVerification} pending verification`} />
        <StatCard icon={CheckCircle2} label="Verified profiles" value={k.verified} tone="green" />
        <StatCard icon={Trophy} label="Placed" value={k.placed} tone="amber" hint={`${k.placementRate}% of verified`} />
        <StatCard icon={IndianRupee} label="Highest CTC" value={k.highestCtc ? formatCtc(k.highestCtc) : '—'} tone="violet" hint={k.medianCtc ? `Median ${formatCtc(k.medianCtc)}` : undefined} />
        <StatCard icon={Briefcase} label="Open drives" value={k.openDrives} tone="blue" hint={`${k.applications} active applications`} />
        <StatCard icon={Timer} label="Avg. verification time" value={k.avgVerificationHours ? `${k.avgVerificationHours} h` : '—'} tone="gray" hint={`${k.openTickets} open ticket(s)`} />
      </section>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <section className="card card-pad">
          <div className="flex items-center justify-between"><h2 className="card-title">Placement rate by branch</h2><span className="text-[11px] text-ink-muted">% of registered students placed</span></div>
          <div className="mt-3 h-60" role="img" aria-label={`Placement rate by branch: ${data.byBranch.map((b) => `${b.branch} ${b.placementRate}%`).join(', ')}`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byBranch} margin={{ top: 18, right: 8, bottom: 0, left: -12 }} barCategoryGap="30%">
                <CartesianGrid vertical={false} stroke="#E4EAF3" strokeDasharray="3 3" />
                <XAxis dataKey="branch" tick={AXIS} axisLine={false} tickLine={false} />
                <YAxis tick={AXIS} axisLine={false} tickLine={false} unit="%" domain={[0, 100]} />
                <Tooltip content={<ChartTooltip unit="% placed" />} cursor={{ fill: 'rgba(61,90,232,0.06)' }} />
                <Bar dataKey="placementRate" fill={BRAND} radius={[4, 4, 0, 0]} maxBarSize={36}>
                  <LabelList dataKey="placementRate" position="top" formatter={(v) => (v ? `${v}%` : '')} style={{ fontSize: 11, fontWeight: 600, fill: '#14213D' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card card-pad">
          <div className="flex items-center justify-between"><h2 className="card-title">Applications per day</h2><span className="text-[11px] text-ink-muted">last 14 days</span></div>
          <div className="mt-3 h-60" role="img" aria-label="Applications submitted per day over the last 14 days">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.applicationsPerDay.map((d) => ({ ...d, label: d.date.slice(5) }))} margin={{ top: 12, right: 12, bottom: 0, left: -18 }}>
                <CartesianGrid vertical={false} stroke="#E4EAF3" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} interval={1} />
                <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip unit=" application(s)" />} cursor={{ stroke: '#C9D3E6' }} />
                <Line type="monotone" dataKey="count" stroke={BRAND} strokeWidth={2} dot={{ r: 3, fill: BRAND }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card card-pad">
          <h2 className="card-title">Recruitment funnel</h2>
          <div className="mt-3 h-56" role="img" aria-label={`Funnel: ${data.funnel.map((f) => `${f.stage} ${f.count}`).join(', ')}`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.funnel} layout="vertical" margin={{ top: 0, right: 36, bottom: 0, left: 8 }} barCategoryGap={10}>
                <CartesianGrid horizontal={false} stroke="#E4EAF3" strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="stage" width={86} tick={{ fontSize: 12, fill: '#4A5672' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip unit=" application(s)" />} cursor={{ fill: 'rgba(61,90,232,0.06)' }} />
                <Bar dataKey="count" fill={BRAND} radius={[0, 4, 4, 0]} maxBarSize={22}>
                  <LabelList dataKey="count" position="right" style={{ fontSize: 12, fontWeight: 600, fill: '#14213D' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card card-pad">
          <h2 className="card-title">Offers by CTC band (LPA)</h2>
          <div className="mt-3 h-56" role="img" aria-label={`Offers by CTC band: ${data.ctcBands.map((b) => `${b.band} ${b.count}`).join(', ')}`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.ctcBands} margin={{ top: 18, right: 8, bottom: 0, left: -18 }} barCategoryGap="30%">
                <CartesianGrid vertical={false} stroke="#E4EAF3" strokeDasharray="3 3" />
                <XAxis dataKey="band" tick={AXIS} axisLine={false} tickLine={false} />
                <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip unit=" offer(s)" />} cursor={{ fill: 'rgba(61,90,232,0.06)' }} />
                <Bar dataKey="count" fill={BRAND} radius={[4, 4, 0, 0]} maxBarSize={36}>
                  <LabelList dataKey="count" position="top" formatter={(v) => (v ? v : '')} style={{ fontSize: 11, fontWeight: 600, fill: '#14213D' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="mb-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Breakdown title="Profile verification" data={data.verification} />
        <Breakdown title="Documents" data={data.documents} />
        <Breakdown title="Onboarding invitations" data={data.invitations} />
        <Breakdown title="Unfreeze / correction tickets" data={data.tickets.byStatus} />
      </div>

      <section className="card mb-4">
        <div className="border-b border-line px-4 py-3"><h2 className="card-title flex items-center gap-2"><Building2 className="h-4 w-4 text-ink-muted" /> Company-wise outcomes</h2></div>
        <DataTable columns={companyColumns} rows={data.byCompany} rowKey={(r) => r.company} pageSize={10} initialSort={{ key: 'offers', dir: 'desc' }} />
      </section>
      <section className="card">
        <div className="border-b border-line px-4 py-3"><h2 className="card-title">Branch-wise statistics</h2></div>
        <DataTable columns={branchColumns} rows={data.byBranch} rowKey={(r) => r.branch} pageSize={10} initialSort={{ key: 'placementRate', dir: 'desc' }} />
      </section>
    </>
  );
}
