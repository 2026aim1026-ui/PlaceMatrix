import { NavLink } from 'react-router-dom';
import { X, ArrowLeftRight } from 'lucide-react';
import Avatar from '../common/Avatar';

export function Logo({ dark = true }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-sm font-extrabold text-white shadow-sm">P</span>
      <div className="leading-tight">
        <p className={`text-[15px] font-bold ${dark ? 'text-white' : 'text-ink'}`}>PlaceMatrix</p>
        <p className={`text-[10px] ${dark ? 'text-white/50' : 'text-ink-muted'}`}>From Campus to Career</p>
      </div>
    </div>
  );
}

/** Dark navy navigation. Fixed on desktop, slide-in drawer on mobile. */
export default function Sidebar({ nav, badges = {}, user, open, onClose, extra }) {
  const content = (
    <div className="flex h-full flex-col bg-navy text-white">
      <div className="flex items-center justify-between px-5 pb-4 pt-5">
        <Logo />
        <button type="button" onClick={onClose} className="rounded p-1 text-white/60 hover:bg-white/10 hover:text-white lg:hidden" aria-label="Close navigation">
          <X className="h-5 w-5" />
        </button>
      </div>
      <nav className="scroll-thin flex-1 overflow-y-auto px-3 pb-4" aria-label="Main navigation">
        {nav.map((group) => (
          <div key={group.section} className="mb-4">
            <p className="px-2.5 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">{group.section}</p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const count = item.badge ? badges[item.badge] : 0;
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      onClick={onClose}
                      className={({ isActive }) => `group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors ${isActive ? 'bg-brand/90 text-white shadow-sm' : 'text-white/65 hover:bg-white/[0.07] hover:text-white'}`}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden />
                      <span className="flex-1 truncate">{item.label}</span>
                      {count > 0 && (
                        <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white ring-1 ring-white/20" aria-label={`${count} pending`}>
                          {count}
                        </span>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {extra}
      </nav>
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
          <Avatar name={user.name} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold">{user.name}</p>
            <p className="truncate text-[10.5px] text-white/50">{user.subtitle}</p>
          </div>
          {user.onSwitch && (
            <button type="button" onClick={user.onSwitch} className="rounded p-1.5 text-white/50 hover:bg-white/10 hover:text-white" title="Account menu" aria-label="Open account menu">
              <ArrowLeftRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 lg:block">{content}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fade-in absolute inset-0 bg-navy/60" onClick={onClose} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-64 max-w-[85vw] shadow-pop">{content}</aside>
        </div>
      )}
    </>
  );
}
