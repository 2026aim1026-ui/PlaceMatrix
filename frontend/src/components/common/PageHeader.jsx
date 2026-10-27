import Breadcrumbs from './Breadcrumbs';

export default function PageHeader({ title, description, actions, breadcrumbs, children }) {
  return (
    <div className="mb-5">
      {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-ink sm:text-[22px]">{title}</h1>
          {description && <p className="mt-1 max-w-3xl text-[13px] text-ink-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
